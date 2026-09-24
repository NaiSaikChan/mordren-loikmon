import { sql, type Kysely } from 'kysely'
import type { Database } from '../../db/types.js'
import type { CmsActor } from '../rbac.js'

/**
 * Dashboard aggregates.
 *
 * Revenue is reported as an **estimate**: purchases happen inside the App Store
 * and Google Play, so the platform never sees a settled amount. The figure is
 * the list price of the plans whose subscriptions started in the period, before
 * store commission, tax and refunds — useful as a trend, not as accounting.
 */

export interface DateRange {
  from: Date
  to: Date
}

export interface TimeSeriesPoint {
  date: string
  value: number
}

export interface AdminOverview {
  range: { from: string; to: string }
  revenue: { estimated_cents: number; currency: string; new_subscriptions: number; series: TimeSeriesPoint[] }
  users: { total: number; new_in_range: number; active_in_range: number; verified: number; series: TimeSeriesPoint[] }
  subscriptions: { active: number; in_grace: number; canceled: number; expired: number; by_plan: Array<{ plan_code: string; count: number }> }
  content: {
    books: Record<string, number>
    articles: Record<string, number>
    authors: number
    categories: number
    collections: number
    total_views: number
  }
  top_books: Array<{ id: number; title: string; views: number; rating: number }>
  top_articles: Array<{ id: number; title: string; views: number; rating: number }>
}

export interface AuthorOverview {
  range: { from: string; to: string }
  totals: { books: number; articles: number; views: number; downloads: number; listens: number; followers: number; average_rating: number }
  top_books: Array<{ id: number; title: string; views: number; rating: number; rating_count: number }>
  top_articles: Array<{ id: number; title: string; views: number; rating: number }>
  reading_progress: Array<{ format: string; readers: number }>
}

const DAY_MS = 24 * 3600 * 1000

export function resolveRange(input: { from?: string; to?: string; days?: number }, now = new Date()): DateRange {
  const to = input.to ? new Date(input.to) : now
  const from = input.from ? new Date(input.from) : new Date(to.getTime() - (input.days ?? 30) * DAY_MS)
  return { from, to }
}

/** Fills gaps so a chart has one point per day across the whole range. */
export function fillSeries(rows: Array<{ date: string; value: number }>, range: DateRange): TimeSeriesPoint[] {
  const byDate = new Map(rows.map((r) => [r.date, r.value]))
  const out: TimeSeriesPoint[] = []
  const cursor = new Date(Date.UTC(range.from.getUTCFullYear(), range.from.getUTCMonth(), range.from.getUTCDate()))
  const end = Date.UTC(range.to.getUTCFullYear(), range.to.getUTCMonth(), range.to.getUTCDate())
  for (let guard = 0; cursor.getTime() <= end && guard < 400; guard += 1) {
    const key = cursor.toISOString().slice(0, 10)
    out.push({ date: key, value: byDate.get(key) ?? 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

export class AnalyticsService {
  constructor(private readonly db: Kysely<Database>) {}

  // ── Admin & manager dashboard ──────────────────────────────────────────

  async adminOverview(range: DateRange): Promise<AdminOverview> {
    const [revenue, revenueSeries, userTotals, newUsers, activeUsers, subscriptionCounts, byPlan, bookStatus, articleStatus, counts, topBooks, topArticles] =
      await Promise.all([
        this.db
          .selectFrom('subscriptions as s')
          .innerJoin('subscription_plans as p', 'p.code', 's.plan_code')
          .select((eb) => [
            eb.fn.coalesce(eb.fn.sum<number>('p.price_cents'), sql<number>`0`).as('cents'),
            eb.fn.countAll().as('n'),
          ])
          .where('s.started_at', '>=', range.from)
          .where('s.started_at', '<=', range.to)
          .executeTakeFirst(),
        this.db
          .selectFrom('subscriptions as s')
          .innerJoin('subscription_plans as p', 'p.code', 's.plan_code')
          .select((eb) => [sql<string>`DATE(s.started_at)`.as('date'), eb.fn.coalesce(eb.fn.sum<number>('p.price_cents'), sql<number>`0`).as('value')])
          .where('s.started_at', '>=', range.from)
          .where('s.started_at', '<=', range.to)
          .groupBy(sql`DATE(s.started_at)`)
          .execute(),
        this.db
          .selectFrom('users')
          .select((eb) => [eb.fn.countAll().as('total'), sql<number>`SUM(email_verified = 1)`.as('verified')])
          .executeTakeFirst(),
        this.db
          .selectFrom('users')
          .select((eb) => [sql<string>`DATE(created_at)`.as('date'), eb.fn.countAll().as('value')])
          .where('created_at', '>=', range.from)
          .where('created_at', '<=', range.to)
          .groupBy(sql`DATE(created_at)`)
          .execute(),
        this.db
          .selectFrom('sessions')
          .select((eb) => eb.fn.count<number>('user_id').distinct().as('n'))
          .where('updated_at', '>=', range.from)
          .executeTakeFirst(),
        this.db
          .selectFrom('subscriptions')
          .select((eb) => ['status', eb.fn.countAll().as('n')])
          .groupBy('status')
          .execute(),
        this.db
          .selectFrom('subscriptions')
          .select((eb) => ['plan_code', eb.fn.countAll().as('n')])
          .where('status', 'in', ['active', 'grace_period'])
          .groupBy('plan_code')
          .execute(),
        this.db
          .selectFrom('books')
          .select((eb) => ['status', eb.fn.countAll().as('n')])
          .groupBy('status')
          .execute(),
        this.db
          .selectFrom('articles')
          .select((eb) => ['status', eb.fn.countAll().as('n')])
          .groupBy('status')
          .execute(),
        this.db
          .selectFrom('authors')
          .select((eb) => [
            eb.fn.countAll().as('authors'),
            eb.selectFrom('categories').select(eb.fn.countAll().as('n')).as('categories'),
            eb.selectFrom('collections').select(eb.fn.countAll().as('n')).as('collections'),
            eb.selectFrom('books').select(sql<number>`COALESCE(SUM(view_count), 0)`.as('n')).as('book_views'),
            eb.selectFrom('articles').select(sql<number>`COALESCE(SUM(view_count), 0)`.as('n')).as('article_views'),
          ])
          .executeTakeFirst(),
        this.db
          .selectFrom('books')
          .select(['id', 'title', 'view_count', 'rating_avg'])
          .where('is_published', '=', true)
          .orderBy('view_count', 'desc')
          .limit(10)
          .execute(),
        this.db
          .selectFrom('articles')
          .select(['id', 'title', 'view_count', 'rating_avg'])
          .where('is_published', '=', true)
          .orderBy('view_count', 'desc')
          .limit(10)
          .execute(),
      ])

    const statusCounts = Object.fromEntries(subscriptionCounts.map((r) => [r.status, Number(r.n)]))
    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      revenue: {
        estimated_cents: Number(revenue?.cents ?? 0),
        currency: 'USD',
        new_subscriptions: Number(revenue?.n ?? 0),
        series: fillSeries(
          revenueSeries.map((r) => ({ date: String(r.date), value: Number(r.value) })),
          range,
        ),
      },
      users: {
        total: Number(userTotals?.total ?? 0),
        verified: Number(userTotals?.verified ?? 0),
        new_in_range: newUsers.reduce((sum, r) => sum + Number(r.value), 0),
        active_in_range: Number(activeUsers?.n ?? 0),
        series: fillSeries(
          newUsers.map((r) => ({ date: String(r.date), value: Number(r.value) })),
          range,
        ),
      },
      subscriptions: {
        active: statusCounts.active ?? 0,
        in_grace: statusCounts.grace_period ?? 0,
        canceled: statusCounts.canceled ?? 0,
        expired: statusCounts.expired ?? 0,
        by_plan: byPlan.map((r) => ({ plan_code: r.plan_code ?? 'unknown', count: Number(r.n) })),
      },
      content: {
        books: Object.fromEntries(bookStatus.map((r) => [r.status, Number(r.n)])),
        articles: Object.fromEntries(articleStatus.map((r) => [r.status, Number(r.n)])),
        authors: Number(counts?.authors ?? 0),
        categories: Number(counts?.categories ?? 0),
        collections: Number(counts?.collections ?? 0),
        total_views: Number(counts?.book_views ?? 0) + Number(counts?.article_views ?? 0),
      },
      top_books: topBooks.map((b) => ({ id: b.id, title: b.title, views: Number(b.view_count), rating: Number(b.rating_avg) })),
      top_articles: topArticles.map((a) => ({ id: a.id, title: a.title, views: Number(a.view_count), rating: Number(a.rating_avg) })),
    }
  }

  // ── Author dashboard ───────────────────────────────────────────────────

  /** Everything scoped to the actor's own author profiles. */
  async authorOverview(actor: CmsActor, range: DateRange): Promise<AuthorOverview> {
    const authorIds = actor.ownedAuthorIds
    if (!authorIds.length) {
      return {
        range: { from: range.from.toISOString(), to: range.to.toISOString() },
        totals: { books: 0, articles: 0, views: 0, downloads: 0, listens: 0, followers: 0, average_rating: 0 },
        top_books: [],
        top_articles: [],
        reading_progress: [],
      }
    }

    const [bookTotals, articleTotals, followers, topBooks, topArticles, progress] = await Promise.all([
      this.db
        .selectFrom('books')
        .select((eb) => [
          eb.fn.countAll().as('n'),
          sql<number>`COALESCE(SUM(view_count), 0)`.as('views'),
          sql<number>`COALESCE(AVG(NULLIF(rating_avg, 0)), 0)`.as('rating'),
        ])
        .where('author_id', 'in', authorIds)
        .executeTakeFirst(),
      this.db
        .selectFrom('articles')
        .select((eb) => [eb.fn.countAll().as('n'), sql<number>`COALESCE(SUM(view_count), 0)`.as('views')])
        .where('author_id', 'in', authorIds)
        .executeTakeFirst(),
      this.db
        .selectFrom('author_follows')
        .select((eb) => eb.fn.countAll().as('n'))
        .where('author_id', 'in', authorIds)
        .executeTakeFirst(),
      this.db
        .selectFrom('books')
        .select(['id', 'title', 'view_count', 'rating_avg', 'rating_count'])
        .where('author_id', 'in', authorIds)
        .orderBy('view_count', 'desc')
        .limit(10)
        .execute(),
      this.db
        .selectFrom('articles')
        .select(['id', 'title', 'view_count', 'rating_avg'])
        .where('author_id', 'in', authorIds)
        .orderBy('view_count', 'desc')
        .limit(10)
        .execute(),
      // Distinct readers per format: 'audio' rows are audiobook listens,
      // 'pdf'/'epub' rows are reads of a downloaded or streamed file.
      this.db
        .selectFrom('reading_progress as rp')
        .innerJoin('books as b', 'b.id', 'rp.book_id')
        .select((eb) => ['rp.format', eb.fn.count<number>('rp.user_id').distinct().as('readers')])
        .where('b.author_id', 'in', authorIds)
        .where('rp.updated_at', '>=', range.from)
        .groupBy('rp.format')
        .execute(),
    ])

    const byFormat = Object.fromEntries(progress.map((p) => [p.format, Number(p.readers)]))
    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      totals: {
        books: Number(bookTotals?.n ?? 0),
        articles: Number(articleTotals?.n ?? 0),
        views: Number(bookTotals?.views ?? 0) + Number(articleTotals?.views ?? 0),
        downloads: (byFormat.pdf ?? 0) + (byFormat.epub ?? 0),
        listens: byFormat.audio ?? 0,
        followers: Number(followers?.n ?? 0),
        average_rating: Math.round(Number(bookTotals?.rating ?? 0) * 100) / 100,
      },
      top_books: topBooks.map((b) => ({
        id: b.id,
        title: b.title,
        views: Number(b.view_count),
        rating: Number(b.rating_avg),
        rating_count: Number(b.rating_count),
      })),
      top_articles: topArticles.map((a) => ({ id: a.id, title: a.title, views: Number(a.view_count), rating: Number(a.rating_avg) })),
      reading_progress: progress.map((p) => ({ format: p.format, readers: Number(p.readers) })),
    }
  }

  /** Ranked author performance for the admin dashboard. */
  async authorPerformance(range: DateRange, limit = 10) {
    return (
      await this.db
        .selectFrom('authors as a')
        .select((eb) => [
          'a.id',
          'a.name',
          eb.selectFrom('books').whereRef('books.author_id', '=', 'a.id').select(eb.fn.countAll().as('n')).as('books'),
          eb.selectFrom('articles').whereRef('articles.author_id', '=', 'a.id').select(eb.fn.countAll().as('n')).as('articles'),
          eb
            .selectFrom('books')
            .whereRef('books.author_id', '=', 'a.id')
            .select(sql<number>`COALESCE(SUM(view_count), 0)`.as('n'))
            .as('book_views'),
          eb
            .selectFrom('articles')
            .whereRef('articles.author_id', '=', 'a.id')
            .select(sql<number>`COALESCE(SUM(view_count), 0)`.as('n'))
            .as('article_views'),
          eb
            .selectFrom('author_follows as f')
            .whereRef('f.author_id', '=', 'a.id')
            .select(eb.fn.countAll().as('n'))
            .as('followers'),
          eb
            .selectFrom('books')
            .whereRef('books.author_id', '=', 'a.id')
            .where('books.created_at', '>=', range.from)
            .select(eb.fn.countAll().as('n'))
            .as('new_books'),
        ])
        .orderBy(sql`(book_views + article_views) DESC` as never)
        .limit(limit)
        .execute()
    ).map((r) => ({
      id: r.id,
      name: r.name,
      books: Number(r.books ?? 0),
      articles: Number(r.articles ?? 0),
      views: Number(r.book_views ?? 0) + Number(r.article_views ?? 0),
      followers: Number(r.followers ?? 0),
      new_in_range: Number(r.new_books ?? 0),
    }))
  }

  /** Reads, listens and library saves over the range — the manager's content KPIs. */
  async engagement(range: DateRange) {
    const [progress, library, follows, reviews] = await Promise.all([
      this.db
        .selectFrom('reading_progress')
        .select((eb) => ['format', eb.fn.count<number>('user_id').distinct().as('readers'), eb.fn.countAll().as('sessions')])
        .where('updated_at', '>=', range.from)
        .groupBy('format')
        .execute(),
      this.db
        .selectFrom('library_items')
        .select((eb) => ['item_type', eb.fn.countAll().as('n')])
        .where('created_at', '>=', range.from)
        .groupBy('item_type')
        .execute(),
      this.db
        .selectFrom('author_follows')
        .select((eb) => eb.fn.countAll().as('n'))
        .where('created_at', '>=', range.from)
        .executeTakeFirst(),
      this.db
        .selectFrom('reviews')
        .select((eb) => [sql<string>`DATE(created_at)`.as('date'), eb.fn.countAll().as('value')])
        .where('created_at', '>=', range.from)
        .groupBy(sql`DATE(created_at)`)
        .execute(),
    ])
    return {
      by_format: progress.map((p) => ({ format: p.format, readers: Number(p.readers), sessions: Number(p.sessions) })),
      library_saves: library.map((l) => ({ item_type: l.item_type, count: Number(l.n) })),
      new_follows: Number(follows?.n ?? 0),
      reviews_series: fillSeries(
        reviews.map((r) => ({ date: String(r.date), value: Number(r.value) })),
        range,
      ),
    }
  }
}
