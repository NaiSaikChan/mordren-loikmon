import { createHash, randomUUID } from 'node:crypto'
import {
  detectFormat,
  isImageStandard,
  MEDIA_FORMATS,
  MEDIA_STANDARDS,
  processedImageKey,
  responsiveImage,
  STORAGE_KINDS,
  validateMediaUpload,
  variantKey,
  visibilityOfKey,
  type ImageStandard,
  type MediaAssetType,
  type MediaCategory,
  type MediaIssue,
} from '@loikmon/media-standards'
import { sql, type Kysely, type RawBuilder } from 'kysely'
import type { Database, MediaAsset, MediaVariantRecord } from '../db/types.js'
import { likePattern, pageInfo } from '../http/validate.js'
import { errors } from '../lib/errors.js'
import type { Logger } from '../lib/logger.js'
import { assertSafeSvg, generateVariants, inspectImage, type ImageInfo } from '../media/imageProcessor.js'
import { MEDIA_REFERENCES } from '../media/references.js'
import { looksLikeSvg, sniffFormat } from '../media/sniff.js'
import { buildObjectKey, type StorageService } from '../storage/storage.js'
import type { AuditActorInfo, AuditService } from './audit.js'

/**
 * The media library: every CMS upload is validated against its asset
 * standard, processed (images get responsive WebP variants and, for covers,
 * an Open Graph card), stored, and registered in `media_assets` so it can be
 * searched, reused, moved between folders and tracked across content.
 *
 * `storage` here is the raw store — deleting through the library really
 * deletes. Entity services get a library-aware store instead (see
 * LibraryAwareStorage) that leaves registered assets in place.
 */

export interface MediaUsage {
  reference: string
  label: string
  entity_type: string
  entity_id: string
  entity_label: string | null
}

export interface UploadInput {
  assetType: MediaAssetType
  buffer: Buffer
  mimeType: string
  originalName: string
  folderId?: number | null
  title?: string | null
  altText?: string | null
  /** false: process and store only (user profile pictures are not library assets). */
  register?: boolean
}

export interface UploadResult {
  key: string
  asset: MediaAssetDto | null
  warnings: MediaIssue[]
  /** An identical file of the same type was already in the library and was reused. */
  reused: boolean
}

export interface ListParams {
  page: number
  limit: number
  q?: string
  category?: MediaCategory
  assetType?: MediaAssetType
  /** A folder id, `root` for unfiled assets, or omitted for every folder. */
  folder?: number | 'root'
  usage?: 'used' | 'unused'
  sort?: 'latest' | 'oldest' | 'name' | 'largest'
}

export type MediaAssetDto = ReturnType<MediaService['toDto']>

type Executor = Kysely<Database>

function issuesToDetails(issues: MediaIssue[]) {
  return issues.map((issue) => ({ path: 'file', message: issue.message, code: issue.code }))
}

function parseVariants(value: unknown): Record<string, MediaVariantRecord> {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, MediaVariantRecord>
    } catch {
      return {}
    }
  }
  return value as Record<string, MediaVariantRecord>
}

/** `setting_key LIKE …` style fragments are constants from MEDIA_REFERENCES, never user input. */
function referenceKeyExpr(ref: (typeof MEDIA_REFERENCES)[number]): RawBuilder<string> {
  return ref.keyExpression ? sql.raw(ref.keyExpression) : sql.ref(`${ref.table}.${ref.column}`)
}

/**
 * Width of `media_assets.checksum` (migration 0004, repaired by 0005).
 * A checksum is stored with its algorithm prefix, so the prefix counts too:
 * anything longer is rejected by MySQL with "Data too long for column".
 */
export const CHECKSUM_MAX_LENGTH = 80

/** `sha256:<hex>` of the bytes — identical re-uploads of the same asset type are reused. */
export function contentChecksum(buffer: Buffer): string {
  return `sha256:${createHash('sha256').update(buffer).digest('hex')}`
}

/**
 * `key:<hex>` for direct-to-storage uploads, whose bytes never reach the API.
 * It identifies the object rather than its content, so these never deduplicate.
 */
export function keyChecksum(key: string): string {
  return `key:${createHash('sha256').update(key).digest('hex')}`
}

export class MediaService {
  constructor(
    private readonly db: Executor,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly logger: Logger,
    private readonly limits: { uploadMaxBytes: number },
  ) {}

  // ── Upload ─────────────────────────────────────────────────────────────

  async upload(actor: AuditActorInfo, input: UploadInput): Promise<UploadResult> {
    const standard = MEDIA_STANDARDS[input.assetType]
    const register = input.register ?? true
    const checksum = contentChecksum(input.buffer)

    let imageInfo: ImageInfo | null = null
    let mimeType: string
    if (isImageStandard(standard)) {
      if (looksLikeSvg(input.buffer)) assertSafeSvg(input.buffer)
      imageInfo = await inspectImage(input.buffer)
      mimeType = MEDIA_FORMATS[imageInfo.format].mimeTypes[0]!
    } else {
      const sniffed = sniffFormat(input.buffer)
      const declared = detectFormat(input.mimeType, input.originalName)
      if (!sniffed || (declared && declared.category !== MEDIA_FORMATS[sniffed].category)) {
        throw errors.validation([{ path: 'file', message: `${standard.label} accepts ${standard.formats.map((f) => MEDIA_FORMATS[f].label).join(', ')}.` }])
      }
      mimeType = MEDIA_FORMATS[sniffed].mimeTypes[0]!
    }

    const validation = validateMediaUpload(
      input.assetType,
      { mimeType, filename: input.originalName, bytes: input.buffer.length, width: imageInfo?.width, height: imageInfo?.height },
      { maxBytes: this.limits.uploadMaxBytes },
    )
    if (!validation.ok) throw errors.validation(issuesToDetails(validation.errors), validation.errors[0]!.message)
    const format = validation.format!

    if (register) {
      const existing = await this.db
        .selectFrom('media_assets')
        .selectAll()
        .where('checksum', '=', checksum)
        .where('asset_type', '=', input.assetType)
        .executeTakeFirst()
      if (existing && (await this.storage.statObject(existing.storage_key))) {
        return { key: existing.storage_key, asset: this.toDto(existing), warnings: validation.warnings, reused: true }
      }
    }

    await this.assertFolder(input.folderId)

    const written: string[] = []
    const put = async (key: string, body: Buffer, contentType: string) => {
      await this.storage.putObjectAt(key, body, body.length, contentType)
      written.push(key)
    }

    try {
      let key: string
      const variants: Record<string, MediaVariantRecord> = {}
      if (imageInfo) {
        key = processedImageKey(standard.storageKind, randomUUID(), format.extensions[0]!)
        await put(key, input.buffer, mimeType)
        for (const variant of await generateVariants(input.buffer, imageInfo, standard as ImageStandard)) {
          const derived = variantKey(key, variant.name)!
          await put(derived, variant.buffer, variant.contentType)
          variants[variant.name] = { key: derived, width: variant.width, height: variant.height, bytes: variant.buffer.length }
        }
      } else {
        key = buildObjectKey(standard.storageKind, `file${format.extensions[0]}`)
        await put(key, input.buffer, mimeType)
      }

      if (!register) return { key, asset: null, warnings: validation.warnings, reused: false }

      const totalBytes = input.buffer.length + Object.values(variants).reduce((sum, v) => sum + v.bytes, 0)
      const inserted = await this.db
        .insertInto('media_assets')
        .values({
          storage_key: key,
          storage_kind: standard.storageKind,
          asset_type: input.assetType,
          category: standard.category,
          folder_id: input.folderId ?? null,
          original_name: input.originalName.slice(0, 255),
          title: input.title ?? null,
          alt_text: input.altText ?? null,
          mime_type: mimeType,
          format: format.id,
          size_bytes: input.buffer.length,
          width: imageInfo && imageInfo.format !== 'svg' ? imageInfo.width : null,
          height: imageInfo && imageInfo.format !== 'svg' ? imageInfo.height : null,
          has_alpha: imageInfo?.hasAlpha ?? false,
          dominant_color: imageInfo?.dominantColor ?? null,
          checksum,
          variants: Object.keys(variants).length ? JSON.stringify(variants) : null,
          total_bytes: totalBytes,
          uploaded_by: actor.id,
        })
        .executeTakeFirstOrThrow()
      const asset = await this.getRow(Number(inserted.insertId))
      await this.audit.record({
        actor,
        action: 'upload',
        entityType: 'media',
        entityId: asset.id,
        summary: `${standard.label}: ${input.originalName}`,
        after: { key, asset_type: input.assetType, size_bytes: input.buffer.length, width: asset.width, height: asset.height },
      })
      return { key, asset: this.toDto(asset), warnings: validation.warnings, reused: false }
    } catch (err) {
      // Never leave half-processed files behind.
      await Promise.all(
        written.map((k) => this.storage.removeObject(k).catch((cleanupErr: unknown) => this.logger.warn({ err: cleanupErr, key: k }, 'failed to remove partial upload'))),
      )
      throw err
    }
  }

  /**
   * Register a file the browser PUT straight to storage with a presigned URL
   * (books and audio too large to pass through the API). The object must
   * exist, be of an allowed type and fit the limit — otherwise it is deleted.
   */
  async registerDirectUpload(
    actor: AuditActorInfo,
    input: { key: string; assetType: MediaAssetType; originalName: string; folderId?: number | null; title?: string | null },
  ): Promise<UploadResult> {
    const standard = MEDIA_STANDARDS[input.assetType]
    if (isImageStandard(standard)) throw errors.badRequest('Images must be uploaded through the API so they can be processed')
    if (!input.key.startsWith(`${standard.storageKind}/`)) throw errors.badRequest(`The key does not belong to ${standard.label}`)

    const existing = await this.db.selectFrom('media_assets').selectAll().where('storage_key', '=', input.key).executeTakeFirst()
    if (existing) return { key: existing.storage_key, asset: this.toDto(existing), warnings: [], reused: true }

    const stat = await this.storage.statObject(input.key)
    if (!stat) throw errors.notFound('Uploaded file')
    const validation = validateMediaUpload(
      input.assetType,
      { mimeType: stat.contentType, filename: input.originalName, bytes: stat.size },
      { maxBytes: this.limits.uploadMaxBytes },
    )
    if (!validation.ok) {
      await this.storage.removeObject(input.key).catch(() => undefined)
      throw errors.validation(issuesToDetails(validation.errors), validation.errors[0]!.message)
    }
    await this.assertFolder(input.folderId)

    const inserted = await this.db
      .insertInto('media_assets')
      .values({
        storage_key: input.key,
        storage_kind: standard.storageKind,
        asset_type: input.assetType,
        category: standard.category,
        folder_id: input.folderId ?? null,
        original_name: input.originalName.slice(0, 255),
        title: input.title ?? null,
        mime_type: validation.format!.mimeTypes[0]!,
        format: validation.format!.id,
        size_bytes: stat.size,
        checksum: keyChecksum(input.key),
        total_bytes: stat.size,
        uploaded_by: actor.id,
      })
      .executeTakeFirstOrThrow()
    const asset = await this.getRow(Number(inserted.insertId))
    await this.audit.record({
      actor,
      action: 'upload',
      entityType: 'media',
      entityId: asset.id,
      summary: `${standard.label}: ${input.originalName}`,
      after: { key: input.key, asset_type: input.assetType, size_bytes: stat.size },
    })
    return { key: input.key, asset: this.toDto(asset), warnings: validation.warnings, reused: false }
  }

  // ── Library ────────────────────────────────────────────────────────────

  async list(params: ListParams) {
    const base = () => {
      let q = this.db.selectFrom('media_assets')
      if (params.q) {
        const pattern = likePattern(params.q)
        q = q.where((eb) =>
          eb.or([eb('original_name', 'like', pattern), eb('title', 'like', pattern), eb('alt_text', 'like', pattern)]),
        )
      }
      if (params.category) q = q.where('category', '=', params.category)
      if (params.assetType) q = q.where('asset_type', '=', params.assetType)
      if (params.folder === 'root') q = q.where('folder_id', 'is', null)
      else if (params.folder !== undefined) q = q.where('folder_id', '=', params.folder)
      if (params.usage) {
        const used = this.isReferencedSql()
        q = q.where(params.usage === 'used' ? used : sql<boolean>`NOT (${used})`)
      }
      return q
    }

    const order = {
      latest: ['created_at', 'desc'],
      oldest: ['created_at', 'asc'],
      name: ['original_name', 'asc'],
      largest: ['total_bytes', 'desc'],
    } as const
    const [column, direction] = order[params.sort ?? 'latest']

    const [rows, total] = await Promise.all([
      base()
        .selectAll()
        .orderBy(column, direction)
        .orderBy('id', 'desc')
        .limit(params.limit)
        .offset((params.page - 1) * params.limit)
        .execute(),
      base()
        .select((eb) => eb.fn.countAll().as('total'))
        .executeTakeFirst(),
    ])
    const usages = await this.usagesForKeys(rows.map((r) => r.storage_key))
    return {
      rows: rows.map((row) => ({ ...this.toDto(row), usage_count: usages.get(row.storage_key)?.length ?? 0 })),
      pagination: pageInfo(params.page, params.limit, Number(total?.total ?? 0)),
    }
  }

  async get(id: number) {
    const row = await this.getRow(id)
    const usages = await this.usagesForKeys([row.storage_key])
    const list = usages.get(row.storage_key) ?? []
    return { ...this.toDto(row), usage_count: list.length, usages: list }
  }

  async update(actor: AuditActorInfo, id: number, patch: { title?: string | null; alt_text?: string | null; folder_id?: number | null }) {
    const before = await this.getRow(id)
    if (patch.folder_id !== undefined) await this.assertFolder(patch.folder_id)
    await this.db.updateTable('media_assets').set(patch).where('id', '=', id).execute()
    await this.audit.record({
      actor,
      action: 'update',
      entityType: 'media',
      entityId: id,
      summary: before.original_name,
      before: { title: before.title, alt_text: before.alt_text, folder_id: before.folder_id },
      after: patch,
    })
    return this.get(id)
  }

  async move(actor: AuditActorInfo, ids: number[], folderId: number | null) {
    await this.assertFolder(folderId)
    const result = await this.db.updateTable('media_assets').set({ folder_id: folderId }).where('id', 'in', ids).executeTakeFirst()
    await this.audit.record({
      actor,
      action: 'update',
      entityType: 'media',
      entityId: null,
      summary: `Moved ${ids.length} asset(s)`,
      after: { ids, folder_id: folderId },
    })
    return { moved: Number(result.numUpdatedRows) }
  }

  /**
   * Delete assets and every derived file. Assets still referenced by content
   * are skipped unless `force` is set — the response lists them so the CMS can
   * show where they are used.
   */
  async remove(actor: AuditActorInfo, ids: number[], options: { force?: boolean } = {}) {
    const rows = await this.db.selectFrom('media_assets').selectAll().where('id', 'in', ids).execute()
    const usages = await this.usagesForKeys(rows.map((r) => r.storage_key))
    const deleted: number[] = []
    const inUse: Array<{ id: number; original_name: string; usages: MediaUsage[] }> = []

    for (const row of rows) {
      const used = usages.get(row.storage_key) ?? []
      if (used.length && !options.force) {
        inUse.push({ id: row.id, original_name: row.original_name, usages: used })
        continue
      }
      await this.storage.removeObject(row.storage_key)
      await this.db.deleteFrom('media_assets').where('id', '=', row.id).execute()
      deleted.push(row.id)
      await this.audit.record({
        actor,
        action: 'delete',
        entityType: 'media',
        entityId: row.id,
        summary: row.original_name,
        before: { key: row.storage_key, asset_type: row.asset_type, usages: used.length },
      })
    }
    return { deleted, in_use: inUse, not_found: ids.filter((id) => !rows.some((r) => r.id === id)) }
  }

  async stats() {
    const [totals, byCategory, unused] = await Promise.all([
      this.db
        .selectFrom('media_assets')
        .select((eb) => [eb.fn.countAll().as('count'), eb.fn.sum<number>('total_bytes').as('bytes'), eb.fn.sum<number>('size_bytes').as('original_bytes')])
        .executeTakeFirst(),
      this.db
        .selectFrom('media_assets')
        .select((eb) => ['category', eb.fn.countAll().as('count'), eb.fn.sum<number>('total_bytes').as('bytes')])
        .groupBy('category')
        .execute(),
      this.db
        .selectFrom('media_assets')
        .select((eb) => [eb.fn.countAll().as('count'), eb.fn.sum<number>('total_bytes').as('bytes')])
        .where(sql<boolean>`NOT (${this.isReferencedSql()})`)
        .executeTakeFirst(),
    ])
    return {
      assets: Number(totals?.count ?? 0),
      total_bytes: Number(totals?.bytes ?? 0),
      original_bytes: Number(totals?.original_bytes ?? 0),
      by_category: Object.fromEntries(byCategory.map((r) => [r.category, { count: Number(r.count), bytes: Number(r.bytes ?? 0) }])),
      unused: { count: Number(unused?.count ?? 0), bytes: Number(unused?.bytes ?? 0) },
    }
  }

  /**
   * Resolve keys held by content rows to display data — lets an edit form show
   * the current image without the content API knowing about the library.
   * Keys without a registry row (legacy uploads) still get a URL.
   */
  async resolve(keys: string[]) {
    const unique = [...new Set(keys.filter(Boolean))]
    const rows = unique.length ? await this.db.selectFrom('media_assets').selectAll().where('storage_key', 'in', unique).execute() : []
    const byKey = new Map(rows.map((row) => [row.storage_key, row]))
    return unique.map((key) => {
      const row = byKey.get(key)
      if (row) return { key, registered: true as const, asset: this.toDto(row) }
      const isPublic = this.storage.isAbsoluteUrl(key) || visibilityOfKey(key) === 'public'
      const url = isPublic ? this.storage.publicUrl(key) : null
      return {
        key,
        registered: false as const,
        url,
        image: isPublic ? responsiveImage(key, (k) => this.storage.publicUrl(k)) : null,
      }
    })
  }

  // ── Folders ────────────────────────────────────────────────────────────

  async listFolders() {
    const rows = await this.db
      .selectFrom('media_folders as f')
      .select((eb) => [
        'f.id',
        'f.parent_id',
        'f.name',
        'f.created_at',
        'f.updated_at',
        eb.selectFrom('media_assets as a').whereRef('a.folder_id', '=', 'f.id').select(eb.fn.countAll().as('n')).as('asset_count'),
      ])
      .orderBy('f.name')
      .execute()
    const unfiled = await this.db
      .selectFrom('media_assets')
      .select((eb) => eb.fn.countAll().as('n'))
      .where('folder_id', 'is', null)
      .executeTakeFirst()
    return { folders: rows.map((r) => ({ ...r, asset_count: Number(r.asset_count ?? 0) })), unfiled_count: Number(unfiled?.n ?? 0) }
  }

  async createFolder(actor: AuditActorInfo, input: { name: string; parent_id?: number | null }) {
    await this.assertFolder(input.parent_id)
    await this.assertUniqueFolderName(input.name, input.parent_id ?? null)
    const inserted = await this.db
      .insertInto('media_folders')
      .values({ name: input.name, parent_id: input.parent_id ?? null, created_by: actor.id })
      .executeTakeFirstOrThrow()
    const id = Number(inserted.insertId)
    await this.audit.record({ actor, action: 'create', entityType: 'media_folder', entityId: id, summary: input.name })
    return this.db.selectFrom('media_folders').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  }

  async updateFolder(actor: AuditActorInfo, id: number, patch: { name?: string; parent_id?: number | null }) {
    const before = await this.db.selectFrom('media_folders').selectAll().where('id', '=', id).executeTakeFirst()
    if (!before) throw errors.notFound('Folder')
    const parentId = patch.parent_id !== undefined ? patch.parent_id : before.parent_id
    if (patch.parent_id !== undefined && patch.parent_id !== null) {
      await this.assertFolder(patch.parent_id)
      // Walk up from the new parent: reaching `id` would create a cycle.
      let cursor: number | null = patch.parent_id
      while (cursor !== null) {
        if (cursor === id) throw errors.badRequest('A folder cannot be moved inside itself')
        const parent: { parent_id: number | null } | undefined = await this.db
          .selectFrom('media_folders')
          .select('parent_id')
          .where('id', '=', cursor)
          .executeTakeFirst()
        cursor = parent?.parent_id ?? null
      }
    }
    if (patch.name !== undefined || patch.parent_id !== undefined) {
      await this.assertUniqueFolderName(patch.name ?? before.name, parentId, id)
    }
    await this.db.updateTable('media_folders').set(patch).where('id', '=', id).execute()
    await this.audit.record({ actor, action: 'update', entityType: 'media_folder', entityId: id, summary: patch.name ?? before.name, before, after: patch })
    return this.db.selectFrom('media_folders').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  }

  /** Assets in the folder move up to its parent; folders with sub-folders cannot be deleted. */
  async deleteFolder(actor: AuditActorInfo, id: number) {
    const folder = await this.db.selectFrom('media_folders').selectAll().where('id', '=', id).executeTakeFirst()
    if (!folder) throw errors.notFound('Folder')
    const child = await this.db.selectFrom('media_folders').select('id').where('parent_id', '=', id).executeTakeFirst()
    if (child) throw errors.conflict('Delete or move the sub-folders first')
    await this.db.transaction().execute(async (trx) => {
      await trx.updateTable('media_assets').set({ folder_id: folder.parent_id }).where('folder_id', '=', id).execute()
      await trx.deleteFrom('media_folders').where('id', '=', id).execute()
    })
    await this.audit.record({ actor, action: 'delete', entityType: 'media_folder', entityId: id, summary: folder.name })
  }

  // ── Usage tracking ─────────────────────────────────────────────────────

  /** Where each key is referenced, across every column in MEDIA_REFERENCES. */
  async usagesForKeys(keys: string[]): Promise<Map<string, MediaUsage[]>> {
    const out = new Map<string, MediaUsage[]>()
    const unique = [...new Set(keys)]
    if (!unique.length) return out
    const parts = MEDIA_REFERENCES.map((ref) => {
      const keyExpr = referenceKeyExpr(ref)
      const extra = ref.where ? sql` AND ${sql.raw(ref.where)}` : sql``
      return sql`SELECT ${ref.id} AS reference, ${ref.label} AS label, ${ref.entityType} AS entity_type,
        CAST(${sql.ref(`${ref.table}.${ref.idColumn}`)} AS CHAR) AS entity_id,
        ${sql.ref(`${ref.table}.${ref.labelColumn}`)} AS entity_label,
        ${keyExpr} AS storage_key
        FROM ${sql.table(ref.table)}
        WHERE ${keyExpr} IN (${sql.join(unique)})${extra}`
    })
    const result = await sql<MediaUsage & { storage_key: string }>`${sql.join(parts, sql` UNION ALL `)}`.execute(this.db)
    for (const { storage_key, ...usage } of result.rows) {
      const list = out.get(storage_key) ?? []
      list.push({ ...usage, entity_id: String(usage.entity_id) })
      out.set(storage_key, list)
    }
    return out
  }

  /** SQL predicate: `media_assets.storage_key` is referenced somewhere. */
  private isReferencedSql(): RawBuilder<boolean> {
    const checks = MEDIA_REFERENCES.map((ref) => {
      const extra = ref.where ? sql` AND ${sql.raw(ref.where)}` : sql``
      return sql`EXISTS (SELECT 1 FROM ${sql.table(ref.table)} WHERE ${referenceKeyExpr(ref)} = media_assets.storage_key${extra})`
    })
    return sql<boolean>`(${sql.join(checks, sql` OR `)})`
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private async getRow(id: number): Promise<MediaAsset> {
    const row = await this.db.selectFrom('media_assets').selectAll().where('id', '=', id).executeTakeFirst()
    if (!row) throw errors.notFound('Media asset')
    return row
  }

  private async assertFolder(folderId: number | null | undefined) {
    if (folderId === null || folderId === undefined) return
    const folder = await this.db.selectFrom('media_folders').select('id').where('id', '=', folderId).executeTakeFirst()
    if (!folder) throw errors.notFound('Folder')
  }

  private async assertUniqueFolderName(name: string, parentId: number | null, exceptId?: number) {
    let q = this.db.selectFrom('media_folders').select('id').where('name', '=', name)
    q = parentId === null ? q.where('parent_id', 'is', null) : q.where('parent_id', '=', parentId)
    if (exceptId) q = q.where('id', '!=', exceptId)
    if (await q.executeTakeFirst()) throw errors.conflict(`A folder named "${name}" already exists here`)
  }

  toDto(row: MediaAsset) {
    const standard = MEDIA_STANDARDS[row.asset_type as MediaAssetType]
    const isPublic = STORAGE_KINDS[row.storage_kind as keyof typeof STORAGE_KINDS]?.visibility === 'public'
    const variants = parseVariants(row.variants)
    const urlFor = (key: string) => this.storage.publicUrl(key)
    return {
      id: row.id,
      key: row.storage_key,
      asset_type: row.asset_type,
      asset_type_label: standard?.label ?? row.asset_type,
      category: row.category,
      storage_kind: row.storage_kind,
      visibility: isPublic ? ('public' as const) : ('private' as const),
      folder_id: row.folder_id,
      original_name: row.original_name,
      title: row.title,
      alt_text: row.alt_text,
      mime_type: row.mime_type,
      format: row.format,
      size_bytes: Number(row.size_bytes),
      total_bytes: Number(row.total_bytes),
      width: row.width,
      height: row.height,
      has_alpha: row.has_alpha,
      dominant_color: row.dominant_color,
      display: standard && isImageStandard(standard) ? standard.display : null,
      /** Public URL of the original; private assets need `POST /media/signed-url`. */
      url: isPublic ? urlFor(row.storage_key) : null,
      image: isPublic && row.category === 'image' ? responsiveImage(row.storage_key, urlFor) : null,
      variants: Object.fromEntries(
        Object.entries(variants).map(([name, v]) => [name, { ...v, url: isPublic ? urlFor(v.key) : null }]),
      ),
      uploaded_by: row.uploaded_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  }
}
