import { Router } from 'express'
import { z } from 'zod'
import type { AppContext } from '../../context.js'
import { requireAnyPermission, requirePermission } from '../../middleware/permissions.js'
import { idParam, pagination, parse, queryBool } from '../../validate.js'
import { cmsContext, contentSort, foreignKey, idsBody, optionalText, storageKey, workflowStatus } from './shared.js'

/**
 * Books, audiobook chapters and articles.
 *
 * Route guards check the *permission*; the service checks *ownership*, so an
 * author holding `books.edit` still only reaches their own rows.
 */

const BookInput = z.object({
  title: z.string().trim().min(1).max(500),
  description: optionalText,
  author_id: foreignKey,
  category_id: foreignKey,
  subcategory_id: foreignKey,
  language: z.string().trim().max(16).optional(),
  pages: z.number().int().min(0).nullable().optional(),
  publisher: z.string().trim().max(255).nullable().optional(),
  published_at: z.string().date().nullable().optional(),
  cover_key: storageKey,
  pdf_key: storageKey,
  epub_key: storageKey,
  og_image_key: storageKey,
  is_free: z.boolean().optional(),
  is_recommended: z.boolean().optional(),
  is_top: z.boolean().optional(),
  status: workflowStatus.optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
})

const ArticleInput = z.object({
  title: z.string().trim().min(1).max(500),
  excerpt: optionalText,
  content: z.string().max(16_000_000).optional(),
  author_id: foreignKey,
  category_id: foreignKey,
  subcategory_id: foreignKey,
  thumbnail_key: storageKey,
  audio_key: storageKey,
  og_image_key: storageKey,
  is_free: z.boolean().optional(),
  published_at: z.string().datetime({ offset: true }).nullable().optional(),
  status: workflowStatus.optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
})

const ChapterInput = z.object({
  chapter_number: z.number().int().min(1).optional(),
  title: z.string().trim().min(1).max(500),
  audio_key: z.string().trim().min(1).max(1024),
  duration_seconds: z.number().int().min(0).nullable().optional(),
  is_preview: z.boolean().optional(),
})

const listQuery = pagination.extend({
  q: z.string().trim().max(200).optional(),
  status: workflowStatus.optional(),
  author_id: z.coerce.number().int().positive().optional(),
  category_id: z.coerce.number().int().positive().optional(),
  free: queryBool,
  has_audio: queryBool,
  sort: contentSort,
})

const TransitionInput = z.object({
  status: workflowStatus,
  note: z.string().trim().max(500).nullable().optional(),
})

export function contentRouter(ctx: AppContext) {
  const router = Router()
  const content = ctx.services.cmsContent

  const toParams = (q: z.infer<typeof listQuery>) => ({
    page: q.page,
    limit: q.limit,
    q: q.q,
    status: q.status,
    authorId: q.author_id,
    categoryId: q.category_id,
    free: q.free,
    hasAudio: q.has_audio,
    sort: q.sort,
  })

  // ── Books ──────────────────────────────────────────────────────────────

  router.get('/books', requirePermission('books.view'), async (req, res) => {
    const q = parse(listQuery, req.query)
    const { rows, pagination: page } = await content.listBooks(cmsContext(req).actor, toParams(q))
    res.json({ status: 'ok', books: rows, pagination: page })
  })

  router.get('/books/:id', requirePermission('books.view'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    res.json({ status: 'ok', book: await content.getBook(cmsContext(req).actor, id) })
  })

  router.post('/books', requireAnyPermission('books.create', 'own_content.manage'), async (req, res) => {
    const book = await content.createBook(cmsContext(req), parse(BookInput, req.body))
    res.status(201).json({ status: 'ok', book })
  })

  router.patch('/books/:id', requireAnyPermission('books.edit', 'own_content.manage'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    const book = await content.updateBook(cmsContext(req), id, parse(BookInput.partial(), req.body))
    res.json({ status: 'ok', book })
  })

  router.delete('/books/:id', requireAnyPermission('books.delete', 'own_content.manage'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    await content.deleteBook(cmsContext(req), id)
    res.json({ status: 'ok' })
  })

  router.post('/books/:id/status', requireAnyPermission('books.edit', 'own_content.manage'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    const body = parse(TransitionInput, req.body)
    const result = await content.transition(cmsContext(req), 'book', id, body.status, body.note)
    res.json({ status: 'ok', book: result })
  })

  router.post('/books/bulk', requireAnyPermission('books.edit', 'own_content.manage'), async (req, res) => {
    const body = parse(idsBody.extend({ action: z.enum(['publish', 'archive', 'draft', 'delete']) }), req.body)
    res.json({ status: 'ok', ...(await content.bulk(cmsContext(req), 'book', body.ids, body.action)) })
  })

  // ── Audiobook chapters ─────────────────────────────────────────────────

  router.get('/books/:id/chapters', requirePermission('audiobooks.view'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    res.json({ status: 'ok', chapters: await content.listChapters(cmsContext(req).actor, id) })
  })

  router.post('/books/:id/chapters', requireAnyPermission('audiobooks.create', 'own_content.manage'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    const chapter = await content.createChapter(cmsContext(req), id, parse(ChapterInput, req.body))
    res.status(201).json({ status: 'ok', chapter })
  })

  router.put('/books/:id/chapters/order', requireAnyPermission('audiobooks.edit', 'own_content.manage'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    const { ids } = parse(idsBody, req.body)
    await content.reorderChapters(cmsContext(req), id, ids)
    res.json({ status: 'ok', chapters: await content.listChapters(cmsContext(req).actor, id) })
  })

  router.patch('/chapters/:id', requireAnyPermission('audiobooks.edit', 'own_content.manage'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    const chapter = await content.updateChapter(cmsContext(req), id, parse(ChapterInput.partial(), req.body))
    res.json({ status: 'ok', chapter })
  })

  router.delete('/chapters/:id', requireAnyPermission('audiobooks.delete', 'own_content.manage'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    await content.deleteChapter(cmsContext(req), id)
    res.json({ status: 'ok' })
  })

  // ── Articles ───────────────────────────────────────────────────────────

  router.get('/articles', requirePermission('articles.view'), async (req, res) => {
    const q = parse(listQuery, req.query)
    const { rows, pagination: page } = await content.listArticles(cmsContext(req).actor, toParams(q))
    res.json({ status: 'ok', articles: rows, pagination: page })
  })

  router.get('/articles/:id', requirePermission('articles.view'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    res.json({ status: 'ok', article: await content.getArticle(cmsContext(req).actor, id) })
  })

  router.post('/articles', requireAnyPermission('articles.create', 'own_content.manage'), async (req, res) => {
    const article = await content.createArticle(cmsContext(req), parse(ArticleInput, req.body))
    res.status(201).json({ status: 'ok', article })
  })

  router.patch('/articles/:id', requireAnyPermission('articles.edit', 'own_content.manage'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    const article = await content.updateArticle(cmsContext(req), id, parse(ArticleInput.partial(), req.body))
    res.json({ status: 'ok', article })
  })

  router.delete('/articles/:id', requireAnyPermission('articles.delete', 'own_content.manage'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    await content.deleteArticle(cmsContext(req), id)
    res.json({ status: 'ok' })
  })

  router.post('/articles/:id/status', requireAnyPermission('articles.edit', 'own_content.manage'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    const body = parse(TransitionInput, req.body)
    const result = await content.transition(cmsContext(req), 'article', id, body.status, body.note)
    res.json({ status: 'ok', article: result })
  })

  router.post('/articles/bulk', requireAnyPermission('articles.edit', 'own_content.manage'), async (req, res) => {
    const body = parse(idsBody.extend({ action: z.enum(['publish', 'archive', 'draft', 'delete']) }), req.body)
    res.json({ status: 'ok', ...(await content.bulk(cmsContext(req), 'article', body.ids, body.action)) })
  })

  // ── Version history ────────────────────────────────────────────────────
  // Registered once per entity: Express 5 no longer accepts an inline regex
  // such as `:entity(book|article)` in a route path.

  const versionParam = z.object({ id: z.coerce.number().int().positive(), version: z.coerce.number().int().positive() })

  for (const entity of ['book', 'article'] as const) {
    const base = `/${entity}s/:id/versions`
    const viewPermission = entity === 'book' ? 'books.view' : 'articles.view'
    const editPermission = entity === 'book' ? 'books.edit' : 'articles.edit'

    router.get(base, requirePermission(viewPermission), async (req, res) => {
      const { id } = parse(idParam, req.params)
      // Reading history is a read of the item itself: check ownership first.
      if (entity === 'book') await content.getBook(cmsContext(req).actor, id)
      else await content.getArticle(cmsContext(req).actor, id)
      res.json({ status: 'ok', versions: await content.listVersions(entity, id) })
    })

    router.get(`${base}/:version`, requirePermission(viewPermission), async (req, res) => {
      const { id, version } = parse(versionParam, req.params)
      res.json({ status: 'ok', version: await content.getVersion(cmsContext(req).actor, entity, id, version) })
    })

    router.post(`${base}/:version/restore`, requireAnyPermission(editPermission, 'own_content.manage'), async (req, res) => {
      const { id, version } = parse(versionParam, req.params)
      res.json({ status: 'ok', item: await content.restoreVersion(cmsContext(req), entity, id, version) })
    })
  }

  // ── Tags ───────────────────────────────────────────────────────────────

  router.get('/tags', requireAnyPermission('books.view', 'articles.view'), async (_req, res) => {
    res.json({ status: 'ok', tags: await content.listTags() })
  })

  return router
}
