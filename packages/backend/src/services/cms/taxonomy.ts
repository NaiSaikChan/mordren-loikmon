import { sql, type Kysely } from 'kysely'
import type { Database, ItemType, SliderAudience, VerificationStatus } from '../../db/types.js'
import { likePattern, pageInfo } from '../../http/validate.js'
import { errors } from '../../lib/errors.js'
import { sanitizeHtml, sanitizePlainText } from '../../lib/sanitize.js'
import type { StorageService } from '../../storage/storage.js'
import { AuditService, diffSnapshots } from '../audit.js'
import type { CmsActor } from '../rbac.js'
import type { CmsRequestContext } from './content.js'

/**
 * Supporting catalogue structures managed from the CMS: author profiles,
 * nested categories, curated collections and scheduled sliders.
 *
 * Categories are a tree (`parent_id`) ordered by `display_order`, which is what
 * the drag-and-drop reordering endpoint writes.
 */

export interface AuthorInput {
  name: string
  bio?: string | null
  avatar_key?: string | null
  user_id?: string | null
  website?: string | null
  facebook?: string | null
  youtube?: string | null
  instagram?: string | null
}

export interface CategoryInput {
  type?: ItemType | 'all'
  name: string
  parent_id?: number | null
  thumbnail_key?: string | null
  cover_key?: string | null
  display_order?: number
}

export interface CollectionInput {
  title: string
  description?: string | null
  thumbnail_key?: string | null
  display_order?: number
  is_published?: boolean
  is_featured?: boolean
  slug?: string | null
}

export interface SliderInput {
  title?: string | null
  image_key: string
  mobile_image_key?: string | null
  link?: string | null
  display_order?: number
  is_active?: boolean
  starts_at?: string | null
  ends_at?: string | null
  audience?: SliderAudience
  placement?: string
}

export interface CategoryNode {
  id: number
  parent_id: number | null
  type: ItemType | 'all'
  name: string
  thumbnail_key: string | null
  cover_key: string | null
  display_order: number
  books_count: number
  articles_count: number
  children: CategoryNode[]
}

export class TaxonomyService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // ── Authors ────────────────────────────────────────────────────────────

  async listAuthors(params: { page: number; limit: number; q?: string; verification?: VerificationStatus }) {
    const base = () => {
      let q = this.db.selectFrom('authors')
      if (params.q) q = q.where(sql<boolean>`authors.name LIKE ${likePattern(params.q)}`)
      if (params.verification) q = q.where('verification_status', '=', params.verification)
      return q
    }
    const [rows, total] = await Promise.all([
      base()
        .selectAll('authors')
        .select((eb) => [
          eb.selectFrom('books').whereRef('books.author_id', '=', 'authors.id').select(eb.fn.countAll().as('n')).as('books_count'),
          eb.selectFrom('articles').whereRef('articles.author_id', '=', 'authors.id').select(eb.fn.countAll().as('n')).as('articles_count'),
          eb
            .selectFrom('author_follows as f')
            .whereRef('f.author_id', '=', 'authors.id')
            .select(eb.fn.countAll().as('n'))
            .as('followers_count'),
          eb.selectFrom('users').whereRef('users.id', '=', 'authors.user_id').select('users.email').as('user_email'),
        ])
        .orderBy('authors.name')
        .limit(params.limit)
        .offset((params.page - 1) * params.limit)
        .execute(),
      base()
        .select((eb) => eb.fn.countAll().as('total'))
        .executeTakeFirst(),
    ])
    return { rows, pagination: pageInfo(params.page, params.limit, Number(total?.total ?? 0)) }
  }

  /** Portfolio and performance of a single author (used by the author profile page). */
  async getAuthor(actor: CmsActor, id: number) {
    if (actor.scope === 'own' && !actor.ownedAuthorIds.includes(id)) throw errors.ownershipRequired('author profiles')
    const author = await this.db.selectFrom('authors').selectAll().where('id', '=', id).executeTakeFirst()
    if (!author) throw errors.notFound('Author')
    const [books, articles, stats] = await Promise.all([
      this.db
        .selectFrom('books')
        .select(['id', 'title', 'status', 'view_count', 'rating_avg', 'rating_count', 'cover_key', 'created_at'])
        .where('author_id', '=', id)
        .orderBy('created_at', 'desc')
        .limit(100)
        .execute(),
      this.db
        .selectFrom('articles')
        .select(['id', 'title', 'status', 'view_count', 'rating_avg', 'rating_count', 'published_at'])
        .where('author_id', '=', id)
        .orderBy('created_at', 'desc')
        .limit(100)
        .execute(),
      this.db
        .selectFrom('books')
        .select((eb) => [eb.fn.sum<number>('view_count').as('book_views'), eb.fn.countAll().as('books')])
        .where('author_id', '=', id)
        .executeTakeFirst(),
    ])
    return {
      ...author,
      books,
      articles,
      stats: {
        books: Number(stats?.books ?? 0),
        articles: articles.length,
        book_views: Number(stats?.book_views ?? 0),
        article_views: articles.reduce((sum, a) => sum + Number(a.view_count ?? 0), 0),
      },
    }
  }

  async createAuthor(ctx: CmsRequestContext, input: AuthorInput) {
    const values = this.authorColumns(input)
    const inserted = await this.db.insertInto('authors').values(values as never).executeTakeFirstOrThrow()
    const id = Number(inserted.insertId)
    await this.audit.record({ actor: ctx.audit, action: 'create', entityType: 'author', entityId: id, summary: input.name, after: values })
    return this.db.selectFrom('authors').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  }

  async updateAuthor(ctx: CmsRequestContext, id: number, input: Partial<AuthorInput>) {
    const before = await this.db.selectFrom('authors').selectAll().where('id', '=', id).executeTakeFirst()
    if (!before) throw errors.notFound('Author')
    if (ctx.actor.scope === 'own' && !ctx.actor.ownedAuthorIds.includes(id)) throw errors.ownershipRequired('author profiles')
    // Re-pointing a profile at another account grants that account ownership of
    // its content, so it stays an `all`-scope operation.
    if (input.user_id !== undefined && ctx.actor.scope === 'own') throw errors.ownershipRequired('author accounts')

    const patch = this.authorColumns(input)
    if (!Object.keys(patch).length) throw errors.badRequest('Nothing to update')
    await this.db.updateTable('authors').set(patch as never).where('id', '=', id).execute()
    await this.cleanupReplaced(before.avatar_key, patch.avatar_key)
    const diff = diffSnapshots(before as unknown as Record<string, unknown>, { ...before, ...patch } as Record<string, unknown>)
    await this.audit.record({
      actor: ctx.audit,
      action: 'update',
      entityType: 'author',
      entityId: id,
      summary: before.name,
      before: diff.before,
      after: diff.after,
    })
    return this.db.selectFrom('authors').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  }

  async deleteAuthor(ctx: CmsRequestContext, id: number): Promise<void> {
    const before = await this.db.selectFrom('authors').selectAll().where('id', '=', id).executeTakeFirst()
    if (!before) throw errors.notFound('Author')
    await this.db.deleteFrom('authors').where('id', '=', id).execute()
    if (before.avatar_key) await this.storage.removeObject(before.avatar_key).catch(() => undefined)
    await this.audit.record({ actor: ctx.audit, action: 'delete', entityType: 'author', entityId: id, summary: before.name, before })
  }

  /** Verification workflow: pending → verified / rejected. `is_verified` mirrors it. */
  async setVerification(ctx: CmsRequestContext, id: number, status: VerificationStatus, note?: string | null) {
    const before = await this.db.selectFrom('authors').selectAll().where('id', '=', id).executeTakeFirst()
    if (!before) throw errors.notFound('Author')
    const patch = {
      verification_status: status,
      is_verified: status === 'verified',
      verified_at: status === 'verified' ? this.now() : null,
      verified_by: ctx.actor.userId,
      verification_note: note ?? null,
    }
    await this.db.updateTable('authors').set(patch).where('id', '=', id).execute()
    await this.audit.record({
      actor: ctx.audit,
      action: status === 'verified' ? 'approve' : status === 'rejected' ? 'reject' : 'update',
      entityType: 'author',
      entityId: id,
      summary: `${before.name}: verification ${status}`,
      before: { verification_status: before.verification_status },
      after: patch,
    })
    return this.db.selectFrom('authors').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  }

  private authorColumns(input: Partial<AuthorInput>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    if (input.name !== undefined) out.name = sanitizePlainText(input.name)
    if (input.bio !== undefined) out.bio = input.bio === null ? null : sanitizeHtml(input.bio)
    for (const key of ['avatar_key', 'user_id', 'website', 'facebook', 'youtube', 'instagram'] as const) {
      if (input[key] !== undefined) out[key] = input[key]
    }
    return out
  }

  // ── Categories ─────────────────────────────────────────────────────────

  /** Whole tree with per-node counts; the CMS renders and reorders it client-side. */
  async categoryTree(): Promise<CategoryNode[]> {
    const rows = await this.db
      .selectFrom('categories')
      .select(['id', 'parent_id', 'type', 'name', 'thumbnail_key', 'cover_key', 'display_order'])
      .select((eb) => [
        eb
          .selectFrom('books')
          .where((w) => w.or([w('books.category_id', '=', w.ref('categories.id')), w('books.subcategory_id', '=', w.ref('categories.id'))]))
          .select(eb.fn.countAll().as('n'))
          .as('books_count'),
        eb
          .selectFrom('articles')
          .where((w) =>
            w.or([w('articles.category_id', '=', w.ref('categories.id')), w('articles.subcategory_id', '=', w.ref('categories.id'))]),
          )
          .select(eb.fn.countAll().as('n'))
          .as('articles_count'),
      ])
      .orderBy('display_order')
      .orderBy('name')
      .execute()

    const nodes = new Map<number, CategoryNode>()
    for (const row of rows) {
      nodes.set(row.id, {
        id: row.id,
        parent_id: row.parent_id,
        type: row.type,
        name: row.name,
        thumbnail_key: row.thumbnail_key,
        cover_key: row.cover_key,
        display_order: row.display_order,
        books_count: Number(row.books_count ?? 0),
        articles_count: Number(row.articles_count ?? 0),
        children: [],
      })
    }
    const roots: CategoryNode[] = []
    for (const node of nodes.values()) {
      const parent = node.parent_id === null ? undefined : nodes.get(node.parent_id)
      if (parent) parent.children.push(node)
      else roots.push(node)
    }
    return roots
  }

  async createCategory(ctx: CmsRequestContext, input: CategoryInput) {
    const values = {
      type: input.type ?? 'all',
      name: sanitizePlainText(input.name),
      parent_id: input.parent_id ?? null,
      thumbnail_key: input.thumbnail_key ?? null,
      cover_key: input.cover_key ?? null,
      display_order: input.display_order ?? 0,
    }
    const inserted = await this.db.insertInto('categories').values(values).executeTakeFirstOrThrow()
    const id = Number(inserted.insertId)
    await this.audit.record({ actor: ctx.audit, action: 'create', entityType: 'category', entityId: id, summary: values.name, after: values })
    return this.db.selectFrom('categories').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  }

  async updateCategory(ctx: CmsRequestContext, id: number, input: Partial<CategoryInput>) {
    const before = await this.db.selectFrom('categories').selectAll().where('id', '=', id).executeTakeFirst()
    if (!before) throw errors.notFound('Category')
    if (input.parent_id !== undefined && input.parent_id !== null) {
      if (input.parent_id === id) throw errors.badRequest('A category cannot be its own parent')
      if (await this.isDescendant(input.parent_id, id)) throw errors.badRequest('A category cannot be moved inside its own subtree')
    }
    const patch: Record<string, unknown> = {}
    if (input.name !== undefined) patch.name = sanitizePlainText(input.name)
    if (input.type !== undefined) patch.type = input.type
    if (input.parent_id !== undefined) patch.parent_id = input.parent_id
    if (input.thumbnail_key !== undefined) patch.thumbnail_key = input.thumbnail_key
    if (input.cover_key !== undefined) patch.cover_key = input.cover_key
    if (input.display_order !== undefined) patch.display_order = input.display_order
    if (!Object.keys(patch).length) throw errors.badRequest('Nothing to update')

    await this.db.updateTable('categories').set(patch as never).where('id', '=', id).execute()
    await this.cleanupReplaced(before.thumbnail_key, patch.thumbnail_key)
    await this.cleanupReplaced(before.cover_key, patch.cover_key)
    const diff = diffSnapshots(before as unknown as Record<string, unknown>, { ...before, ...patch } as Record<string, unknown>)
    await this.audit.record({
      actor: ctx.audit,
      action: 'update',
      entityType: 'category',
      entityId: id,
      summary: before.name,
      before: diff.before,
      after: diff.after,
    })
    return this.db.selectFrom('categories').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  }

  async deleteCategory(ctx: CmsRequestContext, id: number): Promise<void> {
    const before = await this.db.selectFrom('categories').selectAll().where('id', '=', id).executeTakeFirst()
    if (!before) throw errors.notFound('Category')
    const child = await this.db.selectFrom('categories').select('id').where('parent_id', '=', id).executeTakeFirst()
    if (child) throw errors.conflict('Move or delete the subcategories first')
    await this.db.deleteFrom('categories').where('id', '=', id).execute()
    if (before.thumbnail_key) await this.storage.removeObject(before.thumbnail_key).catch(() => undefined)
    if (before.cover_key) await this.storage.removeObject(before.cover_key).catch(() => undefined)
    await this.audit.record({ actor: ctx.audit, action: 'delete', entityType: 'category', entityId: id, summary: before.name, before })
  }

  /** Persists a drag-and-drop reorder: each entry is `{ id, parent_id, position }`. */
  async reorderCategories(ctx: CmsRequestContext, items: Array<{ id: number; parent_id: number | null; position: number }>) {
    for (const item of items) {
      if (item.parent_id !== null && (item.parent_id === item.id || (await this.isDescendant(item.parent_id, item.id)))) {
        throw errors.badRequest('A category cannot be moved inside its own subtree')
      }
    }
    await this.db.transaction().execute(async (trx) => {
      for (const item of items) {
        await trx
          .updateTable('categories')
          .set({ parent_id: item.parent_id, display_order: item.position })
          .where('id', '=', item.id)
          .execute()
      }
    })
    await this.audit.record({
      actor: ctx.audit,
      action: 'update',
      entityType: 'category',
      entityId: null,
      summary: `Reordered ${items.length} categories`,
      after: { items },
    })
  }

  /** True when `candidate` sits inside the subtree rooted at `ancestorId`. */
  private async isDescendant(candidate: number, ancestorId: number): Promise<boolean> {
    let cursor: number | null = candidate
    for (let guard = 0; cursor !== null && guard < 64; guard += 1) {
      if (cursor === ancestorId) return true
      const row: { parent_id: number | null } | undefined = await this.db
        .selectFrom('categories')
        .select('parent_id')
        .where('id', '=', cursor)
        .executeTakeFirst()
      cursor = row?.parent_id ?? null
    }
    return false
  }

  // ── Collections ────────────────────────────────────────────────────────

  async listCollections(params: { page: number; limit: number; q?: string }) {
    const base = () => {
      let q = this.db.selectFrom('collections')
      if (params.q) q = q.where(sql<boolean>`collections.title LIKE ${likePattern(params.q)}`)
      return q
    }
    const [rows, total] = await Promise.all([
      base()
        .selectAll('collections')
        .select((eb) =>
          eb
            .selectFrom('collection_items as ci')
            .whereRef('ci.collection_id', '=', 'collections.id')
            .select(eb.fn.countAll().as('n'))
            .as('items_count'),
        )
        .orderBy('collections.display_order')
        .orderBy('collections.id', 'desc')
        .limit(params.limit)
        .offset((params.page - 1) * params.limit)
        .execute(),
      base()
        .select((eb) => eb.fn.countAll().as('total'))
        .executeTakeFirst(),
    ])
    return { rows, pagination: pageInfo(params.page, params.limit, Number(total?.total ?? 0)) }
  }

  async getCollection(id: number) {
    const collection = await this.db.selectFrom('collections').selectAll().where('id', '=', id).executeTakeFirst()
    if (!collection) throw errors.notFound('Collection')
    const items = await this.db
      .selectFrom('collection_items as ci')
      .select(['ci.item_type', 'ci.item_id', 'ci.position'])
      .select((eb) => [
        eb
          .selectFrom('books')
          .whereRef('books.id', '=', 'ci.item_id')
          .where(sql<boolean>`ci.item_type = 'book'`)
          .select('books.title')
          .as('book_title'),
        eb
          .selectFrom('articles')
          .whereRef('articles.id', '=', 'ci.item_id')
          .where(sql<boolean>`ci.item_type = 'article'`)
          .select('articles.title')
          .as('article_title'),
      ])
      .where('ci.collection_id', '=', id)
      .orderBy('ci.position')
      .execute()
    return {
      ...collection,
      items: items.map((i) => ({
        item_type: i.item_type,
        item_id: i.item_id,
        position: i.position,
        title: i.book_title ?? i.article_title ?? `#${i.item_id}`,
      })),
    }
  }

  async createCollection(ctx: CmsRequestContext, input: CollectionInput) {
    const values = this.collectionColumns(input)
    const inserted = await this.db.insertInto('collections').values(values as never).executeTakeFirstOrThrow()
    const id = Number(inserted.insertId)
    await this.audit.record({ actor: ctx.audit, action: 'create', entityType: 'collection', entityId: id, summary: input.title, after: values })
    return this.getCollection(id)
  }

  async updateCollection(ctx: CmsRequestContext, id: number, input: Partial<CollectionInput>) {
    const before = await this.db.selectFrom('collections').selectAll().where('id', '=', id).executeTakeFirst()
    if (!before) throw errors.notFound('Collection')
    const patch = this.collectionColumns(input)
    if (!Object.keys(patch).length) throw errors.badRequest('Nothing to update')
    await this.db.updateTable('collections').set(patch as never).where('id', '=', id).execute()
    await this.cleanupReplaced(before.thumbnail_key, patch.thumbnail_key)
    const diff = diffSnapshots(before as unknown as Record<string, unknown>, { ...before, ...patch } as Record<string, unknown>)
    await this.audit.record({
      actor: ctx.audit,
      action: 'update',
      entityType: 'collection',
      entityId: id,
      summary: before.title,
      before: diff.before,
      after: diff.after,
    })
    return this.getCollection(id)
  }

  async deleteCollection(ctx: CmsRequestContext, id: number): Promise<void> {
    const before = await this.db.selectFrom('collections').selectAll().where('id', '=', id).executeTakeFirst()
    if (!before) throw errors.notFound('Collection')
    await this.db.deleteFrom('collections').where('id', '=', id).execute()
    if (before.thumbnail_key) await this.storage.removeObject(before.thumbnail_key).catch(() => undefined)
    await this.audit.record({ actor: ctx.audit, action: 'delete', entityType: 'collection', entityId: id, summary: before.title, before })
  }

  /** Replaces the whole item list; `items` order becomes `position`. */
  async setCollectionItems(ctx: CmsRequestContext, id: number, items: Array<{ item_type: ItemType; item_id: number }>) {
    const collection = await this.db.selectFrom('collections').select('id').where('id', '=', id).executeTakeFirst()
    if (!collection) throw errors.notFound('Collection')
    await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom('collection_items').where('collection_id', '=', id).execute()
      if (items.length) {
        await trx
          .insertInto('collection_items')
          .ignore()
          .values(items.map((item, position) => ({ collection_id: id, item_type: item.item_type, item_id: item.item_id, position })))
          .execute()
      }
    })
    await this.audit.record({
      actor: ctx.audit,
      action: 'update',
      entityType: 'collection',
      entityId: id,
      summary: `Set ${items.length} items`,
      after: { items },
    })
    return this.getCollection(id)
  }

  private collectionColumns(input: Partial<CollectionInput>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    if (input.title !== undefined) out.title = sanitizePlainText(input.title)
    if (input.description !== undefined) out.description = input.description === null ? null : sanitizeHtml(input.description)
    if (input.thumbnail_key !== undefined) out.thumbnail_key = input.thumbnail_key
    if (input.display_order !== undefined) out.display_order = input.display_order
    if (input.is_published !== undefined) out.is_published = input.is_published
    if (input.is_featured !== undefined) out.is_featured = input.is_featured
    if (input.slug !== undefined) out.slug = input.slug
    return out
  }

  // ── Sliders ────────────────────────────────────────────────────────────

  async listSliders(params: { placement?: string } = {}) {
    let q = this.db.selectFrom('sliders').selectAll().orderBy('display_order').orderBy('id', 'desc')
    if (params.placement) q = q.where('placement', '=', params.placement)
    return q.execute()
  }

  async createSlider(ctx: CmsRequestContext, input: SliderInput) {
    const values = this.sliderColumns(input)
    const inserted = await this.db.insertInto('sliders').values(values as never).executeTakeFirstOrThrow()
    const id = Number(inserted.insertId)
    await this.audit.record({ actor: ctx.audit, action: 'create', entityType: 'slider', entityId: id, summary: input.title ?? 'Slider', after: values })
    return this.db.selectFrom('sliders').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  }

  async updateSlider(ctx: CmsRequestContext, id: number, input: Partial<SliderInput>) {
    const before = await this.db.selectFrom('sliders').selectAll().where('id', '=', id).executeTakeFirst()
    if (!before) throw errors.notFound('Slider')
    const patch = this.sliderColumns(input)
    if (!Object.keys(patch).length) throw errors.badRequest('Nothing to update')
    await this.db.updateTable('sliders').set(patch as never).where('id', '=', id).execute()
    await this.cleanupReplaced(before.image_key, patch.image_key)
    await this.cleanupReplaced(before.mobile_image_key, patch.mobile_image_key)
    const diff = diffSnapshots(before as unknown as Record<string, unknown>, { ...before, ...patch } as Record<string, unknown>)
    await this.audit.record({
      actor: ctx.audit,
      action: 'update',
      entityType: 'slider',
      entityId: id,
      summary: before.title ?? 'Slider',
      before: diff.before,
      after: diff.after,
    })
    return this.db.selectFrom('sliders').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  }

  async deleteSlider(ctx: CmsRequestContext, id: number): Promise<void> {
    const before = await this.db.selectFrom('sliders').selectAll().where('id', '=', id).executeTakeFirst()
    if (!before) throw errors.notFound('Slider')
    await this.db.deleteFrom('sliders').where('id', '=', id).execute()
    if (before.image_key) await this.storage.removeObject(before.image_key).catch(() => undefined)
    if (before.mobile_image_key) await this.storage.removeObject(before.mobile_image_key).catch(() => undefined)
    await this.audit.record({ actor: ctx.audit, action: 'delete', entityType: 'slider', entityId: id, summary: before.title ?? 'Slider', before })
  }

  async reorderSliders(ctx: CmsRequestContext, orderedIds: number[]): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      for (const [index, id] of orderedIds.entries()) {
        await trx.updateTable('sliders').set({ display_order: index }).where('id', '=', id).execute()
      }
    })
    await this.audit.record({
      actor: ctx.audit,
      action: 'update',
      entityType: 'slider',
      entityId: null,
      summary: `Reordered ${orderedIds.length} sliders`,
      after: { order: orderedIds },
    })
  }

  private sliderColumns(input: Partial<SliderInput>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    if (input.title !== undefined) out.title = input.title === null ? null : sanitizePlainText(input.title)
    if (input.image_key !== undefined) out.image_key = input.image_key
    if (input.mobile_image_key !== undefined) out.mobile_image_key = input.mobile_image_key
    if (input.link !== undefined) out.link = input.link
    if (input.display_order !== undefined) out.display_order = input.display_order
    if (input.is_active !== undefined) out.is_active = input.is_active
    if (input.starts_at !== undefined) out.starts_at = input.starts_at ? new Date(input.starts_at) : null
    if (input.ends_at !== undefined) out.ends_at = input.ends_at ? new Date(input.ends_at) : null
    if (input.audience !== undefined) out.audience = input.audience
    if (input.placement !== undefined) out.placement = input.placement
    return out
  }

  private async cleanupReplaced(oldKey: string | null, nextKey: unknown) {
    if (oldKey && nextKey !== undefined && nextKey !== oldKey) {
      await this.storage.removeObject(oldKey).catch(() => undefined)
    }
  }
}
