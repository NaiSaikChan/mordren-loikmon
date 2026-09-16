import { sql, type ExpressionBuilder, type Kysely, type SelectQueryBuilder } from 'kysely'
import type { Database, ItemType } from '../db/types.js'
import { likePattern } from '../http/validate.js'

/**
 * Read side of the catalogue: listing, filtering and search over books,
 * articles, authors, categories and collections. No access control happens
 * here — routes combine these rows with the viewer's entitlement.
 */

export interface BookRow {
  id: number
  title: string
  description: string | null
  author_id: number | null
  category_id: number | null
  subcategory_id: number | null
  language: string
  pages: number | null
  publisher: string | null
  published_at: Date | null
  cover_key: string | null
  pdf_key: string | null
  epub_key: string | null
  is_free: boolean
  is_published: boolean
  is_recommended: boolean
  is_top: boolean
  view_count: number
  rating_avg: number
  rating_count: number
  created_at: Date
  updated_at: Date
  author_name: string | null
  category_name: string | null
  subcategory_name: string | null
  audio_chapters_count: number | string | null
  audio_duration_seconds: number | string | null
}

export interface ArticleRow {
  id: number
  title: string
  excerpt: string | null
  author_id: number | null
  category_id: number | null
  subcategory_id: number | null
  thumbnail_key: string | null
  audio_key: string | null
  is_free: boolean
  is_published: boolean
  view_count: number
  rating_avg: number
  rating_count: number
  published_at: Date | null
  created_at: Date
  updated_at: Date
  author_name: string | null
  category_name: string | null
}

export interface ArticleDetailRow extends ArticleRow {
  content: string
}

export interface AuthorRow {
  id: number
  name: string
  bio: string | null
  avatar_key: string | null
  website: string | null
  facebook: string | null
  youtube: string | null
  instagram: string | null
  is_verified: boolean
  created_at: Date
  books_count: number | string | null
  articles_count: number | string | null
  followers_count: number | string | null
}

export interface CategoryRow {
  id: number
  type: ItemType | 'all'
  name: string
  parent_id: number | null
  thumbnail_key: string | null
  display_order: number
  books_count: number | string | null
  articles_count: number | string | null
}

export interface ChapterRow {
  id: number
  book_id: number
  chapter_number: number
  title: string
  audio_key: string
  duration_seconds: number | null
  is_preview: boolean
}

export type BookSort = 'latest' | 'popular' | 'rating' | 'title'

export interface BookFilters {
  page: number
  limit: number
  q?: string
  category?: number
  subcategory?: number
  author?: number
  free?: boolean
  hasAudio?: boolean
  recommended?: boolean
  top?: boolean
  sort?: BookSort
  ids?: number[]
  includeUnpublished?: boolean
}

export interface ArticleFilters {
  page: number
  limit: number
  q?: string
  category?: number
  author?: number
  free?: boolean
  sort?: 'latest' | 'popular'
  ids?: number[]
  includeUnpublished?: boolean
}

type Q<O> = SelectQueryBuilder<Database, never, O>

export class CatalogService {
  constructor(private readonly db: Kysely<Database>) {}

  // ── Books ──────────────────────────────────────────────────────────────

  private bookBase() {
    return this.db
      .selectFrom('books as b')
      .leftJoin('authors as a', 'a.id', 'b.author_id')
      .leftJoin('categories as c', 'c.id', 'b.category_id')
      .leftJoin('categories as sc', 'sc.id', 'b.subcategory_id')
  }

  private selectBookColumns<T extends ReturnType<CatalogService['bookBase']>>(query: T) {
    return query
      .select([
        'b.id',
        'b.title',
        'b.description',
        'b.author_id',
        'b.category_id',
        'b.subcategory_id',
        'b.language',
        'b.pages',
        'b.publisher',
        'b.published_at',
        'b.cover_key',
        'b.pdf_key',
        'b.epub_key',
        'b.is_free',
        'b.is_published',
        'b.is_recommended',
        'b.is_top',
        'b.view_count',
        'b.rating_avg',
        'b.rating_count',
        'b.created_at',
        'b.updated_at',
        'a.name as author_name',
        'c.name as category_name',
        'sc.name as subcategory_name',
      ])
      .select((eb) => [
        eb
          .selectFrom('book_audio_chapters as ch')
          .whereRef('ch.book_id', '=', 'b.id')
          .select(eb.fn.countAll().as('n'))
          .as('audio_chapters_count'),
        eb
          .selectFrom('book_audio_chapters as ch')
          .whereRef('ch.book_id', '=', 'b.id')
          .select(sql<number>`COALESCE(SUM(ch.duration_seconds), 0)`.as('d'))
          .as('audio_duration_seconds'),
      ])
  }

  private applyBookFilters<O>(query: Q<O>, f: Omit<BookFilters, 'page' | 'limit' | 'sort'>): Q<O> {
    // The builder's table set is erased in Q<O>; filters reference the aliases used in bookBase().
    let q = query as unknown as SelectQueryBuilder<Database & { b: Database['books'] }, 'b', O>
    if (!f.includeUnpublished) q = q.where('b.is_published', '=', true)
    if (f.category) q = q.where((eb) => eb.or([eb('b.category_id', '=', f.category!), eb('b.subcategory_id', '=', f.category!)]))
    if (f.subcategory) q = q.where('b.subcategory_id', '=', f.subcategory)
    if (f.author) q = q.where('b.author_id', '=', f.author)
    if (f.free !== undefined) q = q.where('b.is_free', '=', f.free)
    if (f.recommended) q = q.where('b.is_recommended', '=', true)
    if (f.top) q = q.where('b.is_top', '=', true)
    if (f.ids) q = f.ids.length ? q.where('b.id', 'in', f.ids) : q.where(sql<boolean>`FALSE`)
    if (f.hasAudio !== undefined) {
      const exists = (eb: ExpressionBuilder<Database & { b: Database['books'] }, 'b'>) =>
        eb.exists(eb.selectFrom('book_audio_chapters as ch').select('ch.id').whereRef('ch.book_id', '=', 'b.id'))
      q = f.hasAudio ? q.where(exists) : q.where((eb) => eb.not(exists(eb)))
    }
    if (f.q) {
      const pattern = likePattern(f.q)
      q = q.where(sql<boolean>`(b.title LIKE ${pattern} OR b.description LIKE ${pattern})`)
    }
    return q as unknown as Q<O>
  }

  async listBooks(filters: BookFilters): Promise<{ rows: BookRow[]; total: number }> {
    const sortColumn = {
      latest: sql`b.created_at DESC, b.id DESC`,
      popular: sql`b.view_count DESC, b.id DESC`,
      rating: sql`b.rating_avg DESC, b.rating_count DESC, b.id DESC`,
      title: sql`b.title ASC, b.id ASC`,
    }[filters.sort ?? 'latest']

    const rowsQuery = this.applyBookFilters(this.selectBookColumns(this.bookBase()) as unknown as Q<BookRow>, filters)
      .orderBy(sortColumn as never)
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit)
    const countQuery = this.applyBookFilters(
      this.bookBase().select((eb) => eb.fn.countAll().as('total')) as unknown as Q<{ total: number | string }>,
      filters,
    )
    const [rows, count] = await Promise.all([rowsQuery.execute(), countQuery.executeTakeFirst()])
    return { rows: rows as BookRow[], total: Number(count?.total ?? 0) }
  }

  async getBook(id: number, options: { includeUnpublished?: boolean } = {}): Promise<BookRow | undefined> {
    const { rows } = await this.listBooks({ page: 1, limit: 1, ids: [id], includeUnpublished: options.includeUnpublished })
    return rows[0]
  }

  async relatedBooks(book: BookRow, limit = 12): Promise<BookRow[]> {
    const rows = await this.applyBookFilters(this.selectBookColumns(this.bookBase()) as unknown as Q<BookRow>, {})
      .where(sql<boolean>`b.id <> ${book.id}`)
      .where(
        sql<boolean>`(b.category_id <=> ${book.category_id} OR b.subcategory_id <=> ${book.subcategory_id} OR b.author_id <=> ${book.author_id})`,
      )
      .orderBy(sql`(b.author_id <=> ${book.author_id}) DESC, b.view_count DESC` as never)
      .limit(limit)
      .execute()
    return rows as BookRow[]
  }

  async getChapters(bookId: number): Promise<ChapterRow[]> {
    return this.db
      .selectFrom('book_audio_chapters')
      .select(['id', 'book_id', 'chapter_number', 'title', 'audio_key', 'duration_seconds', 'is_preview'])
      .where('book_id', '=', bookId)
      .orderBy('chapter_number')
      .execute()
  }

  async incrementViews(type: ItemType, id: number): Promise<void> {
    const table = type === 'book' ? 'books' : 'articles'
    await this.db
      .updateTable(table)
      .set({ view_count: sql`view_count + 1`, updated_at: sql`updated_at` })
      .where('id', '=', id)
      .execute()
  }

  // ── Articles ───────────────────────────────────────────────────────────

  private articleBase() {
    return this.db
      .selectFrom('articles as ar')
      .leftJoin('authors as a', 'a.id', 'ar.author_id')
      .leftJoin('categories as c', 'c.id', 'ar.category_id')
  }

  private static readonly ARTICLE_COLUMNS = [
    'ar.id',
    'ar.title',
    'ar.excerpt',
    'ar.author_id',
    'ar.category_id',
    'ar.subcategory_id',
    'ar.thumbnail_key',
    'ar.audio_key',
    'ar.is_free',
    'ar.is_published',
    'ar.view_count',
    'ar.rating_avg',
    'ar.rating_count',
    'ar.published_at',
    'ar.created_at',
    'ar.updated_at',
    'a.name as author_name',
    'c.name as category_name',
  ] as const

  private applyArticleFilters<O>(query: Q<O>, f: Omit<ArticleFilters, 'page' | 'limit' | 'sort'>): Q<O> {
    let q = query as unknown as SelectQueryBuilder<Database & { ar: Database['articles'] }, 'ar', O>
    if (!f.includeUnpublished) q = q.where('ar.is_published', '=', true)
    if (f.category) q = q.where((eb) => eb.or([eb('ar.category_id', '=', f.category!), eb('ar.subcategory_id', '=', f.category!)]))
    if (f.author) q = q.where('ar.author_id', '=', f.author)
    if (f.free !== undefined) q = q.where('ar.is_free', '=', f.free)
    if (f.ids) q = f.ids.length ? q.where('ar.id', 'in', f.ids) : q.where(sql<boolean>`FALSE`)
    if (f.q) {
      const pattern = likePattern(f.q)
      q = q.where(sql<boolean>`(ar.title LIKE ${pattern} OR ar.excerpt LIKE ${pattern})`)
    }
    return q as unknown as Q<O>
  }

  async listArticles(filters: ArticleFilters): Promise<{ rows: ArticleRow[]; total: number }> {
    const order =
      filters.sort === 'popular'
        ? sql`ar.view_count DESC, ar.id DESC`
        : sql`COALESCE(ar.published_at, ar.created_at) DESC, ar.id DESC`
    const rowsQuery = this.applyArticleFilters(
      this.articleBase().select([...CatalogService.ARTICLE_COLUMNS]) as unknown as Q<ArticleRow>,
      filters,
    )
      .orderBy(order as never)
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit)
    const countQuery = this.applyArticleFilters(
      this.articleBase().select((eb) => eb.fn.countAll().as('total')) as unknown as Q<{ total: number | string }>,
      filters,
    )
    const [rows, count] = await Promise.all([rowsQuery.execute(), countQuery.executeTakeFirst()])
    return { rows: rows as ArticleRow[], total: Number(count?.total ?? 0) }
  }

  async getArticle(id: number, options: { includeUnpublished?: boolean } = {}): Promise<ArticleDetailRow | undefined> {
    const q = this.articleBase()
      .select([...CatalogService.ARTICLE_COLUMNS, 'ar.content'])
      .where('ar.id', '=', id)
    const row = await (options.includeUnpublished ? q : q.where('ar.is_published', '=', true)).executeTakeFirst()
    return row as ArticleDetailRow | undefined
  }

  // ── Authors ────────────────────────────────────────────────────────────

  private authorQuery() {
    return this.db
      .selectFrom('authors as a')
      .select(['a.id', 'a.name', 'a.bio', 'a.avatar_key', 'a.website', 'a.facebook', 'a.youtube', 'a.instagram', 'a.is_verified', 'a.created_at'])
      .select((eb) => [
        eb.selectFrom('books as b').whereRef('b.author_id', '=', 'a.id').where('b.is_published', '=', true).select(eb.fn.countAll().as('n')).as('books_count'),
        eb.selectFrom('articles as ar').whereRef('ar.author_id', '=', 'a.id').where('ar.is_published', '=', true).select(eb.fn.countAll().as('n')).as('articles_count'),
        eb.selectFrom('author_follows as f').whereRef('f.author_id', '=', 'a.id').select(eb.fn.countAll().as('n')).as('followers_count'),
      ])
  }

  async listAuthors(filters: { page: number; limit: number; q?: string }): Promise<{ rows: AuthorRow[]; total: number }> {
    let rows = this.authorQuery()
    let count = this.db.selectFrom('authors as a').select((eb) => eb.fn.countAll().as('total'))
    if (filters.q) {
      const pattern = likePattern(filters.q)
      rows = rows.where(sql<boolean>`a.name LIKE ${pattern}`)
      count = count.where(sql<boolean>`a.name LIKE ${pattern}`)
    }
    const [items, total] = await Promise.all([
      rows.orderBy('a.name').limit(filters.limit).offset((filters.page - 1) * filters.limit).execute(),
      count.executeTakeFirst(),
    ])
    return { rows: items as AuthorRow[], total: Number(total?.total ?? 0) }
  }

  async getAuthor(id: number): Promise<AuthorRow | undefined> {
    return (await this.authorQuery().where('a.id', '=', id).executeTakeFirst()) as AuthorRow | undefined
  }

  // ── Categories ─────────────────────────────────────────────────────────

  async listCategories(type?: ItemType): Promise<CategoryRow[]> {
    let q = this.db
      .selectFrom('categories as c')
      .select(['c.id', 'c.type', 'c.name', 'c.parent_id', 'c.thumbnail_key', 'c.display_order'])
      .select((eb) => [
        eb
          .selectFrom('books as b')
          .where('b.is_published', '=', true)
          .where((w) => w.or([w('b.category_id', '=', w.ref('c.id')), w('b.subcategory_id', '=', w.ref('c.id'))]))
          .select(eb.fn.countAll().as('n'))
          .as('books_count'),
        eb
          .selectFrom('articles as ar')
          .where('ar.is_published', '=', true)
          .where((w) => w.or([w('ar.category_id', '=', w.ref('c.id')), w('ar.subcategory_id', '=', w.ref('c.id'))]))
          .select(eb.fn.countAll().as('n'))
          .as('articles_count'),
      ])
      .orderBy('c.display_order')
      .orderBy('c.name')
    if (type) q = q.where('c.type', 'in', [type, 'all'])
    return (await q.execute()) as CategoryRow[]
  }

  async getCategory(id: number): Promise<CategoryRow | undefined> {
    const all = await this.listCategories()
    return all.find((c) => c.id === id)
  }

  // ── Collections, sliders, FAQs ─────────────────────────────────────────

  async listCollections(page: number, limit: number) {
    const [rows, count] = await Promise.all([
      this.db
        .selectFrom('collections as col')
        .selectAll('col')
        .select((eb) => eb.selectFrom('collection_items as ci').whereRef('ci.collection_id', '=', 'col.id').select(eb.fn.countAll().as('n')).as('items_count'))
        .where('col.is_published', '=', true)
        .orderBy('col.display_order')
        .orderBy('col.id', 'desc')
        .limit(limit)
        .offset((page - 1) * limit)
        .execute(),
      this.db.selectFrom('collections').select((eb) => eb.fn.countAll().as('total')).where('is_published', '=', true).executeTakeFirst(),
    ])
    return { rows, total: Number(count?.total ?? 0) }
  }

  async getCollection(id: number) {
    const collection = await this.db
      .selectFrom('collections')
      .selectAll()
      .where('id', '=', id)
      .where('is_published', '=', true)
      .executeTakeFirst()
    if (!collection) return undefined
    const items = await this.db
      .selectFrom('collection_items')
      .select(['item_type', 'item_id', 'position'])
      .where('collection_id', '=', id)
      .orderBy('position')
      .execute()
    const bookIds = items.filter((i) => i.item_type === 'book').map((i) => i.item_id)
    const articleIds = items.filter((i) => i.item_type === 'article').map((i) => i.item_id)
    const [books, articles] = await Promise.all([
      bookIds.length ? this.listBooks({ page: 1, limit: 100, ids: bookIds }) : { rows: [] },
      articleIds.length ? this.listArticles({ page: 1, limit: 100, ids: articleIds }) : { rows: [] },
    ])
    const order = (type: ItemType, itemId: number) => items.findIndex((i) => i.item_type === type && i.item_id === itemId)
    return {
      collection,
      books: [...books.rows].sort((a, b) => order('book', a.id) - order('book', b.id)),
      articles: [...articles.rows].sort((a, b) => order('article', a.id) - order('article', b.id)),
    }
  }

  /**
   * Active sliders for one viewer: inside their scheduling window, matching
   * their audience rule and (optionally) a placement.
   */
  async listSliders(viewer: { isAuthenticated?: boolean; isSubscribed?: boolean; placement?: string; now?: Date } = {}) {
    const now = viewer.now ?? new Date()
    const audiences: string[] = ['all']
    if (viewer.isAuthenticated) {
      audiences.push('members')
      audiences.push(viewer.isSubscribed ? 'subscribers' : 'non_subscribers')
    } else {
      audiences.push('guests', 'non_subscribers')
    }
    let q = this.db
      .selectFrom('sliders')
      .selectAll()
      .where('is_active', '=', true)
      .where((eb) => eb.or([eb('starts_at', 'is', null), eb('starts_at', '<=', now)]))
      .where((eb) => eb.or([eb('ends_at', 'is', null), eb('ends_at', '>', now)]))
      .where('audience', 'in', audiences as never)
      .orderBy('display_order')
    if (viewer.placement) q = q.where('placement', '=', viewer.placement)
    return q.execute()
  }

  async listFaqs() {
    return this.db.selectFrom('faqs').selectAll().where('is_published', '=', true).orderBy('display_order').orderBy('id').execute()
  }

  itemExists(type: ItemType, id: number): Promise<boolean> {
    const table = type === 'book' ? 'books' : 'articles'
    return this.db
      .selectFrom(table)
      .select('id')
      .where('id', '=', id)
      .where('is_published', '=', true)
      .executeTakeFirst()
      .then(Boolean)
  }
}
