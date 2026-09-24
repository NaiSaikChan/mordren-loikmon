import { Router } from 'express'
import { sql } from 'kysely'
import multer from 'multer'
import { z } from 'zod'
import type { Database } from '../../db/types.js'
import { serializePlans } from '../../domain/plans.js'
import { errors } from '../../lib/errors.js'
import { makeExcerpt } from '../../lib/text.js'
import { ASSET_CONTENT_TYPES, ASSET_VISIBILITY, type AssetKind } from '../../storage/storage.js'
import type { AppContext } from '../context.js'
import { requireAdmin, requireUser } from '../middleware/auth.js'
import { idParam, likePattern, pageInfo, pagination, parse } from '../validate.js'

const optionalText = z.string().trim().max(65_535).nullable().optional()
const key = z.string().trim().max(1024).nullable().optional()
const fk = z.number().int().positive().nullable().optional()

const BookInput = z.object({
  title: z.string().trim().min(1).max(500),
  description: optionalText,
  author_id: fk,
  category_id: fk,
  subcategory_id: fk,
  language: z.string().trim().max(16).optional(),
  pages: z.number().int().min(0).nullable().optional(),
  publisher: z.string().trim().max(255).nullable().optional(),
  published_at: z.string().date().nullable().optional(),
  cover_key: key,
  pdf_key: key,
  epub_key: key,
  is_free: z.boolean().optional(),
  is_published: z.boolean().optional(),
  is_recommended: z.boolean().optional(),
  is_top: z.boolean().optional(),
})

const ChapterInput = z.object({
  chapter_number: z.number().int().min(1),
  title: z.string().trim().min(1).max(500),
  audio_key: z.string().trim().min(1).max(1024),
  duration_seconds: z.number().int().min(0).nullable().optional(),
  is_preview: z.boolean().optional(),
})

const ArticleInput = z.object({
  title: z.string().trim().min(1).max(500),
  excerpt: optionalText,
  content: z.string().min(1).max(16_000_000),
  author_id: fk,
  category_id: fk,
  subcategory_id: fk,
  thumbnail_key: key,
  audio_key: key,
  is_free: z.boolean().optional(),
  is_published: z.boolean().optional(),
  published_at: z.string().datetime({ offset: true }).nullable().optional(),
})

const AuthorInput = z.object({
  name: z.string().trim().min(1).max(255),
  bio: optionalText,
  avatar_key: key,
  user_id: z.string().uuid().nullable().optional(),
  website: z.string().trim().max(1024).nullable().optional(),
  facebook: z.string().trim().max(1024).nullable().optional(),
  youtube: z.string().trim().max(1024).nullable().optional(),
  instagram: z.string().trim().max(1024).nullable().optional(),
  is_verified: z.boolean().optional(),
})

const CategoryInput = z.object({
  type: z.enum(['book', 'article', 'all']).default('all'),
  name: z.string().trim().min(1).max(255),
  parent_id: fk,
  thumbnail_key: key,
  display_order: z.number().int().optional(),
})

const CollectionInput = z.object({
  title: z.string().trim().min(1).max(255),
  description: optionalText,
  thumbnail_key: key,
  display_order: z.number().int().optional(),
  is_published: z.boolean().optional(),
})

const SliderInput = z.object({
  title: z.string().trim().max(255).nullable().optional(),
  image_key: z.string().trim().min(1).max(1024),
  link: z.string().trim().max(1024).nullable().optional(),
  display_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
})

const FaqInput = z.object({
  question: z.string().trim().min(1).max(5000),
  answer: z.string().trim().min(1).max(65_535),
  display_order: z.number().int().optional(),
  is_published: z.boolean().optional(),
})

const PlanUpdate = z
  .object({
    name: z.string().trim().min(1).max(64),
    description: z.string().trim().max(255).nullable(),
    price_cents: z.number().int().min(0),
    apple_product_id: z.string().trim().max(128).nullable(),
    google_product_id: z.string().trim().max(128).nullable(),
    google_base_plan_id: z.string().trim().max(64).nullable(),
    image_key: z.string().trim().max(1024).nullable(),
    display_order: z.number().int(),
    is_active: z.boolean(),
  })
  .partial()

type TableName = keyof Database

export function adminRouter(ctx: AppContext) {
  const router = Router()
  router.use(requireAdmin)
  const db = ctx.db
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: Math.min(ctx.config.storage.uploadMaxBytes, 100 * 1024 * 1024), files: 1 },
  })

  /** Delete replaced files from storage; failures are logged, never fatal. */
  async function cleanupReplacedKeys(before: Record<string, unknown>, after: Record<string, unknown>, columns: string[]) {
    for (const column of columns) {
      const oldKey = before[column]
      if (typeof oldKey === 'string' && oldKey && after[column] !== undefined && after[column] !== oldKey) {
        await ctx.storage.removeObject(oldKey).catch((err: unknown) => ctx.logger.warn({ err, key: oldKey }, 'failed to remove replaced object'))
      }
    }
  }

  /** Generic create / update / delete for simple tables with numeric ids. */
  function crud<S extends z.ZodObject>(
    path: string,
    table: TableName,
    schema: S,
    options: {
      fileColumns?: string[]
      create?: boolean
      transform?: (data: Record<string, unknown>, isCreate: boolean) => Record<string, unknown>
    } = {},
  ) {
    const anyDb = db as unknown as import('kysely').Kysely<Record<string, Record<string, unknown>>>
    const { fileColumns = [], transform } = options

    if (options.create !== false) {
      router.post(`/${path}`, async (req, res) => {
        let data = parse(schema, req.body) as Record<string, unknown>
        if (transform) data = transform(data, true)
        const result = await anyDb.insertInto(table).values(data).executeTakeFirstOrThrow()
        const row = await anyDb.selectFrom(table).selectAll().where('id', '=', Number(result.insertId)).executeTakeFirst()
        res.status(201).json({ status: 'ok', item: row })
      })
    }

    router.patch(`/${path}/:id`, async (req, res) => {
      const { id } = parse(idParam, req.params)
      let data = parse(schema.partial(), req.body) as Record<string, unknown>
      if (transform) data = transform(data, false)
      if (!Object.keys(data).length) throw errors.badRequest('Nothing to update')
      const before = await anyDb.selectFrom(table).selectAll().where('id', '=', id).executeTakeFirst()
      if (!before) throw errors.notFound(path)
      await anyDb.updateTable(table).set(data).where('id', '=', id).execute()
      await cleanupReplacedKeys(before, data, fileColumns)
      const row = await anyDb.selectFrom(table).selectAll().where('id', '=', id).executeTakeFirst()
      res.json({ status: 'ok', item: row })
    })

    router.delete(`/${path}/:id`, async (req, res) => {
      const { id } = parse(idParam, req.params)
      const before = await anyDb.selectFrom(table).selectAll().where('id', '=', id).executeTakeFirst()
      if (!before) throw errors.notFound(path)
      await anyDb.deleteFrom(table).where('id', '=', id).execute()
      await cleanupReplacedKeys(before, Object.fromEntries(fileColumns.map((c) => [c, null])), fileColumns)
      res.json({ status: 'ok' })
    })
  }

  // ── Content ────────────────────────────────────────────────────────────

  router.get('/books', async (req, res) => {
    const q = parse(pagination.extend({ q: z.string().trim().max(200).optional() }), req.query)
    const { rows, total } = await ctx.services.catalog.listBooks({ ...q, includeUnpublished: true })
    res.json({ status: 'ok', books: rows, pagination: pageInfo(q.page, q.limit, total) })
  })
  crud('books', 'books', BookInput, {
    fileColumns: ['cover_key', 'pdf_key', 'epub_key'],
    transform: (data) => ({
      ...data,
      ...(typeof data.published_at === 'string' ? { published_at: new Date(data.published_at) } : {}),
    }),
  })

  router.get('/books/:id/chapters', async (req, res) => {
    const { id } = parse(idParam, req.params)
    res.json({ status: 'ok', chapters: await ctx.services.catalog.getChapters(id) })
  })
  router.post('/books/:id/chapters', async (req, res) => {
    const { id } = parse(idParam, req.params)
    const data = parse(ChapterInput, req.body)
    if (!(await db.selectFrom('books').select('id').where('id', '=', id).executeTakeFirst())) throw errors.notFound('Book')
    const result = await db.insertInto('book_audio_chapters').values({ ...data, book_id: id }).executeTakeFirstOrThrow()
    res.status(201).json({ status: 'ok', id: Number(result.insertId) })
  })
  // Chapters are created under their book (above); only update/delete here.
  crud('chapters', 'book_audio_chapters', ChapterInput, { fileColumns: ['audio_key'], create: false })

  router.get('/articles', async (req, res) => {
    const q = parse(pagination.extend({ q: z.string().trim().max(200).optional() }), req.query)
    const { rows, total } = await ctx.services.catalog.listArticles({ ...q, includeUnpublished: true })
    res.json({ status: 'ok', articles: rows, pagination: pageInfo(q.page, q.limit, total) })
  })
  crud('articles', 'articles', ArticleInput, {
    fileColumns: ['thumbnail_key', 'audio_key'],
    transform: (data, isCreate) => {
      const out = { ...data }
      if (typeof out.published_at === 'string') out.published_at = new Date(out.published_at)
      if (isCreate && out.published_at === undefined) out.published_at = new Date()
      if (typeof out.content === 'string' && !out.excerpt) out.excerpt = makeExcerpt(out.content)
      return out
    },
  })

  crud('authors', 'authors', AuthorInput, { fileColumns: ['avatar_key'] })
  crud('categories', 'categories', CategoryInput, { fileColumns: ['thumbnail_key'] })
  crud('collections', 'collections', CollectionInput, { fileColumns: ['thumbnail_key'] })
  crud('sliders', 'sliders', SliderInput, { fileColumns: ['image_key'] })
  crud('faqs', 'faqs', FaqInput)

  router.put('/collections/:id/items', async (req, res) => {
    const { id } = parse(idParam, req.params)
    const { items } = parse(
      z.object({ items: z.array(z.object({ item_type: z.enum(['book', 'article']), item_id: z.number().int().positive() })).max(500) }),
      req.body,
    )
    await db.transaction().execute(async (trx) => {
      await trx.deleteFrom('collection_items').where('collection_id', '=', id).execute()
      if (items.length) {
        await trx
          .insertInto('collection_items')
          .ignore()
          .values(items.map((item, position) => ({ collection_id: id, ...item, position })))
          .execute()
      }
    })
    res.json({ status: 'ok', count: items.length })
  })

  router.post('/notifications', async (req, res) => {
    const body = parse(
      z.object({
        user_id: z.string().uuid().nullable().default(null),
        type: z.string().trim().min(1).max(32).default('announcement'),
        title: z.string().trim().min(1).max(255),
        message: z.string().trim().max(5000).nullable().default(null),
        data: z.record(z.string(), z.unknown()).nullable().default(null),
      }),
      req.body,
    )
    const result = await db
      .insertInto('notifications')
      .values({ ...body, data: body.data ? JSON.stringify(body.data) : null })
      .executeTakeFirstOrThrow()
    res.status(201).json({ status: 'ok', id: Number(result.insertId) })
  })

  // ── Uploads (MinIO) ────────────────────────────────────────────────────

  const assetKind = z.enum(Object.keys(ASSET_VISIBILITY) as [AssetKind, ...AssetKind[]])

  function assertContentType(kind: AssetKind, contentType: string) {
    if (!ASSET_CONTENT_TYPES[kind].includes(contentType)) {
      throw errors.validation([{ path: 'content_type', message: `Allowed types for ${kind}: ${ASSET_CONTENT_TYPES[kind].join(', ')}` }])
    }
  }

  /** Large files (books, audio): the browser PUTs directly to MinIO with this URL, then saves `key` on the record. */
  router.post('/uploads/presign', async (req, res) => {
    const body = parse(z.object({ kind: assetKind, content_type: z.string().min(1).max(128), filename: z.string().max(255).optional() }), req.body)
    assertContentType(body.kind, body.content_type)
    const presigned = await ctx.storage.presignUpload(body.kind, body.content_type, body.filename)
    res.json({ status: 'ok', upload: presigned, public_url: ASSET_VISIBILITY[body.kind] === 'public' ? ctx.storage.publicUrl(presigned.key) : null })
  })

  /** Small files (images) through the API. */
  router.post('/uploads', upload.single('file'), async (req, res) => {
    const { kind } = parse(z.object({ kind: assetKind }), req.body)
    const file = req.file
    if (!file) throw errors.validation([{ path: 'file', message: 'File is required' }])
    assertContentType(kind, file.mimetype)
    const objectKey = await ctx.storage.putObject(kind, file.buffer, file.size, file.mimetype, file.originalname)
    res.status(201).json({ status: 'ok', key: objectKey, public_url: ASSET_VISIBILITY[kind] === 'public' ? ctx.storage.publicUrl(objectKey) : null })
  })

  // ── Plans, users, subscriptions ────────────────────────────────────────

  router.get('/plans', async (_req, res) => {
    res.json({ status: 'ok', plans: serializePlans(await ctx.services.subscriptions.listPlans({ includeInactive: true }), (key) => ctx.storage.publicUrl(key)) })
  })

  router.patch('/plans/:code', async (req, res) => {
    const { code } = parse(z.object({ code: z.string().max(32) }), req.params)
    const data = parse(PlanUpdate, req.body)
    const result = await db.updateTable('subscription_plans').set(data).where('code', '=', code).executeTakeFirst()
    if (!Number(result.numUpdatedRows) && !(await db.selectFrom('subscription_plans').select('code').where('code', '=', code).executeTakeFirst())) {
      throw errors.notFound('Plan')
    }
    res.json({ status: 'ok' })
  })

  router.get('/users', async (req, res) => {
    const q = parse(pagination.extend({ q: z.string().trim().max(200).optional() }), req.query)
    let query = db.selectFrom('users').select(['id', 'email', 'name', 'role', 'email_verified', 'created_at'])
    let count = db.selectFrom('users').select((eb) => eb.fn.countAll().as('total'))
    if (q.q) {
      const pattern = likePattern(q.q)
      query = query.where(sql<boolean>`(email LIKE ${pattern} OR name LIKE ${pattern})`)
      count = count.where(sql<boolean>`(email LIKE ${pattern} OR name LIKE ${pattern})`)
    }
    const [users, total] = await Promise.all([
      query.orderBy('created_at', 'desc').limit(q.limit).offset((q.page - 1) * q.limit).execute(),
      count.executeTakeFirst(),
    ])
    res.json({ status: 'ok', users, pagination: pageInfo(q.page, q.limit, Number(total?.total ?? 0)) })
  })

  router.get('/users/:userId', async (req, res) => {
    const { userId } = parse(z.object({ userId: z.string().uuid() }), req.params)
    const user = await db.selectFrom('users').select(['id', 'email', 'name', 'role', 'email_verified', 'created_at']).where('id', '=', userId).executeTakeFirst()
    if (!user) throw errors.notFound('User')
    const [subscriptions, grants, entitlement] = await Promise.all([
      ctx.services.subscriptions.listUserSubscriptions(userId),
      db.selectFrom('entitlement_grants').selectAll().where('user_id', '=', userId).orderBy('created_at', 'desc').execute(),
      ctx.services.subscriptions.getEntitlement(userId, user.role),
    ])
    res.json({ status: 'ok', user, entitlement, subscriptions, grants })
  })

  router.patch('/users/:userId/role', async (req, res) => {
    const { userId } = parse(z.object({ userId: z.string().uuid() }), req.params)
    const { role } = parse(z.object({ role: z.enum(['user', 'admin']) }), req.body)
    if (userId === requireUser(req).id && role !== 'admin') throw errors.badRequest('You cannot remove your own admin role')
    await db.updateTable('users').set({ role }).where('id', '=', userId).execute()
    res.json({ status: 'ok' })
  })

  router.post('/users/:userId/grants', async (req, res) => {
    const { userId } = parse(z.object({ userId: z.string().uuid() }), req.params)
    const body = parse(z.object({ reason: z.string().trim().min(1).max(255), expires_at: z.string().datetime({ offset: true }).nullable() }), req.body)
    if (!(await db.selectFrom('users').select('id').where('id', '=', userId).executeTakeFirst())) throw errors.notFound('User')
    const id = await ctx.services.subscriptions.grantAccess({
      userId,
      reason: body.reason,
      expiresAt: body.expires_at ? new Date(body.expires_at) : null,
      grantedBy: requireUser(req).id,
    })
    res.status(201).json({ status: 'ok', id })
  })

  router.delete('/grants/:id', async (req, res) => {
    const { id } = parse(idParam, req.params)
    if (!(await ctx.services.subscriptions.revokeGrant(id))) throw errors.notFound('Active grant')
    res.json({ status: 'ok' })
  })

  router.post('/jobs/reconcile', async (_req, res) => {
    const result = await ctx.services.subscriptions.reconcile({ limit: 500 })
    res.json({ status: 'ok', ...result })
  })

  router.get('/subscription-events', async (req, res) => {
    const q = parse(pagination.extend({ subscription_id: z.string().uuid().optional() }), req.query)
    let query = db.selectFrom('subscription_events').selectAll().orderBy('id', 'desc').limit(q.limit).offset((q.page - 1) * q.limit)
    if (q.subscription_id) query = query.where('subscription_id', '=', q.subscription_id)
    res.json({ status: 'ok', events: await query.execute() })
  })

  return router
}
