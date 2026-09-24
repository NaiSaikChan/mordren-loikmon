import {
  BULK_UPLOAD_MAX_FILES,
  DEFAULT_ASSET_TYPE_FOR_KIND,
  detectFormat,
  DIRECT_UPLOAD_THRESHOLD,
  IMAGE_VARIANTS,
  isImageAssetType,
  MEDIA_ASSET_TYPES,
  MEDIA_FORMATS,
  MEDIA_STANDARDS,
  STORAGE_KIND_LIST,
  STORAGE_KINDS,
  UPLOAD_LIMITS,
  validateMediaUpload,
  type MediaAssetType,
  type StorageKind,
} from '@loikmon/media-standards'
import { Router, type Request } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { errors, isAppError } from '../../../lib/errors.js'
import type { AppContext } from '../../context.js'
import { auditActor, requirePermission } from '../../middleware/permissions.js'
import { idParam, pagination, parse } from '../../validate.js'
import { idsBody } from './shared.js'

/**
 * `/cms/media*` — the media library.
 *
 * Images always pass through the API (they are decoded, validated against
 * their asset standard and processed into variants). Documents and audio
 * above DIRECT_UPLOAD_THRESHOLD are PUT straight to storage with a presigned
 * URL and registered afterwards with `/media/complete`.
 */

const assetType = z.enum(MEDIA_ASSET_TYPES as [MediaAssetType, ...MediaAssetType[]])
const storageKind = z.enum(STORAGE_KIND_LIST as [StorageKind, ...StorageKind[]])
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional()
const folderId = z.coerce.number().int().positive().nullable().optional()

/** Multipart fields arrive as strings: `folder_id=""` means "no folder". */
const multipartFolder = z
  .union([z.literal(''), z.literal('null'), z.coerce.number().int().positive()])
  .optional()
  .transform((v) => (v === '' || v === 'null' || v === undefined ? null : v))

/** `asset_type` is the contract; `kind` is accepted from older clients and treated as a free-form upload. */
const typeOrKind = z
  .object({ asset_type: assetType.optional(), kind: storageKind.optional() })
  .refine((v) => v.asset_type || v.kind, { message: 'asset_type is required', path: ['asset_type'] })
  .transform((v) => v.asset_type ?? DEFAULT_ASSET_TYPE_FOR_KIND[v.kind!])

const MediaPatch = z
  .object({ title: nullableText(255), alt_text: nullableText(500), folder_id: folderId })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' })

const FolderInput = z.object({ name: z.string().trim().min(1).max(120), parent_id: folderId })

export function mediaRouter(ctx: AppContext) {
  const router = Router()
  const media = ctx.services.media

  // The largest file the API itself accepts; everything bigger goes direct to storage.
  const apiUploadLimit = Math.min(ctx.config.storage.uploadMaxBytes, Math.max(UPLOAD_LIMITS.image, DIRECT_UPLOAD_THRESHOLD))
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: apiUploadLimit, files: BULK_UPLOAD_MAX_FILES } })

  const originalName = (file: Express.Multer.File) => Buffer.from(file.originalname, 'latin1').toString('utf8')

  // ── Standards ──────────────────────────────────────────────────────────

  /** The shared standards as JSON, for clients that cannot import @loikmon/media-standards (mobile, scripts). */
  router.get('/media/standards', requirePermission('media.upload'), (_req, res) => {
    res.json({
      status: 'ok',
      standards: MEDIA_STANDARDS,
      formats: MEDIA_FORMATS,
      variants: IMAGE_VARIANTS,
      storage_kinds: STORAGE_KINDS,
      limits: { ...UPLOAD_LIMITS, api_upload_bytes: apiUploadLimit, deployment_max_bytes: ctx.config.storage.uploadMaxBytes },
    })
  })

  // ── Library ────────────────────────────────────────────────────────────

  router.get('/media', requirePermission('media.upload'), async (req, res) => {
    const q = parse(
      pagination.extend({
        limit: z.coerce.number().int().min(1).max(100).default(40),
        q: z.string().trim().max(200).optional(),
        category: z.enum(['image', 'document', 'audio']).optional(),
        asset_type: assetType.optional(),
        folder: z.union([z.literal('root'), z.coerce.number().int().positive()]).optional(),
        usage: z.enum(['used', 'unused']).optional(),
        sort: z.enum(['latest', 'oldest', 'name', 'largest']).optional(),
      }),
      req.query,
    )
    const { rows, pagination: page } = await media.list({ ...q, assetType: q.asset_type })
    res.json({ status: 'ok', assets: rows, pagination: page })
  })

  router.get('/media/stats', requirePermission('media.upload'), async (_req, res) => {
    res.json({ status: 'ok', stats: await media.stats() })
  })

  /** Display data for keys stored on content rows (edit forms). */
  router.post('/media/resolve', requirePermission('media.upload'), async (req, res) => {
    const { keys } = parse(z.object({ keys: z.array(z.string().trim().min(1).max(1024)).max(100) }), req.body)
    res.json({ status: 'ok', items: await media.resolve(keys) })
  })

  router.get('/media/:id', requirePermission('media.upload'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    res.json({ status: 'ok', asset: await media.get(id) })
  })

  router.patch('/media/:id', requirePermission('media.upload'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    res.json({ status: 'ok', asset: await media.update(auditActor(req), id, parse(MediaPatch, req.body)) })
  })

  router.post('/media/move', requirePermission('media.upload'), async (req, res) => {
    const body = parse(idsBody.extend({ folder_id: z.number().int().positive().nullable() }), req.body)
    res.json({ status: 'ok', ...(await media.move(auditActor(req), body.ids, body.folder_id)) })
  })

  // ── Upload ─────────────────────────────────────────────────────────────

  router.post('/media', requirePermission('media.upload'), upload.single('file'), async (req, res) => {
    const type = parse(typeOrKind, req.body)
    const meta = parse(z.object({ folder_id: multipartFolder, title: nullableText(255), alt_text: nullableText(500) }), req.body)
    const file = req.file
    if (!file) throw errors.validation([{ path: 'file', message: 'File is required' }])
    const result = await media.upload(auditActor(req), {
      assetType: type,
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: originalName(file),
      folderId: meta.folder_id,
      title: meta.title,
      altText: meta.alt_text,
    })
    res.status(result.reused ? 200 : 201).json({
      status: 'ok',
      key: result.key,
      public_url: result.asset?.url ?? null,
      asset: result.asset,
      warnings: result.warnings,
      reused: result.reused,
    })
  })

  /** Drag-and-drop bulk upload. Each file succeeds or fails on its own. */
  router.post('/media/bulk', requirePermission('media.upload'), upload.array('files', BULK_UPLOAD_MAX_FILES), async (req, res) => {
    const body = parse(z.object({ asset_type: assetType.default('library_image'), folder_id: multipartFolder }), req.body)
    const files = (req.files as Express.Multer.File[] | undefined) ?? []
    if (!files.length) throw errors.validation([{ path: 'files', message: 'At least one file is required' }])

    const results = []
    for (const file of files) {
      const name = originalName(file)
      // Library uploads accept any supported format; the file's own category picks a free-form type.
      const type = body.asset_type === 'library_image' ? inferLibraryType(file.mimetype, name) : body.asset_type
      try {
        const result = await media.upload(auditActor(req), {
          assetType: type,
          buffer: file.buffer,
          mimeType: file.mimetype,
          originalName: name,
          folderId: body.folder_id,
        })
        results.push({ name, ok: true, asset: result.asset, warnings: result.warnings, reused: result.reused })
      } catch (err) {
        if (!isAppError(err) || err.isServerError) throw err
        results.push({ name, ok: false, error: { code: err.code, message: err.message, details: err.details } })
      }
    }
    res.status(207).json({ status: 'ok', results })
  })

  /** Presigned PUT for large documents and audio; validated before any bytes move. */
  router.post('/media/presign', requirePermission('media.upload'), async (req, res) => {
    const type = parse(typeOrKind, req.body)
    const body = parse(
      z.object({
        content_type: z.string().min(1).max(128),
        filename: z.string().max(255).optional(),
        size: z.number().int().positive().optional(),
      }),
      req.body,
    )
    if (isImageAssetType(type)) throw errors.badRequest('Images must be uploaded to POST /cms/media so they can be processed')
    const check = validateMediaUpload(
      type,
      { mimeType: body.content_type, filename: body.filename, bytes: body.size ?? 1 },
      { maxBytes: ctx.config.storage.uploadMaxBytes },
    )
    if (!check.ok) throw errors.validation(check.errors.map((e) => ({ path: 'file', message: e.message, code: e.code })), check.errors[0]!.message)

    const standard = MEDIA_STANDARDS[type]
    // Sign the canonical type so the stored object's Content-Type is predictable.
    const contentType = check.format!.mimeTypes[0]!
    const presigned = await ctx.storage.presignUpload(standard.storageKind, contentType, body.filename)
    res.json({ status: 'ok', asset_type: type, upload: presigned, public_url: null })
  })

  /** Register a presigned upload in the library once the PUT has finished. */
  router.post('/media/complete', requirePermission('media.upload'), async (req, res) => {
    const body = parse(
      z.object({
        key: z.string().trim().min(1).max(512),
        asset_type: assetType,
        original_name: z.string().trim().min(1).max(255),
        folder_id: folderId,
        title: nullableText(255),
      }),
      req.body,
    )
    const result = await media.registerDirectUpload(auditActor(req), {
      key: body.key,
      assetType: body.asset_type,
      originalName: body.original_name,
      folderId: body.folder_id,
      title: body.title,
    })
    res.status(result.reused ? 200 : 201).json({ status: 'ok', key: result.key, asset: result.asset, warnings: result.warnings })
  })

  /** Signed URL so the CMS can preview a private asset (PDF, EPUB, audio). */
  router.post('/media/signed-url', requirePermission('media.upload'), async (req, res) => {
    const { key } = parse(z.object({ key: z.string().trim().min(1).max(1024) }), req.body)
    const signed = await ctx.storage.signedUrl(key, { ttlSeconds: 600 })
    res.json({ status: 'ok', url: signed.url, expires_at: signed.expiresAt.toISOString() })
  })

  // ── Delete ─────────────────────────────────────────────────────────────

  router.post('/media/bulk-delete', requirePermission('media.delete'), async (req, res) => {
    const body = parse(idsBody.extend({ force: z.boolean().optional() }), req.body)
    res.json({ status: 'ok', ...(await media.remove(auditActor(req), body.ids, { force: body.force })) })
  })

  router.delete('/media/:id', requirePermission('media.delete'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    const { force } = parse(z.object({ force: z.enum(['true', 'false']).optional() }), req.query)
    const result = await media.remove(auditActor(req), [id], { force: force === 'true' })
    if (result.not_found.length) throw errors.notFound('Media asset')
    if (result.in_use.length) throw errors.conflict('This asset is still in use', { usages: result.in_use[0]!.usages })
    res.json({ status: 'ok' })
  })

  /** Delete by storage key (older clients). Library assets go through the usage check. */
  router.delete('/media', requirePermission('media.delete'), async (req: Request, res) => {
    const { key } = parse(z.object({ key: z.string().trim().min(1).max(1024) }), req.body)
    const [resolved] = await media.resolve([key])
    if (resolved?.registered) {
      const result = await media.remove(auditActor(req), [resolved.asset.id])
      if (result.in_use.length) throw errors.conflict('This asset is still in use', { usages: result.in_use[0]!.usages })
    } else {
      await ctx.storage.removeObject(key)
      await ctx.services.audit.record({ actor: auditActor(req), action: 'delete', entityType: 'media', entityId: key, summary: key })
    }
    res.json({ status: 'ok' })
  })

  // ── Folders ────────────────────────────────────────────────────────────

  router.get('/media-folders', requirePermission('media.upload'), async (_req, res) => {
    res.json({ status: 'ok', ...(await media.listFolders()) })
  })

  router.post('/media-folders', requirePermission('media.upload'), async (req, res) => {
    res.status(201).json({ status: 'ok', folder: await media.createFolder(auditActor(req), parse(FolderInput, req.body)) })
  })

  router.patch('/media-folders/:id', requirePermission('media.upload'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    res.json({ status: 'ok', folder: await media.updateFolder(auditActor(req), id, parse(FolderInput.partial(), req.body)) })
  })

  router.delete('/media-folders/:id', requirePermission('media.delete'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    await media.deleteFolder(auditActor(req), id)
    res.json({ status: 'ok' })
  })

  return router
}

/** Free-form type for a library upload, from the file's own format. */
function inferLibraryType(mime: string, filename: string): MediaAssetType {
  const format = detectFormat(mime, filename)
  if (format?.id === 'pdf') return 'book_pdf'
  if (format?.id === 'epub') return 'book_epub'
  if (format?.category === 'audio') return 'audio_chapter'
  return 'library_image'
}
