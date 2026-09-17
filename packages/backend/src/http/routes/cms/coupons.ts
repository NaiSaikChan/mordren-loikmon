import { Router } from 'express'
import { z } from 'zod'
import { COUPON_SCOPES } from '../../../domain/permissions.js'
import { generateCouponCode } from '../../../services/cms/coupons.js'
import type { AppContext } from '../../context.js'
import { requireAnyPermission } from '../../middleware/permissions.js'
import { idParam, pagination, parse } from '../../validate.js'
import { cmsContext, rangeQuery } from './shared.js'

/**
 * Coupons and discount campaigns.
 *
 * Every route accepts both the platform permission and its author-scoped twin;
 * the service decides what the actor may actually reach. Global and
 * subscription campaigns additionally require `coupons.global.manage`, checked
 * inside `CouponService` where the scope of the payload is known.
 */

const couponScope = z.enum(COUPON_SCOPES)
const couponStatus = z.enum(['draft', 'active', 'paused', 'expired', 'archived'])

const CouponInput = z.object({
  code: z.string().trim().min(3).max(48).optional(),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).nullable().optional(),
  banner_key: z.string().trim().max(1024).nullable().optional(),
  scope: couponScope,
  book_id: z.number().int().positive().nullable().optional(),
  article_id: z.number().int().positive().nullable().optional(),
  plan_code: z.string().trim().max(32).nullable().optional(),
  campaign_type: z.string().trim().max(48).optional(),
  discount_type: z.enum(['percent', 'fixed']),
  discount_value: z.number().int().min(1).max(1_000_000),
  max_discount_cents: z.number().int().min(0).nullable().optional(),
  min_order_cents: z.number().int().min(0).nullable().optional(),
  currency: z.string().trim().length(3).optional(),
  usage_limit: z.number().int().min(1).max(1_000_000).nullable().optional(),
  usage_limit_per_user: z.number().int().min(1).max(1000).nullable().optional(),
  starts_at: z.string().datetime({ offset: true }).nullable().optional(),
  ends_at: z.string().datetime({ offset: true }).nullable().optional(),
  status: couponStatus.optional(),
})

const listQuery = pagination.extend({
  q: z.string().trim().max(200).optional(),
  status: couponStatus.optional(),
  scope: couponScope.optional(),
  author_id: z.coerce.number().int().positive().optional(),
  campaign_type: z.string().trim().max(48).optional(),
})

/** RFC 4180 quoting so a comma or quote in a campaign name cannot break a row. */
function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const cell = (value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value)
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return [columns.join(','), ...rows.map((row) => columns.map((c) => cell(row[c])).join(','))].join('\r\n')
}

export function couponsRouter(ctx: AppContext) {
  const router = Router()
  const coupons = ctx.services.coupons

  const canView = requireAnyPermission('coupons.view', 'author.coupons.analytics')
  const canWrite = requireAnyPermission('coupons.create', 'author.coupons.create')
  const canEdit = requireAnyPermission('coupons.edit', 'author.coupons.edit')
  const canDelete = requireAnyPermission('coupons.delete', 'author.coupons.delete')
  const canAnalyse = requireAnyPermission('coupons.analytics', 'author.coupons.analytics')

  router.get('/', canView, async (req, res) => {
    const q = parse(listQuery, req.query)
    const { rows, pagination: page } = await coupons.list(cmsContext(req).actor, {
      page: q.page,
      limit: q.limit,
      q: q.q,
      status: q.status,
      scope: q.scope,
      authorId: q.author_id,
      campaignType: q.campaign_type,
    })
    res.json({ status: 'ok', coupons: rows, pagination: page })
  })

  /** A code suggestion for the create form; it is not reserved until saved. */
  router.get('/suggest-code', canWrite, (_req, res) => {
    res.json({ status: 'ok', code: generateCouponCode() })
  })

  router.get('/summary', canAnalyse, async (req, res) => {
    const q = parse(rangeQuery, req.query)
    res.json({ status: 'ok', summary: await coupons.summary(cmsContext(req).actor, q.days) })
  })

  /** CSV of everything the actor may see — the source for spreadsheets and print. */
  router.get('/export', canView, async (req, res) => {
    const q = parse(listQuery.partial({ page: true, limit: true }), req.query)
    const rows = await coupons.exportRows(cmsContext(req).actor, {
      q: q.q,
      status: q.status,
      scope: q.scope,
      authorId: q.author_id,
      campaignType: q.campaign_type,
    })
    const columns = [
      'code',
      'name',
      'scope',
      'campaign_type',
      'discount_type',
      'discount_value',
      'currency',
      'usage_limit',
      'used_count',
      'starts_at',
      'ends_at',
      'status',
      'author_name',
      'book_title',
      'article_title',
    ]
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="coupons.csv"')
    res.send(toCsv(rows, columns))
  })

  router.get('/:id', canView, async (req, res) => {
    const { id } = parse(idParam, req.params)
    res.json({ status: 'ok', coupon: await coupons.get(cmsContext(req).actor, id) })
  })

  router.get('/:id/performance', canAnalyse, async (req, res) => {
    const { id } = parse(idParam, req.params)
    const q = parse(rangeQuery, req.query)
    res.json({ status: 'ok', performance: await coupons.performance(cmsContext(req).actor, id, q.days) })
  })

  router.post('/', canWrite, async (req, res) => {
    const coupon = await coupons.create(cmsContext(req), parse(CouponInput, req.body))
    res.status(201).json({ status: 'ok', coupon })
  })

  router.patch('/:id', canEdit, async (req, res) => {
    const { id } = parse(idParam, req.params)
    const coupon = await coupons.update(cmsContext(req), id, parse(CouponInput.partial(), req.body))
    res.json({ status: 'ok', coupon })
  })

  router.post('/:id/status', canEdit, async (req, res) => {
    const { id } = parse(idParam, req.params)
    const { status } = parse(z.object({ status: couponStatus }), req.body)
    res.json({ status: 'ok', coupon: await coupons.setStatus(cmsContext(req), id, status) })
  })

  router.delete('/:id', canDelete, async (req, res) => {
    const { id } = parse(idParam, req.params)
    await coupons.remove(cmsContext(req), id)
    res.json({ status: 'ok' })
  })

  /** Dry run against a hypothetical order, so an editor can check a campaign. */
  router.post('/validate', canView, async (req, res) => {
    const body = parse(
      z.object({
        code: z.string().trim().min(1).max(48),
        item_type: z.enum(['book', 'article', 'subscription', 'order']).default('order'),
        item_id: z.number().int().positive().nullable().optional(),
        plan_code: z.string().trim().max(32).nullable().optional(),
        gross_cents: z.number().int().min(0).max(100_000_000),
      }),
      req.body,
    )
    const result = await coupons.validate({
      code: body.code,
      userId: null,
      itemType: body.item_type,
      itemId: body.item_id ?? null,
      planCode: body.plan_code ?? null,
      grossCents: body.gross_cents,
    })
    res.json({
      status: 'ok',
      coupon: { id: result.coupon.id, code: result.coupon.code, name: result.coupon.name, scope: result.coupon.scope },
      discount_cents: result.discount_cents,
      net_cents: result.net_cents,
    })
  })

  return router
}
