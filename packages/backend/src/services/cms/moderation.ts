import { sql, type Kysely, type SelectQueryBuilder } from 'kysely'
import type { Database, ItemType, ReportReason, ReportStatus, ReviewStatus } from '../../db/types.js'
import { likePattern, pageInfo } from '../../http/validate.js'
import { errors } from '../../lib/errors.js'
import { sanitizePlainText } from '../../lib/sanitize.js'
import { AuditService } from '../audit.js'
import type { CmsRequestContext } from './content.js'

/**
 * Review moderation and reporting.
 *
 * Only `published` reviews are visible to readers and counted in the rating
 * aggregate, so hiding a review immediately corrects the item's rating.
 */

export interface ReviewListParams {
  page: number
  limit: number
  q?: string
  status?: ReviewStatus
  itemType?: ItemType
  itemId?: number
  rating?: number
  reportedOnly?: boolean
}

export class ModerationService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly audit: AuditService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // ── Reviews ────────────────────────────────────────────────────────────

  async listReviews(params: ReviewListParams) {
    const filtered = <T extends SelectQueryBuilder<Database, 'reviews', object>>(builder: T): T => {
      let q = builder
      if (params.status) q = q.where('status', '=', params.status) as T
      if (params.itemType) q = q.where('item_type', '=', params.itemType) as T
      if (params.itemId) q = q.where('item_id', '=', params.itemId) as T
      if (params.rating) q = q.where('rating', '=', params.rating) as T
      if (params.reportedOnly) q = q.where('report_count', '>', 0) as T
      if (params.q) q = q.where(sql<boolean>`reviews.content LIKE ${likePattern(params.q)}`) as T
      return q
    }

    const [rows, total] = await Promise.all([
      filtered(
        this.db
          .selectFrom('reviews')
          .selectAll('reviews')
          .select((eb) => [
            eb.selectFrom('users').whereRef('users.id', '=', 'reviews.user_id').select('users.name').as('user_name'),
            eb.selectFrom('users').whereRef('users.id', '=', 'reviews.user_id').select('users.email').as('user_email'),
            eb
              .selectFrom('books')
              .whereRef('books.id', '=', 'reviews.item_id')
              .where(sql<boolean>`reviews.item_type = 'book'`)
              .select('books.title')
              .as('book_title'),
            eb
              .selectFrom('articles')
              .whereRef('articles.id', '=', 'reviews.item_id')
              .where(sql<boolean>`reviews.item_type = 'article'`)
              .select('articles.title')
              .as('article_title'),
          ]) as unknown as SelectQueryBuilder<Database, 'reviews', object>,
      )
        .orderBy('reviews.report_count', 'desc')
        .orderBy('reviews.created_at', 'desc')
        .limit(params.limit)
        .offset((params.page - 1) * params.limit)
        .execute(),
      filtered(this.db.selectFrom('reviews').select((eb) => eb.fn.countAll().as('total'))).executeTakeFirst(),
    ])
    return { rows: rows as Array<Record<string, unknown>>, pagination: pageInfo(params.page, params.limit, Number(total?.total ?? 0)) }
  }

  /** Publish or hide a review; the item's rating aggregate is recomputed. */
  async setReviewStatus(ctx: CmsRequestContext, id: number, status: ReviewStatus, note?: string | null) {
    const before = await this.db.selectFrom('reviews').selectAll().where('id', '=', id).executeTakeFirst()
    if (!before) throw errors.notFound('Review')
    await this.db.transaction().execute(async (trx) => {
      await trx
        .updateTable('reviews')
        .set({
          status,
          moderated_by: ctx.actor.userId,
          moderated_at: this.now(),
          moderation_note: note ? sanitizePlainText(note).slice(0, 500) : null,
        })
        .where('id', '=', id)
        .execute()
      await refreshRatingAggregate(trx, before.item_type, before.item_id)
    })
    await this.audit.record({
      actor: ctx.audit,
      action: 'moderate',
      entityType: 'review',
      entityId: id,
      summary: `${before.item_type} #${before.item_id}: ${before.status} → ${status}`,
      before: { status: before.status },
      after: { status, note: note ?? null },
    })
    return this.db.selectFrom('reviews').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  }

  async deleteReview(ctx: CmsRequestContext, id: number): Promise<void> {
    const before = await this.db.selectFrom('reviews').selectAll().where('id', '=', id).executeTakeFirst()
    if (!before) throw errors.notFound('Review')
    await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom('reviews').where('id', '=', id).execute()
      await refreshRatingAggregate(trx, before.item_type, before.item_id)
    })
    await this.audit.record({
      actor: ctx.audit,
      action: 'delete',
      entityType: 'review',
      entityId: id,
      summary: `${before.item_type} #${before.item_id}`,
      before,
    })
  }

  async bulkModerate(ctx: CmsRequestContext, ids: number[], status: ReviewStatus) {
    const succeeded: number[] = []
    const failed: Array<{ id: number; message: string }> = []
    for (const id of ids) {
      try {
        await this.setReviewStatus(ctx, id, status)
        succeeded.push(id)
      } catch (err) {
        failed.push({ id, message: err instanceof Error ? err.message : 'Failed' })
      }
    }
    return { succeeded, failed }
  }

  // ── Reports ────────────────────────────────────────────────────────────

  /** Filed by a reader from the storefront. */
  async report(input: { reviewId: number; reporterId: string | null; reason: ReportReason; note?: string | null }) {
    const review = await this.db.selectFrom('reviews').select('id').where('id', '=', input.reviewId).executeTakeFirst()
    if (!review) throw errors.notFound('Review')
    // One report per reader per review; a repeat report updates the reason.
    await this.db.transaction().execute(async (trx) => {
      const existing = input.reporterId
        ? await trx
            .selectFrom('review_reports')
            .select('id')
            .where('review_id', '=', input.reviewId)
            .where('reporter_id', '=', input.reporterId)
            .where('status', '=', 'open')
            .executeTakeFirst()
        : undefined
      if (existing) {
        await trx
          .updateTable('review_reports')
          .set({ reason: input.reason, note: input.note ? sanitizePlainText(input.note).slice(0, 500) : null })
          .where('id', '=', existing.id)
          .execute()
        return
      }
      await trx
        .insertInto('review_reports')
        .values({
          review_id: input.reviewId,
          reporter_id: input.reporterId,
          reason: input.reason,
          note: input.note ? sanitizePlainText(input.note).slice(0, 500) : null,
        })
        .execute()
      await trx
        .updateTable('reviews')
        .set({ report_count: sql`report_count + 1` })
        .where('id', '=', input.reviewId)
        .execute()
    })
  }

  async listReports(params: { page: number; limit: number; status?: ReportStatus }) {
    const filtered = <T extends SelectQueryBuilder<Database, 'review_reports', object>>(builder: T): T =>
      params.status ? (builder.where('status', '=', params.status) as T) : builder

    const [rows, total] = await Promise.all([
      filtered(
        this.db
          .selectFrom('review_reports')
          .selectAll('review_reports')
          .select((eb) => [
            eb.selectFrom('reviews').whereRef('reviews.id', '=', 'review_reports.review_id').select('reviews.content').as('review_content'),
            eb.selectFrom('reviews').whereRef('reviews.id', '=', 'review_reports.review_id').select('reviews.rating').as('review_rating'),
            eb.selectFrom('reviews').whereRef('reviews.id', '=', 'review_reports.review_id').select('reviews.status').as('review_status'),
            eb
              .selectFrom('users')
              .whereRef('users.id', '=', 'review_reports.reporter_id')
              .select('users.email')
              .as('reporter_email'),
          ]) as unknown as SelectQueryBuilder<Database, 'review_reports', object>,
      )
        .orderBy('review_reports.created_at', 'desc')
        .limit(params.limit)
        .offset((params.page - 1) * params.limit)
        .execute(),
      filtered(this.db.selectFrom('review_reports').select((eb) => eb.fn.countAll().as('total'))).executeTakeFirst(),
    ])
    return { rows: rows as Array<Record<string, unknown>>, pagination: pageInfo(params.page, params.limit, Number(total?.total ?? 0)) }
  }

  /** `actioned` also hides the review; `dismissed` leaves it published. */
  async resolveReport(ctx: CmsRequestContext, id: number, outcome: Exclude<ReportStatus, 'open'>) {
    const report = await this.db.selectFrom('review_reports').selectAll().where('id', '=', id).executeTakeFirst()
    if (!report) throw errors.notFound('Report')
    await this.db
      .updateTable('review_reports')
      .set({ status: outcome, resolved_by: ctx.actor.userId, resolved_at: this.now() })
      .where('id', '=', id)
      .execute()
    if (outcome === 'actioned') await this.setReviewStatus(ctx, report.review_id, 'hidden', 'Hidden after a report')
    await this.audit.record({
      actor: ctx.audit,
      action: 'moderate',
      entityType: 'review_report',
      entityId: id,
      summary: `Report ${outcome}`,
      before: { status: report.status },
      after: { status: outcome },
    })
  }

  // ── Analytics ──────────────────────────────────────────────────────────

  async metrics(days = 30) {
    const since = new Date(this.now().getTime() - days * 24 * 3600 * 1000)
    const [summary, distribution, pending, daily] = await Promise.all([
      this.db
        .selectFrom('reviews')
        .select((eb) => [
          eb.fn.countAll().as('total'),
          sql<number>`COALESCE(AVG(CASE WHEN status = 'published' THEN rating END), 0)`.as('average'),
          sql<number>`SUM(status = 'pending')`.as('pending'),
          sql<number>`SUM(status = 'hidden')`.as('hidden'),
          sql<number>`SUM(report_count > 0)`.as('reported'),
        ])
        .executeTakeFirst(),
      this.db
        .selectFrom('reviews')
        .select((eb) => ['rating', eb.fn.countAll().as('n')])
        .where('status', '=', 'published')
        .groupBy('rating')
        .orderBy('rating')
        .execute(),
      this.db
        .selectFrom('review_reports')
        .select((eb) => eb.fn.countAll().as('n'))
        .where('status', '=', 'open')
        .executeTakeFirst(),
      this.db
        .selectFrom('reviews')
        .select((eb) => [sql<string>`DATE(created_at)`.as('date'), eb.fn.countAll().as('n')])
        .where('created_at', '>=', since)
        .groupBy(sql`DATE(created_at)`)
        .orderBy(sql`DATE(created_at)`)
        .execute(),
    ])

    return {
      total: Number(summary?.total ?? 0),
      average_rating: Math.round(Number(summary?.average ?? 0) * 100) / 100,
      pending: Number(summary?.pending ?? 0),
      hidden: Number(summary?.hidden ?? 0),
      reported: Number(summary?.reported ?? 0),
      open_reports: Number(pending?.n ?? 0),
      distribution: [1, 2, 3, 4, 5].map((rating) => ({
        rating,
        count: Number(distribution.find((d) => Number(d.rating) === rating)?.n ?? 0),
      })),
      daily: daily.map((d) => ({ date: String(d.date), count: Number(d.n) })),
    }
  }
}

/**
 * Recompute `rating_avg` / `rating_count` from the **published** reviews only.
 * Shared with `EngagementService` so the storefront and the CMS always agree.
 */
export async function refreshRatingAggregate(db: Kysely<Database>, itemType: ItemType, itemId: number): Promise<void> {
  const table = itemType === 'book' ? 'books' : 'articles'
  await sql`
    UPDATE ${sql.table(table)} t
    JOIN (
      SELECT COALESCE(AVG(rating), 0) AS avg_rating, COUNT(*) AS n
      FROM reviews WHERE item_type = ${itemType} AND item_id = ${itemId} AND status = 'published'
    ) s
    SET t.rating_avg = ROUND(s.avg_rating, 2), t.rating_count = s.n, t.updated_at = t.updated_at
    WHERE t.id = ${itemId}
  `.execute(db)
}
