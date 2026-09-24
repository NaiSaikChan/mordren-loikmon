import { Router, type Request } from 'express'
import { z } from 'zod'
import { resolveAccess } from '../../domain/access.js'
import { errors } from '../../lib/errors.js'
import type { AppContext } from '../context.js'
import { getEntitlement, requireAuth, requireUser } from '../middleware/auth.js'
import {
  serializeAccess,
  serializeArticle,
  serializeAuthor,
  serializeBook,
  serializeCategory,
  serializeChapter,
  serializeCollectionSummary,
  serializeSlider,
} from '../serializers.js'
import { idParam, pageInfo, pagination, parse, queryBool } from '../validate.js'

const itemType = z.enum(['book', 'article'])

const BookQuery = pagination.extend({
  q: z.string().trim().max(200).optional(),
  category: z.coerce.number().int().positive().optional(),
  subcategory: z.coerce.number().int().positive().optional(),
  author: z.coerce.number().int().positive().optional(),
  free: queryBool,
  has_audio: queryBool,
  recommended: queryBool,
  top: queryBool,
  sort: z.enum(['latest', 'popular', 'rating', 'title']).default('latest'),
})

const ArticleQuery = pagination.extend({
  q: z.string().trim().max(200).optional(),
  category: z.coerce.number().int().positive().optional(),
  author: z.coerce.number().int().positive().optional(),
  free: queryBool,
  sort: z.enum(['latest', 'popular']).default('latest'),
})

/** Remember recent views per client so reloading a page does not inflate counters. */
class ViewThrottle {
  private readonly seen = new Map<string, number>()
  constructor(private readonly windowMs = 30 * 60_000, private readonly maxEntries = 50_000) {}

  shouldCount(key: string, now = Date.now()): boolean {
    const last = this.seen.get(key)
    if (last && now - last < this.windowMs) return false
    if (this.seen.size >= this.maxEntries) {
      for (const [k, t] of this.seen) if (now - t >= this.windowMs) this.seen.delete(k)
      if (this.seen.size >= this.maxEntries) this.seen.clear()
    }
    this.seen.set(key, now)
    return true
  }
}

export function catalogRouter(ctx: AppContext) {
  const router = Router()
  const { catalog, engagement } = ctx.services
  const views = new ViewThrottle()

  async function accessFor(req: Request, isFree: boolean) {
    return resolveAccess({ isFree, isAuthenticated: Boolean(req.user), entitlement: await getEntitlement(ctx, req) })
  }

  function denyUnlessGranted(decision: ReturnType<typeof resolveAccess>) {
    if (decision.granted) return
    throw decision.reason === 'login_required' ? errors.loginRequired() : errors.subscriptionRequired()
  }

  // ── Home ───────────────────────────────────────────────────────────────

  router.get('/home', async (req, res) => {
    const entitlement = await getEntitlement(ctx, req)
    const [sliders, latest, popular, recommended, audio, articles, authors] = await Promise.all([
      catalog.listSliders({ isAuthenticated: Boolean(req.user), isSubscribed: entitlement?.active === true, placement: 'home' }),
      // Latest Books is the public home section and must exclude premium content.
      catalog.listBooks({ page: 1, limit: 12, sort: 'latest', free: true }),
      catalog.listBooks({ page: 1, limit: 12, sort: 'popular', free: true  }),
      catalog.listBooks({ page: 1, limit: 12, recommended: true, sort: 'latest', free: true }),
      catalog.listBooks({ page: 1, limit: 12, hasAudio: true, sort: 'latest', free: true }),
      catalog.listArticles({ page: 1, limit: 10, free: true }),
      catalog.listAuthors({ page: 1, limit: 12 }),
    ])
    const books = (rows: typeof latest.rows) => rows.map((b) => serializeBook(b, ctx.storage))
    res.json({
      status: 'ok',
      sliders: sliders.map((s) => serializeSlider(s, ctx.storage)),
      latest_books: books(latest.rows),
      popular_books: books(popular.rows),
      recommended_books: books(recommended.rows),
      audio_books: books(audio.rows),
      books: books(latest.rows),
      articles: articles.rows.map((a) => serializeArticle(a, ctx.storage)),
      authors: authors.rows.map((a) => serializeAuthor(a, ctx.storage)),
    })
  })

  // ── Books ──────────────────────────────────────────────────────────────

  router.get('/books', async (req, res) => {
    const q = parse(BookQuery, req.query)
    const { rows, total } = await catalog.listBooks({
      page: q.page,
      limit: q.limit,
      q: q.q,
      category: q.category,
      subcategory: q.subcategory,
      author: q.author,
      free: q.free,
      hasAudio: q.has_audio,
      recommended: q.recommended,
      top: q.top,
      sort: q.sort,
    })
    res.json({ status: 'ok', books: rows.map((b) => serializeBook(b, ctx.storage)), total, pagination: pageInfo(q.page, q.limit, total) })
  })

  router.get('/books/:id', async (req, res) => {
    const { id } = parse(idParam, req.params)
    const book = await catalog.getBook(id)
    if (!book) throw errors.notFound('Book')
    const access = await accessFor(req, book.is_free)
    const inLibrary = req.user ? await engagement.isInLibrary(req.user.id, 'book', id) : false
    res.json({ status: 'ok', book: { ...serializeBook(book, ctx.storage), access: serializeAccess(access), in_library: inLibrary } })
  })

  router.get('/books/:id/related', async (req, res) => {
    const { id } = parse(idParam, req.params)
    const book = await catalog.getBook(id)
    if (!book) throw errors.notFound('Book')
    const related = await catalog.relatedBooks(book)
    res.json({ status: 'ok', books: related.map((b) => serializeBook(b, ctx.storage)) })
  })

  /** Short-lived URL for the book file. The only way to obtain a PDF/EPUB. */
  router.get('/books/:id/file', async (req, res) => {
    const { id } = parse(idParam, req.params)
    const { format } = parse(z.object({ format: z.enum(['pdf', 'epub']).optional() }), req.query)
    const book = await catalog.getBook(id)
    if (!book) throw errors.notFound('Book')
    denyUnlessGranted(await accessFor(req, book.is_free))

    const chosen = format ?? (book.epub_key ? 'epub' : 'pdf')
    const key = chosen === 'epub' ? book.epub_key : book.pdf_key
    if (!key) throw errors.notFound(`${chosen.toUpperCase()} file for this book`)
    const { url, expiresAt } = await ctx.storage.signedUrl(key, { downloadName: `${book.title}.${chosen}` })
    res.set('Cache-Control', 'private, no-store')
    res.json({ status: 'ok', format: chosen, url, expires_at: expiresAt.toISOString() })
  })

  router.get('/books/:id/chapters', async (req, res) => {
    const { id } = parse(idParam, req.params)
    const book = await catalog.getBook(id)
    if (!book) throw errors.notFound('Book')
    const access = await accessFor(req, book.is_free)
    const chapters = await catalog.getChapters(id)
    const items = await Promise.all(
      chapters.map(async (chapter) => {
        const open = access.granted || chapter.is_preview
        const audio = open ? await ctx.storage.signedUrl(chapter.audio_key) : null
        return serializeChapter(chapter, { locked: !open, audio_url: audio?.url ?? null, audio_expires_at: audio?.expiresAt.toISOString() ?? null })
      }),
    )
    res.set('Cache-Control', 'private, no-store')
    res.json({ status: 'ok', book_id: id, access: serializeAccess(access), chapters: items })
  })

  router.post('/books/:id/views', async (req, res) => {
    const { id } = parse(idParam, req.params)
    if (views.shouldCount(`${req.user?.id ?? req.ip}:book:${id}`)) await catalog.incrementViews('book', id)
    res.status(204).end()
  })

  router.get('/books/:id/progress', requireAuth, async (req, res) => {
    const { id } = parse(idParam, req.params)
    res.json({ status: 'ok', progress: await engagement.getProgress(requireUser(req).id, id) })
  })

  router.put('/books/:id/progress', requireAuth, async (req, res) => {
    const { id } = parse(idParam, req.params)
    const body = parse(
      z.object({
        format: z.enum(['pdf', 'epub', 'audio']),
        location: z.string().max(2048).nullable().default(null),
        progress: z.number().min(0).max(100),
      }),
      req.body,
    )
    if (!(await catalog.itemExists('book', id))) throw errors.notFound('Book')
    await engagement.saveProgress({ userId: requireUser(req).id, bookId: id, ...body })
    res.json({ status: 'ok' })
  })

  // ── Articles ───────────────────────────────────────────────────────────

  router.get('/articles', async (req, res) => {
    const q = parse(ArticleQuery, req.query)
    const { rows, total } = await catalog.listArticles(q)
    res.json({
      status: 'ok',
      articles: rows.map((a) => serializeArticle(a, ctx.storage)),
      total,
      pagination: pageInfo(q.page, q.limit, total),
    })
  })

  /** Full article body and audio are included only when the viewer has access. */
  router.get('/articles/:id', async (req, res) => {
    const { id } = parse(idParam, req.params)
    const article = await catalog.getArticle(id)
    if (!article) throw errors.notFound('Article')
    const access = await accessFor(req, article.is_free)
    const audio = access.granted && article.audio_key ? await ctx.storage.signedUrl(article.audio_key) : null
    const inLibrary = req.user ? await engagement.isInLibrary(req.user.id, 'article', id) : false
    res.set('Cache-Control', 'private, no-store')
    res.json({
      status: 'ok',
      article: {
        ...serializeArticle(article, ctx.storage),
        content: access.granted ? article.content : null,
        locked: !access.granted,
        audio_url: audio?.url ?? null,
        audio_expires_at: audio?.expiresAt.toISOString() ?? null,
        access: serializeAccess(access),
        in_library: inLibrary,
      },
    })
  })

  router.post('/articles/:id/views', async (req, res) => {
    const { id } = parse(idParam, req.params)
    if (views.shouldCount(`${req.user?.id ?? req.ip}:article:${id}`)) await catalog.incrementViews('article', id)
    res.status(204).end()
  })

  // ── Authors ────────────────────────────────────────────────────────────

  router.get('/authors', async (req, res) => {
    const q = parse(pagination.extend({ q: z.string().trim().max(200).optional() }), req.query)
    const { rows, total } = await catalog.listAuthors(q)
    const followed = req.user ? new Set(await engagement.followedAuthorIds(req.user.id)) : new Set<number>()
    res.json({
      status: 'ok',
      authors: rows.map((a) => serializeAuthor(a, ctx.storage, { is_following: followed.has(a.id) })),
      total,
      pagination: pageInfo(q.page, q.limit, total),
    })
  })

  router.get('/authors/:id', async (req, res) => {
    const { id } = parse(idParam, req.params)
    const author = await catalog.getAuthor(id)
    if (!author) throw errors.notFound('Author')
    const following = req.user ? await engagement.isFollowing(req.user.id, id) : false
    const [books, articles] = await Promise.all([
      catalog.listBooks({ page: 1, limit: 50, author: id }),
      catalog.listArticles({ page: 1, limit: 50, author: id }),
    ])
    res.json({
      status: 'ok',
      author: serializeAuthor(author, ctx.storage, { is_following: following }),
      books: books.rows.map((b) => serializeBook(b, ctx.storage)),
      articles: articles.rows.map((a) => serializeArticle(a, ctx.storage)),
    })
  })

  router.put('/authors/:id/follow', requireAuth, async (req, res) => {
    const { id } = parse(idParam, req.params)
    if (!(await catalog.getAuthor(id))) throw errors.notFound('Author')
    res.json({ status: 'ok', ...(await engagement.setFollowing(requireUser(req).id, id, true)) })
  })

  router.delete('/authors/:id/follow', requireAuth, async (req, res) => {
    const { id } = parse(idParam, req.params)
    res.json({ status: 'ok', ...(await engagement.setFollowing(requireUser(req).id, id, false)) })
  })

  // ── Categories & collections ───────────────────────────────────────────

  router.get('/categories', async (req, res) => {
    const { type } = parse(z.object({ type: itemType.optional() }), req.query)
    const rows = await catalog.listCategories(type)
    res.json({ status: 'ok', categories: rows.map((c) => serializeCategory(c, ctx.storage)) })
  })

  router.get('/categories/:id', async (req, res) => {
    const { id } = parse(idParam, req.params)
    const category = await catalog.getCategory(id)
    if (!category) throw errors.notFound('Category')
    const q = parse(pagination, req.query)
    const [books, articles] = await Promise.all([
      catalog.listBooks({ page: q.page, limit: q.limit, category: id }),
      catalog.listArticles({ page: q.page, limit: q.limit, category: id }),
    ])
    res.json({
      status: 'ok',
      category: serializeCategory(category, ctx.storage),
      books: books.rows.map((b) => serializeBook(b, ctx.storage)),
      articles: articles.rows.map((a) => serializeArticle(a, ctx.storage)),
      books_total: books.total,
      articles_total: articles.total,
    })
  })

  router.get('/collections', async (req, res) => {
    const q = parse(pagination, req.query)
    const { rows, total } = await catalog.listCollections(q.page, q.limit)
    res.json({
      status: 'ok',
      collections: rows.map((c) => ({ ...serializeCollectionSummary(c, ctx.storage), items_count: Number(c.items_count ?? 0) })),
      total,
      pagination: pageInfo(q.page, q.limit, total),
    })
  })

  router.get('/collections/:id', async (req, res) => {
    const { id } = parse(idParam, req.params)
    const found = await catalog.getCollection(id)
    if (!found) throw errors.notFound('Collection')
    const { collection, books, articles } = found
    res.json({
      status: 'ok',
      collection: {
        ...serializeCollectionSummary(collection, ctx.storage),
        books: books.map((b) => serializeBook(b, ctx.storage)),
        articles: articles.map((a) => serializeArticle(a, ctx.storage)),
      },
    })
  })

  // ── Search, FAQ, notifications ─────────────────────────────────────────

  router.get('/search', async (req, res) => {
    const q = parse(
      pagination.extend({ q: z.string().trim().min(1).max(200), type: z.enum(['all', 'book', 'article', 'author']).default('all') }),
      req.query,
    )
    const want = (t: string) => q.type === 'all' || q.type === t
    const empty = { rows: [], total: 0 }
    const [books, articles, authors] = await Promise.all([
      want('book') ? catalog.listBooks({ page: q.page, limit: q.limit, q: q.q, sort: 'popular' }) : empty,
      want('article') ? catalog.listArticles({ page: q.page, limit: q.limit, q: q.q, sort: 'popular' }) : empty,
      want('author') ? catalog.listAuthors({ page: q.page, limit: q.limit, q: q.q }) : empty,
    ])
    res.json({
      status: 'ok',
      query: q.q,
      books: books.rows.map((b) => serializeBook(b as never, ctx.storage)),
      articles: articles.rows.map((a) => serializeArticle(a as never, ctx.storage)),
      authors: authors.rows.map((a) => serializeAuthor(a as never, ctx.storage)),
      totals: { books: books.total, articles: articles.total, authors: authors.total },
    })
  })

  router.get('/faqs', async (_req, res) => {
    const faqs = await catalog.listFaqs()
    res.json({ status: 'ok', faqs: faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer })) })
  })

  router.get('/notifications', async (req, res) => {
    const rows = await engagement.listNotifications(req.user?.id ?? null)
    res.json({
      status: 'ok',
      notifications: rows.map((n) => ({ id: n.id, type: n.type, title: n.title, message: n.message, data: n.data, created_at: n.created_at })),
    })
  })

  // ── Reviews ────────────────────────────────────────────────────────────

  router.get('/reviews', async (req, res) => {
    const q = parse(pagination.extend({ item_type: itemType, item_id: z.coerce.number().int().positive() }), req.query)
    const result = await engagement.listReviews({ itemType: q.item_type, itemId: q.item_id, page: q.page, limit: q.limit, viewerId: req.user?.id })
    const toDto = (r: (typeof result.rows)[number]) => ({
      id: r.id,
      user_id: r.user_id,
      username: r.user_name,
      author_name: r.user_name,
      avatar: ctx.storage.publicUrl(r.user_image),
      rating: r.rating,
      content: r.content ?? '',
      comment: r.content ?? '',
      created_at: r.created_at,
      updated_at: r.updated_at,
    })
    res.json({
      status: 'ok',
      reviews: result.rows.map(toDto),
      user_review: result.own ? toDto(result.own) : null,
      summary: { average: result.average, count: result.total },
      pagination: pageInfo(q.page, q.limit, result.total),
    })
  })

  router.post('/reviews', requireAuth, async (req, res) => {
    const body = parse(
      z.object({
        item_type: itemType,
        item_id: z.number().int().positive(),
        rating: z.number().int().min(1).max(5),
        content: z.string().trim().max(5000).nullable().default(null),
      }),
      req.body,
    )
    if (!(await catalog.itemExists(body.item_type, body.item_id))) throw errors.notFound(body.item_type === 'book' ? 'Book' : 'Article')
    if (!(await ctx.services.settings.flag('features.reviews_enabled', true))) {
      throw errors.serviceUnavailable('Reviews are currently disabled')
    }
    // With moderation on, a new review waits in the CMS queue instead of
    // appearing straight away; the author still sees their own.
    const needsApproval = await ctx.services.settings.flag('features.reviews_require_approval', false)
    const review = await engagement.upsertReview({
      userId: requireUser(req).id,
      itemType: body.item_type,
      itemId: body.item_id,
      rating: body.rating,
      content: body.content || null,
      status: needsApproval ? 'pending' : 'published',
    })
    res.status(201).json({
      status: 'ok',
      pending_moderation: needsApproval,
      review: {
        id: review.id,
        rating: review.rating,
        content: review.content ?? '',
        username: review.user_name,
        status: review.status,
        created_at: review.created_at,
      },
    })
  })

  router.delete('/reviews/:id', requireAuth, async (req, res) => {
    const { id } = parse(idParam, req.params)
    const user = requireUser(req)
    await engagement.deleteReview({ reviewId: id, userId: user.id, isAdmin: user.role === 'admin' })
    res.json({ status: 'ok' })
  })

  // ── Library ────────────────────────────────────────────────────────────

  router.get('/library', requireAuth, async (req, res) => {
    const items = await engagement.listLibrary(requireUser(req).id)
    const bookIds = items.filter((i) => i.item_type === 'book').map((i) => i.item_id)
    const articleIds = items.filter((i) => i.item_type === 'article').map((i) => i.item_id)
    const [books, articles] = await Promise.all([
      catalog.listBooks({ page: 1, limit: 100, ids: bookIds }),
      catalog.listArticles({ page: 1, limit: 100, ids: articleIds }),
    ])
    res.json({
      status: 'ok',
      books: books.rows.map((b) => serializeBook(b, ctx.storage)),
      articles: articles.rows.map((a) => serializeArticle(a, ctx.storage)),
    })
  })

  router.put('/library/:type/:id', requireAuth, async (req, res) => {
    const { type, id } = parse(z.object({ type: itemType, id: z.coerce.number().int().positive() }), req.params)
    if (!(await catalog.itemExists(type, id))) throw errors.notFound(type === 'book' ? 'Book' : 'Article')
    await engagement.addToLibrary(requireUser(req).id, type, id)
    res.json({ status: 'ok', in_library: true })
  })

  router.delete('/library/:type/:id', requireAuth, async (req, res) => {
    const { type, id } = parse(z.object({ type: itemType, id: z.coerce.number().int().positive() }), req.params)
    await engagement.removeFromLibrary(requireUser(req).id, type, id)
    res.json({ status: 'ok', in_library: false })
  })

  return router
}
