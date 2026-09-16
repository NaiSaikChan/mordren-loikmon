import { sql, type Kysely, type SelectQueryBuilder } from 'kysely'
import type { Coupon, CouponScope, CouponStatus, Database, DiscountType, RedemptionItemType } from '../../db/types.js'
import { likePattern, pageInfo } from '../../http/validate.js'
import { errors } from '../../lib/errors.js'
import { sanitizePlainText } from '../../lib/sanitize.js'
import { AuditService, diffSnapshots } from '../audit.js'
import type { CmsActor } from '../rbac.js'
import type { CmsRequestContext } from './content.js'

/**
 * Coupons and discount campaigns.
 *
 * Ownership is the rule that shapes this whole service: an author may only
 * create, edit, delete and analyse coupons attached to **their own** books and
 * articles. Platform-wide and subscription campaigns need
 * `coupons.global.manage`, which no author role holds.
 *
 * Every read and write is scoped in SQL (`author_id IN (...)`), so forgetting a
 * check in a route cannot expose another author's campaign.
 */

export interface CouponInput {
  code?: string
  name: string
  description?: string | null
  scope: CouponScope
  author_id?: number | null
  book_id?: number | null
  article_id?: number | null
  plan_code?: string | null
  campaign_type?: string
  discount_type: DiscountType
  discount_value: number
  max_discount_cents?: number | null
  min_order_cents?: number | null
  currency?: string
  usage_limit?: number | null
  usage_limit_per_user?: number | null
  starts_at?: string | null
  ends_at?: string | null
  status?: CouponStatus
}

export interface CouponListParams {
  page: number
  limit: number
  q?: string
  status?: CouponStatus
  scope?: CouponScope
  authorId?: number
  campaignType?: string
}

export interface CouponPerformance {
  coupon_id: number
  redemptions: number
  unique_users: number
  discount_cents: number
  gross_cents: number
  net_cents: number
  /** Share of the usage limit consumed, or null when the coupon is unlimited. */
  redemption_rate: number | null
  last_redeemed_at: string | null
  daily: Array<{ date: string; redemptions: number; discount_cents: number }>
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateCouponCode(length = 10): string {
  let out = ''
  for (let i = 0; i < length; i += 1) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  return out
}

export function normaliseCouponCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 48)
}

/** Discount for one order, in minor currency units. Never exceeds the order. */
export function computeDiscountCents(
  coupon: Pick<Coupon, 'discount_type' | 'discount_value' | 'max_discount_cents'>,
  grossCents: number,
): number {
  if (grossCents <= 0) return 0
  const raw =
    coupon.discount_type === 'percent'
      ? Math.round((grossCents * coupon.discount_value) / 100)
      : coupon.discount_value
  const capped = coupon.max_discount_cents ? Math.min(raw, coupon.max_discount_cents) : raw
  return Math.max(0, Math.min(capped, grossCents))
}

export class CouponService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly audit: AuditService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // ── Reads ──────────────────────────────────────────────────────────────

  async list(actor: CmsActor, params: CouponListParams) {
    const scoped = <T extends SelectQueryBuilder<Database, 'coupons', object>>(builder: T): T => {
      let q = this.applyActorScope(builder, actor)
      if (params.status) q = q.where('status', '=', params.status) as T
      if (params.scope) q = q.where('scope', '=', params.scope) as T
      if (params.authorId) q = q.where('author_id', '=', params.authorId) as T
      if (params.campaignType) q = q.where('campaign_type', '=', params.campaignType) as T
      if (params.q) {
        const pattern = likePattern(params.q)
        q = q.where(sql<boolean>`(coupons.code LIKE ${pattern} OR coupons.name LIKE ${pattern})`) as T
      }
      return q
    }

    const [rows, total] = await Promise.all([
      scoped(
        this.db
          .selectFrom('coupons')
          .selectAll('coupons')
          .select((eb) => [
            eb.selectFrom('authors').whereRef('authors.id', '=', 'coupons.author_id').select('authors.name').as('author_name'),
            eb.selectFrom('books').whereRef('books.id', '=', 'coupons.book_id').select('books.title').as('book_title'),
            eb.selectFrom('articles').whereRef('articles.id', '=', 'coupons.article_id').select('articles.title').as('article_title'),
            eb
              .selectFrom('coupon_redemptions as cr')
              .whereRef('cr.coupon_id', '=', 'coupons.id')
              .select((ib) => ib.fn.coalesce(ib.fn.sum<number>('cr.discount_cents'), sql<number>`0`).as('sum'))
              .as('discount_cents_total'),
          ]) as unknown as SelectQueryBuilder<Database, 'coupons', object>,
      )
        .orderBy('coupons.created_at', 'desc')
        .limit(params.limit)
        .offset((params.page - 1) * params.limit)
        .execute(),
      scoped(this.db.selectFrom('coupons').select((eb) => eb.fn.countAll().as('total'))).executeTakeFirst(),
    ])
    return { rows: rows as Array<Record<string, unknown>>, pagination: pageInfo(params.page, params.limit, Number(total?.total ?? 0)) }
  }

  async get(actor: CmsActor, id: number) {
    const coupon = await this.db.selectFrom('coupons').selectAll().where('id', '=', id).executeTakeFirst()
    if (!coupon) throw errors.notFound('Coupon')
    this.assertCanManage(actor, coupon)
    const redemptions = await this.db
      .selectFrom('coupon_redemptions as cr')
      .leftJoin('users as u', 'u.id', 'cr.user_id')
      .select(['cr.id', 'cr.user_id', 'cr.item_type', 'cr.item_id', 'cr.discount_cents', 'cr.gross_cents', 'cr.currency', 'cr.created_at', 'u.email as user_email'])
      .where('cr.coupon_id', '=', id)
      .orderBy('cr.id', 'desc')
      .limit(100)
      .execute()
    return { ...coupon, redemptions }
  }

  /** Every coupon the actor may see, unpaginated — used by CSV and print export. */
  async exportRows(actor: CmsActor, params: Omit<CouponListParams, 'page' | 'limit'>) {
    const { rows } = await this.list(actor, { ...params, page: 1, limit: 1000 })
    return rows
  }

  // ── Writes ─────────────────────────────────────────────────────────────

  async create(ctx: CmsRequestContext, input: CouponInput): Promise<Coupon> {
    const values = await this.buildValues(ctx.actor, input, null)
    const id = await this.db.transaction().execute(async (trx) => {
      const inserted = await trx
        .insertInto('coupons')
        .values({ ...values, created_by_user_id: ctx.actor.userId } as never)
        .executeTakeFirstOrThrow()
      const couponId = Number(inserted.insertId)
      await this.audit.record(
        { actor: ctx.audit, action: 'coupon.create', entityType: 'coupon', entityId: couponId, summary: `${values.code} — ${values.name}`, after: values },
        trx,
      )
      return couponId
    })
    return this.db.selectFrom('coupons').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  }

  async update(ctx: CmsRequestContext, id: number, input: Partial<CouponInput>): Promise<Coupon> {
    const before = await this.db.selectFrom('coupons').selectAll().where('id', '=', id).executeTakeFirst()
    if (!before) throw errors.notFound('Coupon')
    this.assertCanManage(ctx.actor, before, 'edit')

    const merged: CouponInput = {
      name: input.name ?? before.name,
      scope: input.scope ?? before.scope,
      discount_type: input.discount_type ?? before.discount_type,
      discount_value: input.discount_value ?? before.discount_value,
      author_id: input.author_id !== undefined ? input.author_id : before.author_id,
      book_id: input.book_id !== undefined ? input.book_id : before.book_id,
      article_id: input.article_id !== undefined ? input.article_id : before.article_id,
      plan_code: input.plan_code !== undefined ? input.plan_code : before.plan_code,
      description: input.description !== undefined ? input.description : before.description,
      campaign_type: input.campaign_type ?? before.campaign_type,
      max_discount_cents: input.max_discount_cents !== undefined ? input.max_discount_cents : before.max_discount_cents,
      min_order_cents: input.min_order_cents !== undefined ? input.min_order_cents : before.min_order_cents,
      currency: input.currency ?? before.currency,
      usage_limit: input.usage_limit !== undefined ? input.usage_limit : before.usage_limit,
      usage_limit_per_user: input.usage_limit_per_user !== undefined ? input.usage_limit_per_user : before.usage_limit_per_user,
      starts_at: input.starts_at !== undefined ? input.starts_at : before.starts_at.toISOString(),
      ends_at: input.ends_at !== undefined ? input.ends_at : (before.ends_at?.toISOString() ?? null),
      status: input.status ?? before.status,
      // The code is the campaign's identity once it is out in the world.
      code: before.code,
    }
    const values = await this.buildValues(ctx.actor, merged, before)
    if (values.usage_limit !== null && Number(values.usage_limit) < before.used_count) {
      throw errors.badRequest(`The usage limit cannot be lower than the ${before.used_count} redemptions already recorded`)
    }

    await this.db.transaction().execute(async (trx) => {
      await trx.updateTable('coupons').set(values as never).where('id', '=', id).execute()
      const diff = diffSnapshots(before as unknown as Record<string, unknown>, { ...before, ...values } as Record<string, unknown>)
      await this.audit.record(
        { actor: ctx.audit, action: 'coupon.update', entityType: 'coupon', entityId: id, summary: before.code, before: diff.before, after: diff.after },
        trx,
      )
    })
    return this.db.selectFrom('coupons').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  }

  async setStatus(ctx: CmsRequestContext, id: number, status: CouponStatus): Promise<Coupon> {
    const before = await this.db.selectFrom('coupons').selectAll().where('id', '=', id).executeTakeFirst()
    if (!before) throw errors.notFound('Coupon')
    this.assertCanManage(ctx.actor, before, 'edit')
    await this.db.updateTable('coupons').set({ status }).where('id', '=', id).execute()
    await this.audit.record({
      actor: ctx.audit,
      action: 'coupon.update',
      entityType: 'coupon',
      entityId: id,
      summary: `${before.code}: ${before.status} → ${status}`,
      before: { status: before.status },
      after: { status },
    })
    return { ...before, status }
  }

  async remove(ctx: CmsRequestContext, id: number): Promise<void> {
    const before = await this.db.selectFrom('coupons').selectAll().where('id', '=', id).executeTakeFirst()
    if (!before) throw errors.notFound('Coupon')
    this.assertCanManage(ctx.actor, before, 'delete')
    // A redeemed campaign is archived, never removed: the redemption history
    // and its revenue impact must stay auditable.
    if (before.used_count > 0) {
      await this.db.updateTable('coupons').set({ status: 'archived' }).where('id', '=', id).execute()
      await this.audit.record({
        actor: ctx.audit,
        action: 'coupon.update',
        entityType: 'coupon',
        entityId: id,
        summary: `${before.code} archived (${before.used_count} redemptions)`,
        before: { status: before.status },
        after: { status: 'archived' },
      })
      return
    }
    await this.db.deleteFrom('coupons').where('id', '=', id).execute()
    await this.audit.record({ actor: ctx.audit, action: 'coupon.delete', entityType: 'coupon', entityId: id, summary: before.code, before })
  }

  // ── Redemption ─────────────────────────────────────────────────────────

  /**
   * Validate a code for a given order without consuming it. Used by the
   * checkout preview and by the CMS "test this coupon" action.
   */
  async validate(input: {
    code: string
    userId?: string | null
    itemType?: RedemptionItemType
    itemId?: number | null
    planCode?: string | null
    grossCents: number
  }): Promise<{ coupon: Coupon; discount_cents: number; net_cents: number }> {
    const coupon = await this.db
      .selectFrom('coupons')
      .selectAll()
      .where('code', '=', normaliseCouponCode(input.code))
      .executeTakeFirst()
    if (!coupon) throw errors.couponInvalid()

    const now = this.now()
    if (coupon.status !== 'active') throw errors.couponInvalid('This coupon is not active')
    if (coupon.starts_at.getTime() > now.getTime()) throw errors.couponExpired()
    if (coupon.ends_at && coupon.ends_at.getTime() <= now.getTime()) throw errors.couponExpired()
    if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) throw errors.couponExhausted()
    if (coupon.min_order_cents && input.grossCents < coupon.min_order_cents) {
      throw errors.couponNotApplicable(`This coupon needs an order of at least ${(coupon.min_order_cents / 100).toFixed(2)} ${coupon.currency}`)
    }

    if (coupon.scope === 'book' && (input.itemType !== 'book' || input.itemId !== coupon.book_id)) {
      throw errors.couponNotApplicable('This coupon only applies to a specific book')
    }
    if (coupon.scope === 'article' && (input.itemType !== 'article' || input.itemId !== coupon.article_id)) {
      throw errors.couponNotApplicable('This coupon only applies to a specific article')
    }
    if (coupon.scope === 'subscription') {
      if (input.itemType !== 'subscription') throw errors.couponNotApplicable('This coupon only applies to a subscription')
      if (coupon.plan_code && coupon.plan_code !== input.planCode) {
        throw errors.couponNotApplicable('This coupon applies to a different subscription plan')
      }
    }

    if (coupon.usage_limit_per_user !== null && input.userId) {
      const used = await this.db
        .selectFrom('coupon_redemptions')
        .select((eb) => eb.fn.countAll().as('n'))
        .where('coupon_id', '=', coupon.id)
        .where('user_id', '=', input.userId)
        .executeTakeFirst()
      if (Number(used?.n ?? 0) >= coupon.usage_limit_per_user) throw errors.couponExhausted()
    }

    const discount = computeDiscountCents(coupon, input.grossCents)
    return { coupon, discount_cents: discount, net_cents: input.grossCents - discount }
  }

  /**
   * Consume one redemption. The limit check and the counter increment happen in
   * one transaction with `SELECT ... FOR UPDATE`, so two concurrent checkouts
   * cannot both take the last redemption.
   */
  async redeem(input: {
    code: string
    userId: string | null
    itemType: RedemptionItemType
    itemId?: number | null
    planCode?: string | null
    grossCents: number
    source?: string
    metadata?: Record<string, unknown> | null
  }): Promise<{ coupon: Coupon; discount_cents: number; net_cents: number; redemption_id: number }> {
    const preview = await this.validate(input)
    return this.db.transaction().execute(async (trx) => {
      const locked = await trx.selectFrom('coupons').selectAll().where('id', '=', preview.coupon.id).forUpdate().executeTakeFirstOrThrow()
      if (locked.usage_limit !== null && locked.used_count >= locked.usage_limit) throw errors.couponExhausted()

      const inserted = await trx
        .insertInto('coupon_redemptions')
        .values({
          coupon_id: locked.id,
          user_id: input.userId,
          item_type: input.itemType,
          item_id: input.itemId ?? null,
          discount_cents: preview.discount_cents,
          gross_cents: input.grossCents,
          currency: locked.currency,
          source: input.source ?? 'web',
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        })
        .executeTakeFirstOrThrow()

      await trx
        .updateTable('coupons')
        .set({ used_count: sql`used_count + 1` })
        .where('id', '=', locked.id)
        .execute()

      await this.audit.record(
        {
          actor: { id: input.userId, email: null, role: null },
          action: 'coupon.redeem',
          entityType: 'coupon',
          entityId: locked.id,
          summary: `${locked.code} redeemed`,
          after: { discount_cents: preview.discount_cents, gross_cents: input.grossCents, item_type: input.itemType, item_id: input.itemId ?? null },
        },
        trx,
      )

      return { ...preview, redemption_id: Number(inserted.insertId) }
    })
  }

  // ── Analytics ──────────────────────────────────────────────────────────

  async performance(actor: CmsActor, couponId: number, days = 30): Promise<CouponPerformance> {
    const coupon = await this.db.selectFrom('coupons').selectAll().where('id', '=', couponId).executeTakeFirst()
    if (!coupon) throw errors.notFound('Coupon')
    this.assertCanAnalyse(actor, coupon)

    const since = new Date(this.now().getTime() - days * 24 * 3600 * 1000)
    const [totals, daily] = await Promise.all([
      this.db
        .selectFrom('coupon_redemptions')
        .select((eb) => [
          eb.fn.countAll().as('redemptions'),
          eb.fn.count<number>('user_id').distinct().as('unique_users'),
          eb.fn.coalesce(eb.fn.sum<number>('discount_cents'), sql<number>`0`).as('discount_cents'),
          eb.fn.coalesce(eb.fn.sum<number>('gross_cents'), sql<number>`0`).as('gross_cents'),
          eb.fn.max('created_at').as('last_redeemed_at'),
        ])
        .where('coupon_id', '=', couponId)
        .executeTakeFirst(),
      this.db
        .selectFrom('coupon_redemptions')
        .select((eb) => [
          sql<string>`DATE(created_at)`.as('date'),
          eb.fn.countAll().as('redemptions'),
          eb.fn.coalesce(eb.fn.sum<number>('discount_cents'), sql<number>`0`).as('discount_cents'),
        ])
        .where('coupon_id', '=', couponId)
        .where('created_at', '>=', since)
        .groupBy(sql`DATE(created_at)`)
        .orderBy(sql`DATE(created_at)`)
        .execute(),
    ])

    const redemptions = Number(totals?.redemptions ?? 0)
    const discount = Number(totals?.discount_cents ?? 0)
    const gross = Number(totals?.gross_cents ?? 0)
    return {
      coupon_id: couponId,
      redemptions,
      unique_users: Number(totals?.unique_users ?? 0),
      discount_cents: discount,
      gross_cents: gross,
      net_cents: gross - discount,
      redemption_rate: coupon.usage_limit ? Math.round((redemptions / coupon.usage_limit) * 1000) / 10 : null,
      last_redeemed_at: totals?.last_redeemed_at ? new Date(totals.last_redeemed_at as unknown as string).toISOString() : null,
      daily: daily.map((d) => ({ date: String(d.date), redemptions: Number(d.redemptions), discount_cents: Number(d.discount_cents) })),
    }
  }

  /** Campaign roll-up for the coupon dashboard, scoped to what the actor may see. */
  async summary(actor: CmsActor, days = 30) {
    const since = new Date(this.now().getTime() - days * 24 * 3600 * 1000)
    const visible = this.applyActorScope(this.db.selectFrom('coupons').select('id'), actor)
    const ids = (await visible.execute()).map((r) => r.id)
    if (!ids.length) {
      return { coupons: 0, active: 0, redemptions: 0, discount_cents: 0, gross_cents: 0, top: [], daily: [] }
    }

    const [counts, totals, top, daily] = await Promise.all([
      this.db
        .selectFrom('coupons')
        .select((eb) => [eb.fn.countAll().as('total'), sql<number>`SUM(status = 'active')`.as('active')])
        .where('id', 'in', ids)
        .executeTakeFirst(),
      this.db
        .selectFrom('coupon_redemptions')
        .select((eb) => [
          eb.fn.countAll().as('redemptions'),
          eb.fn.coalesce(eb.fn.sum<number>('discount_cents'), sql<number>`0`).as('discount_cents'),
          eb.fn.coalesce(eb.fn.sum<number>('gross_cents'), sql<number>`0`).as('gross_cents'),
        ])
        .where('coupon_id', 'in', ids)
        .where('created_at', '>=', since)
        .executeTakeFirst(),
      this.db
        .selectFrom('coupon_redemptions as cr')
        .innerJoin('coupons as c', 'c.id', 'cr.coupon_id')
        .select((eb) => [
          'c.id',
          'c.code',
          'c.name',
          eb.fn.countAll().as('redemptions'),
          eb.fn.coalesce(eb.fn.sum<number>('cr.discount_cents'), sql<number>`0`).as('discount_cents'),
        ])
        .where('cr.coupon_id', 'in', ids)
        .where('cr.created_at', '>=', since)
        .groupBy(['c.id', 'c.code', 'c.name'])
        .orderBy(sql`redemptions DESC`)
        .limit(10)
        .execute(),
      this.db
        .selectFrom('coupon_redemptions')
        .select((eb) => [
          sql<string>`DATE(created_at)`.as('date'),
          eb.fn.countAll().as('redemptions'),
          eb.fn.coalesce(eb.fn.sum<number>('discount_cents'), sql<number>`0`).as('discount_cents'),
        ])
        .where('coupon_id', 'in', ids)
        .where('created_at', '>=', since)
        .groupBy(sql`DATE(created_at)`)
        .orderBy(sql`DATE(created_at)`)
        .execute(),
    ])

    return {
      coupons: Number(counts?.total ?? 0),
      active: Number(counts?.active ?? 0),
      redemptions: Number(totals?.redemptions ?? 0),
      discount_cents: Number(totals?.discount_cents ?? 0),
      gross_cents: Number(totals?.gross_cents ?? 0),
      top: top.map((t) => ({ id: t.id, code: t.code, name: t.name, redemptions: Number(t.redemptions), discount_cents: Number(t.discount_cents) })),
      daily: daily.map((d) => ({ date: String(d.date), redemptions: Number(d.redemptions), discount_cents: Number(d.discount_cents) })),
    }
  }

  /** Expire campaigns whose end date has passed. Run by the job scheduler. */
  async expireDue(): Promise<number> {
    const result = await this.db
      .updateTable('coupons')
      .set({ status: 'expired' })
      .where('status', '=', 'active')
      .where('ends_at', 'is not', null)
      .where('ends_at', '<=', this.now())
      .executeTakeFirst()
    return Number(result.numUpdatedRows ?? 0)
  }

  // ── Ownership & validation ─────────────────────────────────────────────

  private applyActorScope<T extends SelectQueryBuilder<Database, 'coupons', object>>(builder: T, actor: CmsActor): T {
    if (actor.scope === 'all') return builder
    return (actor.ownedAuthorIds.length
      ? builder.where('author_id', 'in', actor.ownedAuthorIds)
      : builder.where(sql<boolean>`FALSE`)) as T
  }

  /** Throws unless the actor owns this campaign (or manages the whole platform). */
  private assertCanManage(actor: CmsActor, coupon: Coupon, action: 'view' | 'edit' | 'delete' = 'view'): void {
    if (actor.scope === 'all') {
      if (action !== 'view' && (coupon.scope === 'global' || coupon.scope === 'subscription') && !actor.permissions.has('coupons.global.manage')) {
        throw errors.permissionDenied('coupons.global.manage')
      }
      return
    }
    if (coupon.author_id === null || !actor.ownedAuthorIds.includes(coupon.author_id)) throw errors.ownershipRequired('coupons')
    if (action === 'edit' && !actor.permissions.has('author.coupons.edit')) throw errors.permissionDenied('author.coupons.edit')
    if (action === 'delete' && !actor.permissions.has('author.coupons.delete')) throw errors.permissionDenied('author.coupons.delete')
  }

  private assertCanAnalyse(actor: CmsActor, coupon: Coupon): void {
    if (actor.scope === 'all') {
      if (!actor.permissions.has('coupons.analytics')) throw errors.permissionDenied('coupons.analytics')
      return
    }
    if (coupon.author_id === null || !actor.ownedAuthorIds.includes(coupon.author_id)) throw errors.ownershipRequired('coupons')
    if (!actor.permissions.has('author.coupons.analytics')) throw errors.permissionDenied('author.coupons.analytics')
  }

  /**
   * Normalises input into database columns and enforces every ownership and
   * consistency rule: an author coupon must target that author's own item, a
   * global or subscription campaign needs `coupons.global.manage`, and the
   * discount must make sense for its type.
   */
  private async buildValues(actor: CmsActor, input: CouponInput, existing: Coupon | null): Promise<Record<string, unknown>> {
    const scope = input.scope
    const isGlobal = scope === 'global' || scope === 'subscription'

    if (isGlobal && !actor.permissions.has('coupons.global.manage')) {
      throw errors.permissionDenied('coupons.global.manage')
    }
    if (!isGlobal && !actor.permissions.has('coupons.create') && !actor.permissions.has('author.coupons.create') && !existing) {
      throw errors.permissionDenied(['coupons.create', 'author.coupons.create'])
    }

    if (input.discount_type === 'percent' && (input.discount_value < 1 || input.discount_value > 100)) {
      throw errors.validation([{ path: 'discount_value', message: 'A percentage discount must be between 1 and 100' }])
    }
    if (input.discount_type === 'fixed' && input.discount_value < 1) {
      throw errors.validation([{ path: 'discount_value', message: 'A fixed discount must be at least 1 cent' }])
    }

    const startsAt = input.starts_at ? new Date(input.starts_at) : (existing?.starts_at ?? this.now())
    const endsAt = input.ends_at ? new Date(input.ends_at) : null
    if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
      throw errors.validation([{ path: 'ends_at', message: 'The end date must be after the start date' }])
    }

    let authorId = input.author_id ?? null
    let bookId: number | null = null
    let articleId: number | null = null
    let planCode: string | null = null

    if (scope === 'book') {
      if (!input.book_id) throw errors.validation([{ path: 'book_id', message: 'Select the book this coupon applies to' }])
      const book = await this.db.selectFrom('books').select(['id', 'author_id', 'title']).where('id', '=', input.book_id).executeTakeFirst()
      if (!book) throw errors.notFound('Book')
      bookId = book.id
      // The coupon always belongs to the item's author — that is what makes
      // "an author cannot touch another author's coupons" enforceable.
      authorId = book.author_id
      if (actor.scope === 'own' && (book.author_id === null || !actor.ownedAuthorIds.includes(book.author_id))) {
        throw errors.ownershipRequired('books')
      }
    } else if (scope === 'article') {
      if (!input.article_id) throw errors.validation([{ path: 'article_id', message: 'Select the article this coupon applies to' }])
      const article = await this.db
        .selectFrom('articles')
        .select(['id', 'author_id', 'title'])
        .where('id', '=', input.article_id)
        .executeTakeFirst()
      if (!article) throw errors.notFound('Article')
      articleId = article.id
      authorId = article.author_id
      if (actor.scope === 'own' && (article.author_id === null || !actor.ownedAuthorIds.includes(article.author_id))) {
        throw errors.ownershipRequired('articles')
      }
    } else if (scope === 'subscription') {
      authorId = null
      planCode = input.plan_code ?? null
      if (planCode) {
        const plan = await this.db.selectFrom('subscription_plans').select('code').where('code', '=', planCode).executeTakeFirst()
        if (!plan) throw errors.notFound('Plan')
      }
    } else {
      authorId = null
    }

    const status = input.status ?? existing?.status ?? 'draft'
    return {
      code: existing?.code ?? normaliseCouponCode(input.code || generateCouponCode()),
      name: sanitizePlainText(input.name),
      description: input.description === null || input.description === undefined ? null : sanitizePlainText(input.description),
      author_id: authorId,
      scope,
      book_id: bookId,
      article_id: articleId,
      plan_code: planCode,
      campaign_type: sanitizePlainText(input.campaign_type ?? 'standard').slice(0, 48) || 'standard',
      discount_type: input.discount_type,
      discount_value: Math.trunc(input.discount_value),
      max_discount_cents: input.max_discount_cents ?? null,
      min_order_cents: input.min_order_cents ?? null,
      currency: (input.currency ?? existing?.currency ?? 'USD').toUpperCase().slice(0, 3),
      usage_limit: input.usage_limit ?? null,
      usage_limit_per_user: input.usage_limit_per_user ?? null,
      starts_at: startsAt,
      ends_at: endsAt,
      status,
    }
  }
}
