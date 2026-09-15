import { sql, type Kysely } from 'kysely'
import type { Database, ItemType } from '../db/types.js'
import { errors } from '../lib/errors.js'

/**
 * Per-user interactions: reviews & ratings, saved library, reading progress,
 * author follows and the notification inbox.
 */
export class EngagementService {
  constructor(private readonly db: Kysely<Database>) {}

  // ── Reviews ────────────────────────────────────────────────────────────

  private reviewQuery() {
    return this.db
      .selectFrom('reviews as r')
      .innerJoin('users as u', 'u.id', 'r.user_id')
      .select(['r.id', 'r.user_id', 'r.item_type', 'r.item_id', 'r.rating', 'r.content', 'r.created_at', 'r.updated_at', 'u.name as user_name', 'u.image as user_image'])
  }

  async listReviews(input: { itemType: ItemType; itemId: number; page: number; limit: number; viewerId?: string }) {
    const base = this.reviewQuery().where('r.item_type', '=', input.itemType).where('r.item_id', '=', input.itemId)
    const [rows, summary, own] = await Promise.all([
      base.orderBy('r.created_at', 'desc').limit(input.limit).offset((input.page - 1) * input.limit).execute(),
      this.db
        .selectFrom('reviews')
        .select((eb) => [eb.fn.countAll().as('count'), sql<number>`COALESCE(AVG(rating), 0)`.as('average')])
        .where('item_type', '=', input.itemType)
        .where('item_id', '=', input.itemId)
        .executeTakeFirst(),
      input.viewerId ? base.where('r.user_id', '=', input.viewerId).executeTakeFirst() : Promise.resolve(undefined),
    ])
    return {
      rows,
      own: own ?? null,
      total: Number(summary?.count ?? 0),
      average: Math.round(Number(summary?.average ?? 0) * 100) / 100,
    }
  }

  /** One review per user per item: submitting again edits the existing review. */
  async upsertReview(input: { userId: string; itemType: ItemType; itemId: number; rating: number; content: string | null }) {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .insertInto('reviews')
        .values({ user_id: input.userId, item_type: input.itemType, item_id: input.itemId, rating: input.rating, content: input.content })
        .onDuplicateKeyUpdate({ rating: input.rating, content: input.content })
        .execute()
      await this.refreshRating(trx, input.itemType, input.itemId)
    })
    return this.reviewQuery()
      .where('r.user_id', '=', input.userId)
      .where('r.item_type', '=', input.itemType)
      .where('r.item_id', '=', input.itemId)
      .executeTakeFirstOrThrow()
  }

  async deleteReview(input: { reviewId: number; userId: string; isAdmin: boolean }): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const review = await trx.selectFrom('reviews').selectAll().where('id', '=', input.reviewId).forUpdate().executeTakeFirst()
      if (!review) throw errors.notFound('Review')
      if (review.user_id !== input.userId && !input.isAdmin) throw errors.forbidden('You can only delete your own reviews')
      await trx.deleteFrom('reviews').where('id', '=', input.reviewId).execute()
      await this.refreshRating(trx, review.item_type, review.item_id)
    })
  }

  private async refreshRating(trx: Kysely<Database>, itemType: ItemType, itemId: number) {
    const table = itemType === 'book' ? 'books' : 'articles'
    await sql`
      UPDATE ${sql.table(table)} t
      JOIN (
        SELECT COALESCE(AVG(rating), 0) AS avg_rating, COUNT(*) AS n
        FROM reviews WHERE item_type = ${itemType} AND item_id = ${itemId}
      ) s
      SET t.rating_avg = ROUND(s.avg_rating, 2), t.rating_count = s.n, t.updated_at = t.updated_at
      WHERE t.id = ${itemId}
    `.execute(trx)
  }

  // ── Library (saved items) ──────────────────────────────────────────────

  async listLibrary(userId: string) {
    return this.db
      .selectFrom('library_items')
      .select(['item_type', 'item_id', 'created_at'])
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .execute()
  }

  async isInLibrary(userId: string, itemType: ItemType, itemId: number): Promise<boolean> {
    const row = await this.db
      .selectFrom('library_items')
      .select('item_id')
      .where('user_id', '=', userId)
      .where('item_type', '=', itemType)
      .where('item_id', '=', itemId)
      .executeTakeFirst()
    return Boolean(row)
  }

  async addToLibrary(userId: string, itemType: ItemType, itemId: number) {
    await this.db.insertInto('library_items').ignore().values({ user_id: userId, item_type: itemType, item_id: itemId }).execute()
  }

  async removeFromLibrary(userId: string, itemType: ItemType, itemId: number) {
    await this.db
      .deleteFrom('library_items')
      .where('user_id', '=', userId)
      .where('item_type', '=', itemType)
      .where('item_id', '=', itemId)
      .execute()
  }

  // ── Reading progress ───────────────────────────────────────────────────

  async getProgress(userId: string, bookId: number) {
    return this.db
      .selectFrom('reading_progress')
      .select(['format', 'location', 'progress', 'updated_at'])
      .where('user_id', '=', userId)
      .where('book_id', '=', bookId)
      .execute()
  }

  async saveProgress(input: { userId: string; bookId: number; format: 'pdf' | 'epub' | 'audio'; location: string | null; progress: number }) {
    await this.db
      .insertInto('reading_progress')
      .values({ user_id: input.userId, book_id: input.bookId, format: input.format, location: input.location, progress: input.progress })
      .onDuplicateKeyUpdate({ location: input.location, progress: input.progress })
      .execute()
  }

  // ── Follows ────────────────────────────────────────────────────────────

  async isFollowing(userId: string, authorId: number): Promise<boolean> {
    const row = await this.db
      .selectFrom('author_follows')
      .select('author_id')
      .where('user_id', '=', userId)
      .where('author_id', '=', authorId)
      .executeTakeFirst()
    return Boolean(row)
  }

  async setFollowing(userId: string, authorId: number, follow: boolean) {
    if (follow) {
      await this.db.insertInto('author_follows').ignore().values({ user_id: userId, author_id: authorId }).execute()
    } else {
      await this.db.deleteFrom('author_follows').where('user_id', '=', userId).where('author_id', '=', authorId).execute()
    }
    const count = await this.db
      .selectFrom('author_follows')
      .select((eb) => eb.fn.countAll().as('n'))
      .where('author_id', '=', authorId)
      .executeTakeFirst()
    return { is_following: follow, followers_count: Number(count?.n ?? 0) }
  }

  async followedAuthorIds(userId: string): Promise<number[]> {
    const rows = await this.db.selectFrom('author_follows').select('author_id').where('user_id', '=', userId).execute()
    return rows.map((r) => r.author_id)
  }

  // ── Notifications ──────────────────────────────────────────────────────

  async listNotifications(userId: string | null, limit = 50) {
    let q = this.db.selectFrom('notifications').selectAll().orderBy('created_at', 'desc').limit(limit)
    q = userId ? q.where((eb) => eb.or([eb('user_id', 'is', null), eb('user_id', '=', userId)])) : q.where('user_id', 'is', null)
    return q.execute()
  }
}
