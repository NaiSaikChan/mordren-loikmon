import { sql, type Kysely, type SelectQueryBuilder, type Transaction } from 'kysely'
import type { Database, ItemType, WorkflowStatus } from '../../db/types.js'
import { pageInfo, likePattern, type PageInfo } from '../../http/validate.js'
import { errors } from '../../lib/errors.js'
import { sanitizeHtml, sanitizePlainText } from '../../lib/sanitize.js'
import { makeExcerpt } from '../../lib/text.js'
import type { StorageService } from '../../storage/storage.js'
import { AuditService, diffSnapshots, type AuditActorInfo } from '../audit.js'
import type { CmsActor } from '../rbac.js'

/**
 * Editorial core of the CMS: books, audiobook chapters, articles, tags and the
 * version history behind them.
 *
 * Two invariants hold for every method here:
 *  1. **Ownership** — an actor whose role scope is `own` may only read or write
 *     rows whose `author_id` is one of their author profiles. The filter is
 *     applied in the query, not after it, so a missing check cannot leak rows.
 *  2. **`is_published` stays authoritative** — the public catalogue filters on
 *     it, so every status change writes both columns in the same statement.
 */

export type ContentEntity = ItemType

/** Allowed workflow moves. Anything else is a 409 INVALID_TRANSITION. */
const TRANSITIONS: Readonly<Record<WorkflowStatus, readonly WorkflowStatus[]>> = {
  draft: ['in_review', 'scheduled', 'published', 'archived'],
  in_review: ['draft', 'scheduled', 'published', 'archived'],
  scheduled: ['draft', 'published', 'archived'],
  published: ['draft', 'archived'],
  archived: ['draft'],
}

export function canTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
  return from === to || (TRANSITIONS[from]?.includes(to) ?? false)
}

export interface ContentListParams {
  page: number
  limit: number
  q?: string
  status?: WorkflowStatus
  authorId?: number
  categoryId?: number
  free?: boolean
  hasAudio?: boolean
  sort?: 'latest' | 'updated' | 'title' | 'popular'
}

export interface BookInput {
  title: string
  description?: string | null
  author_id?: number | null
  category_id?: number | null
  subcategory_id?: number | null
  language?: string
  pages?: number | null
  publisher?: string | null
  published_at?: string | null
  cover_key?: string | null
  pdf_key?: string | null
  epub_key?: string | null
  og_image_key?: string | null
  is_free?: boolean
  is_recommended?: boolean
  is_top?: boolean
  status?: WorkflowStatus
  tags?: string[]
}

export interface ArticleInput {
  title: string
  excerpt?: string | null
  content?: string
  author_id?: number | null
  category_id?: number | null
  subcategory_id?: number | null
  thumbnail_key?: string | null
  audio_key?: string | null
  og_image_key?: string | null
  is_free?: boolean
  published_at?: string | null
  status?: WorkflowStatus
  tags?: string[]
}

export interface ChapterInput {
  chapter_number?: number
  title: string
  audio_key: string
  duration_seconds?: number | null
  is_preview?: boolean
}

export interface CmsRequestContext {
  actor: CmsActor
  audit: AuditActorInfo
}

const BOOK_FILE_COLUMNS = ['cover_key', 'pdf_key', 'epub_key', 'og_image_key'] as const
const ARTICLE_FILE_COLUMNS = ['thumbnail_key', 'audio_key', 'og_image_key'] as const

export class CmsContentService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // ── Books ──────────────────────────────────────────────────────────────

  async listBooks(actor: CmsActor, params: ContentListParams) {
    const scoped = <T extends SelectQueryBuilder<Database, 'books', object>>(builder: T): T => {
      let q = builder
      if (actor.scope === 'own') {
        q = (actor.ownedAuthorIds.length ? q.where('author_id', 'in', actor.ownedAuthorIds) : q.where(sql<boolean>`FALSE`)) as T
      }
      if (params.status) q = q.where('status', '=', params.status) as T
      if (params.authorId) q = q.where('author_id', '=', params.authorId) as T
      if (params.categoryId) {
        q = q.where((eb) => eb.or([eb('category_id', '=', params.categoryId!), eb('subcategory_id', '=', params.categoryId!)])) as T
      }
      if (params.free !== undefined) q = q.where('is_free', '=', params.free) as T
      if (params.q) {
        const pattern = likePattern(params.q)
        q = q.where(sql<boolean>`(books.title LIKE ${pattern} OR books.publisher LIKE ${pattern})`) as T
      }
      if (params.hasAudio !== undefined) {
        const exists = sql<boolean>`EXISTS (SELECT 1 FROM book_audio_chapters ch WHERE ch.book_id = books.id)`
        q = q.where(params.hasAudio ? exists : sql<boolean>`NOT ${exists}`) as T
      }
      return q
    }

    const order = {
      latest: sql`books.created_at DESC, books.id DESC`,
      updated: sql`books.updated_at DESC, books.id DESC`,
      title: sql`books.title ASC`,
      popular: sql`books.view_count DESC, books.id DESC`,
    }[params.sort ?? 'updated']

    const [rows, total] = await Promise.all([
      scoped(
        this.db
          .selectFrom('books')
          .selectAll('books')
          .select((eb) => [
            eb.selectFrom('authors').whereRef('authors.id', '=', 'books.author_id').select('authors.name').as('author_name'),
            eb.selectFrom('categories').whereRef('categories.id', '=', 'books.category_id').select('categories.name').as('category_name'),
            eb
              .selectFrom('book_audio_chapters as ch')
              .whereRef('ch.book_id', '=', 'books.id')
              .select(eb.fn.countAll().as('n'))
              .as('audio_chapters_count'),
          ]) as unknown as SelectQueryBuilder<Database, 'books', object>,
      )
        .orderBy(order as never)
        .limit(params.limit)
        .offset((params.page - 1) * params.limit)
        .execute(),
      scoped(this.db.selectFrom('books').select((eb) => eb.fn.countAll().as('total'))).executeTakeFirst(),
    ])
    return { rows: rows as Array<Record<string, unknown>>, pagination: pageInfo(params.page, params.limit, Number(total?.total ?? 0)) }
  }

  async getBook(actor: CmsActor, id: number) {
    const book = await this.db.selectFrom('books').selectAll().where('id', '=', id).executeTakeFirst()
    if (!book) throw errors.notFound('Book')
    this.assertOwnership(actor, book.author_id, 'books')
    const [chapters, tags, versions] = await Promise.all([
      this.listChapters(actor, id),
      this.tagsOf('book', id),
      this.listVersions('book', id, 20),
    ])
    return { ...book, chapters, tags, versions }
  }

  async createBook(ctx: CmsRequestContext, input: BookInput) {
    this.assertOwnership(ctx.actor, input.author_id ?? null, 'books')
    const status = this.assertPublishRight(ctx.actor, input.status ?? 'draft', 'books.publish')
    const values = {
      ...this.bookColumns(input),
      status,
      is_published: status === 'published',
      created_by: ctx.actor.userId,
      updated_by: ctx.actor.userId,
    }

    const id = await this.db.transaction().execute(async (trx) => {
      const inserted = await trx.insertInto('books').values(values as never).executeTakeFirstOrThrow()
      const bookId = Number(inserted.insertId)
      if (input.tags) await this.syncTags(trx, 'book', bookId, input.tags)
      await this.audit.record(
        { actor: ctx.audit, action: 'create', entityType: 'book', entityId: bookId, summary: input.title, after: values },
        trx,
      )
      return bookId
    })
    return this.getBook(ctx.actor, id)
  }

  async updateBook(ctx: CmsRequestContext, id: number, input: Partial<BookInput>) {
    const before = await this.db.selectFrom('books').selectAll().where('id', '=', id).executeTakeFirst()
    if (!before) throw errors.notFound('Book')
    this.assertOwnership(ctx.actor, before.author_id, 'books')
    // Moving content to another author is a transfer; own-scoped actors cannot do it.
    if (input.author_id !== undefined) this.assertOwnership(ctx.actor, input.author_id ?? null, 'books')

    const patch: Record<string, unknown> = { ...this.bookColumns(input), updated_by: ctx.actor.userId }
    if (input.status !== undefined) {
      const status = this.assertPublishRight(ctx.actor, input.status, 'books.publish')
      if (!canTransition(before.status, status)) throw errors.invalidTransition(before.status, status)
      patch.status = status
      patch.is_published = status === 'published'
    }
    if (!Object.keys(patch).length) throw errors.badRequest('Nothing to update')

    await this.db.transaction().execute(async (trx) => {
      await this.snapshot(trx, 'book', id, before, ctx.actor.userId, 'Before update')
      await trx
        .updateTable('books')
        .set({ ...patch, revision: sql`revision + 1` })
        .where('id', '=', id)
        .execute()
      if (input.tags) await this.syncTags(trx, 'book', id, input.tags)
      const diff = diffSnapshots(before as unknown as Record<string, unknown>, { ...before, ...patch } as Record<string, unknown>)
      await this.audit.record(
        { actor: ctx.audit, action: 'update', entityType: 'book', entityId: id, summary: before.title, before: diff.before, after: diff.after },
        trx,
      )
    })
    await this.cleanupReplacedFiles(before, patch, BOOK_FILE_COLUMNS)
    return this.getBook(ctx.actor, id)
  }

  async deleteBook(ctx: CmsRequestContext, id: number): Promise<void> {
    const before = await this.db.selectFrom('books').selectAll().where('id', '=', id).executeTakeFirst()
    if (!before) throw errors.notFound('Book')
    this.assertOwnership(ctx.actor, before.author_id, 'books')
    await this.db.transaction().execute(async (trx) => {
      await this.snapshot(trx, 'book', id, before, ctx.actor.userId, 'Before delete')
      await trx.deleteFrom('books').where('id', '=', id).execute()
      await this.audit.record(
        { actor: ctx.audit, action: 'delete', entityType: 'book', entityId: id, summary: before.title, before },
        trx,
      )
    })
    await this.removeFiles(before, BOOK_FILE_COLUMNS)
  }

  private bookColumns(input: Partial<BookInput>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    if (input.title !== undefined) out.title = sanitizePlainText(input.title)
    if (input.description !== undefined) out.description = input.description === null ? null : sanitizeHtml(input.description)
    for (const key of ['author_id', 'category_id', 'subcategory_id', 'pages', 'cover_key', 'pdf_key', 'epub_key', 'og_image_key'] as const) {
      if (input[key] !== undefined) out[key] = input[key]
    }
    if (input.language !== undefined) out.language = input.language
    if (input.publisher !== undefined) out.publisher = input.publisher === null ? null : sanitizePlainText(input.publisher)
    if (input.published_at !== undefined) out.published_at = input.published_at ? new Date(input.published_at) : null
    for (const flag of ['is_free', 'is_recommended', 'is_top'] as const) {
      if (input[flag] !== undefined) out[flag] = input[flag]
    }
    return out
  }

  // ── Articles ───────────────────────────────────────────────────────────

  async listArticles(actor: CmsActor, params: ContentListParams) {
    const scoped = <T extends SelectQueryBuilder<Database, 'articles', object>>(builder: T): T => {
      let q = builder
      if (actor.scope === 'own') {
        q = (actor.ownedAuthorIds.length ? q.where('author_id', 'in', actor.ownedAuthorIds) : q.where(sql<boolean>`FALSE`)) as T
      }
      if (params.status) q = q.where('status', '=', params.status) as T
      if (params.authorId) q = q.where('author_id', '=', params.authorId) as T
      if (params.categoryId) {
        q = q.where((eb) => eb.or([eb('category_id', '=', params.categoryId!), eb('subcategory_id', '=', params.categoryId!)])) as T
      }
      if (params.free !== undefined) q = q.where('is_free', '=', params.free) as T
      if (params.q) {
        const pattern = likePattern(params.q)
        q = q.where(sql<boolean>`(articles.title LIKE ${pattern} OR articles.excerpt LIKE ${pattern})`) as T
      }
      return q
    }

    const order = {
      latest: sql`COALESCE(articles.published_at, articles.created_at) DESC, articles.id DESC`,
      updated: sql`articles.updated_at DESC, articles.id DESC`,
      title: sql`articles.title ASC`,
      popular: sql`articles.view_count DESC, articles.id DESC`,
    }[params.sort ?? 'updated']

    const [rows, total] = await Promise.all([
      scoped(
        this.db
          .selectFrom('articles')
          // `content` is excluded: a list page never needs whole article bodies.
          .select([
            'articles.id',
            'articles.title',
            'articles.excerpt',
            'articles.author_id',
            'articles.category_id',
            'articles.subcategory_id',
            'articles.thumbnail_key',
            'articles.audio_key',
            'articles.is_free',
            'articles.is_published',
            'articles.status',
            'articles.view_count',
            'articles.rating_avg',
            'articles.rating_count',
            'articles.revision',
            'articles.published_at',
            'articles.created_at',
            'articles.updated_at',
          ])
          .select((eb) => [
            eb.selectFrom('authors').whereRef('authors.id', '=', 'articles.author_id').select('authors.name').as('author_name'),
            eb
              .selectFrom('categories')
              .whereRef('categories.id', '=', 'articles.category_id')
              .select('categories.name')
              .as('category_name'),
          ]) as unknown as SelectQueryBuilder<Database, 'articles', object>,
      )
        .orderBy(order as never)
        .limit(params.limit)
        .offset((params.page - 1) * params.limit)
        .execute(),
      scoped(this.db.selectFrom('articles').select((eb) => eb.fn.countAll().as('total'))).executeTakeFirst(),
    ])
    return { rows: rows as Array<Record<string, unknown>>, pagination: pageInfo(params.page, params.limit, Number(total?.total ?? 0)) }
  }

  async getArticle(actor: CmsActor, id: number) {
    const article = await this.db.selectFrom('articles').selectAll().where('id', '=', id).executeTakeFirst()
    if (!article) throw errors.notFound('Article')
    this.assertOwnership(actor, article.author_id, 'articles')
    const [tags, versions] = await Promise.all([this.tagsOf('article', id), this.listVersions('article', id, 20)])
    return { ...article, tags, versions }
  }

  async createArticle(ctx: CmsRequestContext, input: ArticleInput) {
    this.assertOwnership(ctx.actor, input.author_id ?? null, 'articles')
    const status = this.assertPublishRight(ctx.actor, input.status ?? 'draft', 'articles.publish')
    const columns = this.articleColumns(input)
    const values = {
      content: '',
      ...columns,
      status,
      is_published: status === 'published',
      published_at: columns.published_at ?? (status === 'published' ? this.now() : null),
      created_by: ctx.actor.userId,
      updated_by: ctx.actor.userId,
    }

    const id = await this.db.transaction().execute(async (trx) => {
      const inserted = await trx.insertInto('articles').values(values as never).executeTakeFirstOrThrow()
      const articleId = Number(inserted.insertId)
      if (input.tags) await this.syncTags(trx, 'article', articleId, input.tags)
      await this.audit.record(
        {
          actor: ctx.audit,
          action: 'create',
          entityType: 'article',
          entityId: articleId,
          summary: input.title,
          after: { ...values, content: undefined },
        },
        trx,
      )
      return articleId
    })
    return this.getArticle(ctx.actor, id)
  }

  async updateArticle(ctx: CmsRequestContext, id: number, input: Partial<ArticleInput>) {
    const before = await this.db.selectFrom('articles').selectAll().where('id', '=', id).executeTakeFirst()
    if (!before) throw errors.notFound('Article')
    this.assertOwnership(ctx.actor, before.author_id, 'articles')
    if (input.author_id !== undefined) this.assertOwnership(ctx.actor, input.author_id ?? null, 'articles')

    const patch: Record<string, unknown> = { ...this.articleColumns(input), updated_by: ctx.actor.userId }
    if (input.status !== undefined) {
      const status = this.assertPublishRight(ctx.actor, input.status, 'articles.publish')
      if (!canTransition(before.status, status)) throw errors.invalidTransition(before.status, status)
      patch.status = status
      patch.is_published = status === 'published'
      if (status === 'published' && !before.published_at && patch.published_at === undefined) patch.published_at = this.now()
    }
    if (!Object.keys(patch).length) throw errors.badRequest('Nothing to update')

    await this.db.transaction().execute(async (trx) => {
      await this.snapshot(trx, 'article', id, before, ctx.actor.userId, 'Before update')
      await trx
        .updateTable('articles')
        .set({ ...patch, revision: sql`revision + 1` } as never)
        .where('id', '=', id)
        .execute()
      if (input.tags) await this.syncTags(trx, 'article', id, input.tags)
      const diff = diffSnapshots(
        { ...before, content: undefined } as unknown as Record<string, unknown>,
        { ...before, ...patch, content: undefined } as Record<string, unknown>,
      )
      await this.audit.record(
        {
          actor: ctx.audit,
          action: 'update',
          entityType: 'article',
          entityId: id,
          summary: before.title,
          before: diff.before,
          after: diff.after,
        },
        trx,
      )
    })
    await this.cleanupReplacedFiles(before, patch, ARTICLE_FILE_COLUMNS)
    return this.getArticle(ctx.actor, id)
  }

  async deleteArticle(ctx: CmsRequestContext, id: number): Promise<void> {
    const before = await this.db.selectFrom('articles').selectAll().where('id', '=', id).executeTakeFirst()
    if (!before) throw errors.notFound('Article')
    this.assertOwnership(ctx.actor, before.author_id, 'articles')
    await this.db.transaction().execute(async (trx) => {
      await this.snapshot(trx, 'article', id, before, ctx.actor.userId, 'Before delete')
      await trx.deleteFrom('articles').where('id', '=', id).execute()
      await this.audit.record(
        { actor: ctx.audit, action: 'delete', entityType: 'article', entityId: id, summary: before.title, before: { ...before, content: undefined } },
        trx,
      )
    })
    await this.removeFiles(before, ARTICLE_FILE_COLUMNS)
  }

  private articleColumns(input: Partial<ArticleInput>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    if (input.title !== undefined) out.title = sanitizePlainText(input.title)
    if (input.content !== undefined) out.content = sanitizeHtml(input.content)
    if (input.excerpt !== undefined) out.excerpt = input.excerpt === null ? null : sanitizePlainText(input.excerpt)
    // An editor that leaves the excerpt empty gets one derived from the body.
    if (out.content && !out.excerpt) out.excerpt = makeExcerpt(String(out.content))
    for (const key of ['author_id', 'category_id', 'subcategory_id', 'thumbnail_key', 'audio_key', 'og_image_key'] as const) {
      if (input[key] !== undefined) out[key] = input[key]
    }
    if (input.is_free !== undefined) out.is_free = input.is_free
    if (input.published_at !== undefined) out.published_at = input.published_at ? new Date(input.published_at) : null
    return out
  }

  // ── Workflow ───────────────────────────────────────────────────────────

  /**
   * Move one item through the editorial workflow. `submit` and `approve` are
   * expressed as status changes so the transition table stays the only rule.
   */
  async transition(
    ctx: CmsRequestContext,
    entity: ContentEntity,
    id: number,
    to: WorkflowStatus,
    note?: string | null,
  ): Promise<{ id: number; status: WorkflowStatus }> {
    const table = entity === 'book' ? 'books' : 'articles'
    const before = await this.db.selectFrom(table).selectAll().where('id', '=', id).executeTakeFirst()
    if (!before) throw errors.notFound(entity === 'book' ? 'Book' : 'Article')
    this.assertOwnership(ctx.actor, before.author_id, `${entity}s`)
    this.assertPublishRight(ctx.actor, to, entity === 'book' ? 'books.publish' : 'articles.publish')
    if (!canTransition(before.status, to)) throw errors.invalidTransition(before.status, to)

    const patch: Record<string, unknown> = {
      status: to,
      is_published: to === 'published',
      updated_by: ctx.actor.userId,
      review_note: note ?? null,
    }
    if (to === 'in_review') patch.submitted_at = this.now()
    if (to === 'published' || to === 'archived') patch.reviewed_by = ctx.actor.userId
    if (entity === 'article' && to === 'published' && !before.published_at) patch.published_at = this.now()

    const action = to === 'published' ? 'publish' : to === 'in_review' ? 'submit' : to === 'archived' ? 'unpublish' : 'update'
    await this.db.transaction().execute(async (trx) => {
      await trx.updateTable(table).set(patch as never).where('id', '=', id).execute()
      await this.audit.record(
        {
          actor: ctx.audit,
          action,
          entityType: entity,
          entityId: id,
          summary: `${before.title}: ${before.status} → ${to}`,
          before: { status: before.status },
          after: { status: to, note: note ?? null },
        },
        trx,
      )
    })
    return { id, status: to }
  }

  /** Bulk publish / archive / delete from a list page. Failures are reported per id. */
  async bulk(
    ctx: CmsRequestContext,
    entity: ContentEntity,
    ids: number[],
    action: 'publish' | 'archive' | 'draft' | 'delete',
  ): Promise<{ succeeded: number[]; failed: Array<{ id: number; message: string }> }> {
    const succeeded: number[] = []
    const failed: Array<{ id: number; message: string }> = []
    for (const id of ids) {
      try {
        if (action === 'delete') {
          if (entity === 'book') await this.deleteBook(ctx, id)
          else await this.deleteArticle(ctx, id)
        } else {
          const to: WorkflowStatus = action === 'publish' ? 'published' : action === 'archive' ? 'archived' : 'draft'
          await this.transition(ctx, entity, id, to)
        }
        succeeded.push(id)
      } catch (err) {
        failed.push({ id, message: err instanceof Error ? err.message : 'Failed' })
      }
    }
    return { succeeded, failed }
  }

  /** Publishes anything whose scheduled date has arrived. Run by the job scheduler. */
  async publishDue(): Promise<{ books: number; articles: number }> {
    const now = this.now()
    const books = await this.db
      .updateTable('books')
      .set({ status: 'published', is_published: true })
      .where('status', '=', 'scheduled')
      .where('published_at', '<=', now)
      .executeTakeFirst()
    const articles = await this.db
      .updateTable('articles')
      .set({ status: 'published', is_published: true })
      .where('status', '=', 'scheduled')
      .where('published_at', '<=', now)
      .executeTakeFirst()
    return { books: Number(books.numUpdatedRows ?? 0), articles: Number(articles.numUpdatedRows ?? 0) }
  }

  // ── Version history ────────────────────────────────────────────────────

  async listVersions(entity: ContentEntity, entityId: number, limit = 50) {
    return this.db
      .selectFrom('content_versions')
      .select(['id', 'version', 'change_note', 'created_by', 'created_at'])
      .where('entity_type', '=', entity)
      .where('entity_id', '=', entityId)
      .orderBy('version', 'desc')
      .limit(limit)
      .execute()
  }

  async getVersion(actor: CmsActor, entity: ContentEntity, entityId: number, version: number) {
    await this.assertEntityOwnership(actor, entity, entityId)
    const row = await this.db
      .selectFrom('content_versions')
      .selectAll()
      .where('entity_type', '=', entity)
      .where('entity_id', '=', entityId)
      .where('version', '=', version)
      .executeTakeFirst()
    if (!row) throw errors.notFound('Version')
    return { ...row, snapshot: parseJson(row.snapshot) }
  }

  /** Restores the stored snapshot; the current state is snapshotted first. */
  async restoreVersion(ctx: CmsRequestContext, entity: ContentEntity, entityId: number, version: number) {
    const table = entity === 'book' ? 'books' : 'articles'
    const stored = await this.getVersion(ctx.actor, entity, entityId, version)
    const current = await this.db.selectFrom(table).selectAll().where('id', '=', entityId).executeTakeFirst()
    if (!current) throw errors.notFound(entity === 'book' ? 'Book' : 'Article')

    const snapshot = stored.snapshot as Record<string, unknown>
    const restorable = entity === 'book' ? RESTORABLE_BOOK_COLUMNS : RESTORABLE_ARTICLE_COLUMNS
    const patch: Record<string, unknown> = { updated_by: ctx.actor.userId }
    for (const column of restorable) {
      if (snapshot[column] !== undefined) patch[column] = normaliseRestored(column, snapshot[column])
    }

    await this.db.transaction().execute(async (trx) => {
      await this.snapshot(trx, entity, entityId, current, ctx.actor.userId, `Before restoring v${version}`)
      await trx
        .updateTable(table)
        .set({ ...patch, revision: sql`revision + 1` } as never)
        .where('id', '=', entityId)
        .execute()
      await this.audit.record(
        { actor: ctx.audit, action: 'restore', entityType: entity, entityId, summary: `Restored version ${version}`, after: { version } },
        trx,
      )
    })
    return entity === 'book' ? this.getBook(ctx.actor, entityId) : this.getArticle(ctx.actor, entityId)
  }

  private async snapshot(
    trx: Transaction<Database>,
    entity: ContentEntity,
    entityId: number,
    row: Record<string, unknown>,
    userId: string,
    note: string,
  ) {
    const version = Number(row.revision ?? 1)
    await trx
      .insertInto('content_versions')
      .ignore()
      .values({
        entity_type: entity,
        entity_id: entityId,
        version,
        snapshot: JSON.stringify(row),
        change_note: note,
        created_by: userId,
      })
      .execute()
  }

  // ── Audiobook chapters ─────────────────────────────────────────────────

  async listChapters(actor: CmsActor, bookId: number) {
    await this.assertEntityOwnership(actor, 'book', bookId)
    return this.db
      .selectFrom('book_audio_chapters')
      .selectAll()
      .where('book_id', '=', bookId)
      .orderBy('chapter_number')
      .execute()
  }

  async createChapter(ctx: CmsRequestContext, bookId: number, input: ChapterInput) {
    await this.assertEntityOwnership(ctx.actor, 'book', bookId)
    const next =
      input.chapter_number ??
      Number(
        (
          await this.db
            .selectFrom('book_audio_chapters')
            .select((eb) => eb.fn.coalesce(eb.fn.max('chapter_number'), sql<number>`0`).as('max'))
            .where('book_id', '=', bookId)
            .executeTakeFirst()
        )?.max ?? 0,
      ) + 1
    const values = {
      book_id: bookId,
      chapter_number: next,
      title: sanitizePlainText(input.title),
      audio_key: input.audio_key,
      duration_seconds: input.duration_seconds ?? null,
      is_preview: input.is_preview ?? false,
    }
    const inserted = await this.db.insertInto('book_audio_chapters').values(values).executeTakeFirstOrThrow()
    const id = Number(inserted.insertId)
    await this.audit.record({ actor: ctx.audit, action: 'create', entityType: 'chapter', entityId: id, summary: values.title, after: values })
    return this.db.selectFrom('book_audio_chapters').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  }

  async updateChapter(ctx: CmsRequestContext, chapterId: number, input: Partial<ChapterInput>) {
    const before = await this.db.selectFrom('book_audio_chapters').selectAll().where('id', '=', chapterId).executeTakeFirst()
    if (!before) throw errors.notFound('Chapter')
    await this.assertEntityOwnership(ctx.actor, 'book', before.book_id)
    const patch: Record<string, unknown> = {}
    if (input.title !== undefined) patch.title = sanitizePlainText(input.title)
    if (input.audio_key !== undefined) patch.audio_key = input.audio_key
    if (input.duration_seconds !== undefined) patch.duration_seconds = input.duration_seconds
    if (input.is_preview !== undefined) patch.is_preview = input.is_preview
    if (input.chapter_number !== undefined) patch.chapter_number = input.chapter_number
    if (!Object.keys(patch).length) throw errors.badRequest('Nothing to update')

    await this.db.updateTable('book_audio_chapters').set(patch as never).where('id', '=', chapterId).execute()
    await this.cleanupReplacedFiles(before, patch, ['audio_key'])
    const diff = diffSnapshots(before as unknown as Record<string, unknown>, { ...before, ...patch } as Record<string, unknown>)
    await this.audit.record({
      actor: ctx.audit,
      action: 'update',
      entityType: 'chapter',
      entityId: chapterId,
      summary: before.title,
      before: diff.before,
      after: diff.after,
    })
    return this.db.selectFrom('book_audio_chapters').selectAll().where('id', '=', chapterId).executeTakeFirstOrThrow()
  }

  async deleteChapter(ctx: CmsRequestContext, chapterId: number): Promise<void> {
    const before = await this.db.selectFrom('book_audio_chapters').selectAll().where('id', '=', chapterId).executeTakeFirst()
    if (!before) throw errors.notFound('Chapter')
    await this.assertEntityOwnership(ctx.actor, 'book', before.book_id)
    await this.db.deleteFrom('book_audio_chapters').where('id', '=', chapterId).execute()
    await this.removeFiles(before, ['audio_key'])
    await this.audit.record({ actor: ctx.audit, action: 'delete', entityType: 'chapter', entityId: chapterId, summary: before.title, before })
  }

  /** Drag-and-drop reordering: `orderedIds` is the new chapter order. */
  async reorderChapters(ctx: CmsRequestContext, bookId: number, orderedIds: number[]): Promise<void> {
    await this.assertEntityOwnership(ctx.actor, 'book', bookId)
    await this.db.transaction().execute(async (trx) => {
      // Two passes: chapter_number is unique per book, so shift out of the way first.
      await trx
        .updateTable('book_audio_chapters')
        .set({ chapter_number: sql`chapter_number + 100000` })
        .where('book_id', '=', bookId)
        .execute()
      for (const [index, id] of orderedIds.entries()) {
        await trx
          .updateTable('book_audio_chapters')
          .set({ chapter_number: index + 1 })
          .where('id', '=', id)
          .where('book_id', '=', bookId)
          .execute()
      }
      // Anything the client did not list keeps a stable order after the listed ones.
      await trx
        .updateTable('book_audio_chapters')
        .set({ chapter_number: sql`chapter_number - 100000 + ${orderedIds.length}` })
        .where('book_id', '=', bookId)
        .where('chapter_number', '>', 100000)
        .execute()
    })
    await this.audit.record({ actor: ctx.audit, action: 'update', entityType: 'book', entityId: bookId, summary: 'Reordered chapters', after: { order: orderedIds } })
  }

  // ── Tags ───────────────────────────────────────────────────────────────

  async listTags(): Promise<Array<{ id: number; slug: string; name: string; usage_count: number }>> {
    const rows = await this.db
      .selectFrom('tags')
      .select(['id', 'slug', 'name'])
      .select((eb) => eb.selectFrom('content_tags as ct').whereRef('ct.tag_id', '=', 'tags.id').select(eb.fn.countAll().as('n')).as('usage_count'))
      .orderBy('name')
      .execute()
    return rows.map((r) => ({ ...r, usage_count: Number(r.usage_count ?? 0) }))
  }

  private async tagsOf(entity: ContentEntity, entityId: number): Promise<string[]> {
    const rows = await this.db
      .selectFrom('content_tags as ct')
      .innerJoin('tags as t', 't.id', 'ct.tag_id')
      .select('t.name')
      .where('ct.item_type', '=', entity)
      .where('ct.item_id', '=', entityId)
      .orderBy('t.name')
      .execute()
    return rows.map((r) => r.name)
  }

  private async syncTags(trx: Transaction<Database>, entity: ContentEntity, entityId: number, names: string[]) {
    const cleaned = [...new Set(names.map((n) => sanitizePlainText(n)).filter(Boolean))].slice(0, 30)
    await trx.deleteFrom('content_tags').where('item_type', '=', entity).where('item_id', '=', entityId).execute()
    if (!cleaned.length) return
    const slugs = cleaned.map(tagSlug)
    await trx
      .insertInto('tags')
      .ignore()
      .values(cleaned.map((name, i) => ({ slug: slugs[i], name })))
      .execute()
    const rows = await trx.selectFrom('tags').select(['id']).where('slug', 'in', slugs).execute()
    if (rows.length) {
      await trx
        .insertInto('content_tags')
        .ignore()
        .values(rows.map((r) => ({ tag_id: r.id, item_type: entity, item_id: entityId })))
        .execute()
    }
  }

  // ── Shared helpers ─────────────────────────────────────────────────────

  private assertOwnership(actor: CmsActor, authorId: number | null | undefined, resource: string): void {
    if (actor.scope === 'all') return
    if (authorId === null || authorId === undefined || !actor.ownedAuthorIds.includes(authorId)) {
      throw errors.ownershipRequired(resource)
    }
  }

  private async assertEntityOwnership(actor: CmsActor, entity: ContentEntity, entityId: number): Promise<void> {
    if (actor.scope === 'all') return
    const table = entity === 'book' ? 'books' : 'articles'
    const row = await this.db.selectFrom(table).select('author_id').where('id', '=', entityId).executeTakeFirst()
    if (!row) throw errors.notFound(entity === 'book' ? 'Book' : 'Article')
    this.assertOwnership(actor, row.author_id, `${entity}s`)
  }

  /**
   * Publishing is a separate right: an actor may edit a draft without being
   * able to put it in front of readers.
   */
  private assertPublishRight(actor: CmsActor, status: WorkflowStatus, permission: string): WorkflowStatus {
    if (status !== 'published' && status !== 'scheduled') return status
    if (actor.permissions.has(permission) || actor.permissions.has('own_content.publish')) return status
    throw errors.permissionDenied(permission)
  }

  /** Delete files a write replaced. Storage failures are never fatal. */
  private async cleanupReplacedFiles(before: Record<string, unknown>, after: Record<string, unknown>, columns: readonly string[]) {
    for (const column of columns) {
      const oldKey = before[column]
      if (typeof oldKey === 'string' && oldKey && after[column] !== undefined && after[column] !== oldKey) {
        await this.storage.removeObject(oldKey).catch(() => undefined)
      }
    }
  }

  private async removeFiles(row: Record<string, unknown>, columns: readonly string[]) {
    for (const column of columns) {
      const key = row[column]
      if (typeof key === 'string' && key) await this.storage.removeObject(key).catch(() => undefined)
    }
  }
}

const RESTORABLE_BOOK_COLUMNS = [
  'title',
  'description',
  'author_id',
  'category_id',
  'subcategory_id',
  'language',
  'pages',
  'publisher',
  'published_at',
  'cover_key',
  'pdf_key',
  'epub_key',
  'og_image_key',
  'is_free',
  'is_recommended',
  'is_top',
] as const

const RESTORABLE_ARTICLE_COLUMNS = [
  'title',
  'excerpt',
  'content',
  'author_id',
  'category_id',
  'subcategory_id',
  'thumbnail_key',
  'audio_key',
  'og_image_key',
  'is_free',
  'published_at',
] as const

const DATE_COLUMNS = new Set(['published_at'])

function normaliseRestored(column: string, value: unknown): unknown {
  if (DATE_COLUMNS.has(column) && typeof value === 'string') return new Date(value)
  return value
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export function tagSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // `\p{M}` keeps combining marks: Mon and Burmese words are written with
    // them, and dropping them turns a tag into a different word.
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
}
