import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { serializePlans } from '../../../domain/plans.js'
import { errors } from '../../../lib/errors.js'
import { resolveRange } from '../../../services/cms/analytics.js'
import { ASSET_CONTENT_TYPES, ASSET_VISIBILITY, type AssetKind } from '../../../storage/storage.js'
import type { AppContext } from '../../context.js'
import { actorCanAny } from '../../../services/rbac.js'
import { auditActor, requireActor, requireAnyPermission, requirePermission } from '../../middleware/permissions.js'
import { pagination, parse } from '../../validate.js'
import { cmsContext, rangeQuery } from './shared.js'

/**
 * Platform surface of the CMS: policies, settings, media uploads, membership
 * plans, subscriptions, dashboards and the audit log.
 */

const policyKind = z.enum(['terms', 'privacy', 'refund', 'content', 'custom'])

const PlanUpdate = z
  .object({
    name: z.string().trim().min(1).max(64),
    description: z.string().trim().max(255).nullable(),
    price_cents: z.number().int().min(0),
    apple_product_id: z.string().trim().max(128).nullable(),
    google_product_id: z.string().trim().max(128).nullable(),
    google_base_plan_id: z.string().trim().max(64).nullable(),
    display_order: z.number().int(),
    is_active: z.boolean(),
  })
  .partial()

export function platformRouter(ctx: AppContext) {
  const router = Router()
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: Math.min(ctx.config.storage.uploadMaxBytes, 100 * 1024 * 1024), files: 1 },
  })
  const assetKind = z.enum(Object.keys(ASSET_VISIBILITY) as [AssetKind, ...AssetKind[]])

  function assertContentType(kind: AssetKind, contentType: string) {
    if (!ASSET_CONTENT_TYPES[kind].includes(contentType)) {
      throw errors.validation([
        { path: 'content_type', message: `Allowed types for ${kind}: ${ASSET_CONTENT_TYPES[kind].join(', ')}` },
      ])
    }
  }

  // ── Media ──────────────────────────────────────────────────────────────

  /** Large files (books, audio) are PUT straight to MinIO with this URL. */
  router.post('/media/presign', requirePermission('media.upload'), async (req, res) => {
    const body = parse(
      z.object({ kind: assetKind, content_type: z.string().min(1).max(128), filename: z.string().max(255).optional() }),
      req.body,
    )
    assertContentType(body.kind, body.content_type)
    const presigned = await ctx.storage.presignUpload(body.kind, body.content_type, body.filename)
    await ctx.services.audit.record({
      actor: auditActor(req),
      action: 'upload',
      entityType: 'media',
      entityId: presigned.key,
      summary: `Presigned ${body.kind} upload`,
    })
    res.json({
      status: 'ok',
      upload: presigned,
      public_url: ASSET_VISIBILITY[body.kind] === 'public' ? ctx.storage.publicUrl(presigned.key) : null,
    })
  })

  /** Small files (images) through the API. */
  router.post('/media', requirePermission('media.upload'), upload.single('file'), async (req, res) => {
    const { kind } = parse(z.object({ kind: assetKind }), req.body)
    const file = req.file
    if (!file) throw errors.validation([{ path: 'file', message: 'File is required' }])
    assertContentType(kind, file.mimetype)
    const key = await ctx.storage.putObject(kind, file.buffer, file.size, file.mimetype, file.originalname)
    await ctx.services.audit.record({
      actor: auditActor(req),
      action: 'upload',
      entityType: 'media',
      entityId: key,
      summary: `${file.originalname} (${Math.round(file.size / 1024)} KB)`,
    })
    res.status(201).json({
      status: 'ok',
      key,
      public_url: ASSET_VISIBILITY[kind] === 'public' ? ctx.storage.publicUrl(key) : null,
    })
  })

  /** Signed URL so the CMS can preview a private asset (PDF, EPUB, audio). */
  router.post('/media/signed-url', requirePermission('media.upload'), async (req, res) => {
    const { key } = parse(z.object({ key: z.string().trim().min(1).max(1024) }), req.body)
    const signed = await ctx.storage.signedUrl(key, { ttlSeconds: 600 })
    res.json({ status: 'ok', url: signed.url, expires_at: signed.expiresAt.toISOString() })
  })

  router.delete('/media', requirePermission('media.delete'), async (req, res) => {
    const { key } = parse(z.object({ key: z.string().trim().min(1).max(1024) }), req.body)
    await ctx.storage.removeObject(key)
    await ctx.services.audit.record({ actor: auditActor(req), action: 'delete', entityType: 'media', entityId: key, summary: key })
    res.json({ status: 'ok' })
  })

  // ── Policies & terms ───────────────────────────────────────────────────

  router.get('/policies', requirePermission('policies.view'), async (_req, res) => {
    res.json({ status: 'ok', policies: await ctx.services.policies.list() })
  })

  router.get('/policies/:slug', requirePermission('policies.view'), async (req, res) => {
    const { slug } = parse(z.object({ slug: z.string().trim().max(96) }), req.params)
    res.json({ status: 'ok', policy: await ctx.services.policies.get(slug) })
  })

  router.post('/policies', requirePermission('policies.edit'), async (req, res) => {
    const body = parse(
      z.object({ slug: z.string().trim().min(2).max(96), title: z.string().trim().min(1).max(255), kind: policyKind.optional() }),
      req.body,
    )
    res.status(201).json({ status: 'ok', policy: await ctx.services.policies.createPolicy(cmsContext(req), body) })
  })

  router.put('/policies/:slug/draft', requirePermission('policies.edit'), async (req, res) => {
    const { slug } = parse(z.object({ slug: z.string().trim().max(96) }), req.params)
    const body = parse(
      z.object({
        title: z.string().trim().min(1).max(255).optional(),
        body: z.string().max(4_000_000),
        summary: z.string().trim().max(500).nullable().optional(),
        effective_at: z.string().datetime({ offset: true }).nullable().optional(),
      }),
      req.body,
    )
    res.json({ status: 'ok', policy: await ctx.services.policies.saveDraft(cmsContext(req), slug, body) })
  })

  router.post('/policies/:slug/publish', requirePermission('policies.publish'), async (req, res) => {
    const { slug } = parse(z.object({ slug: z.string().trim().max(96) }), req.params)
    const { version } = parse(z.object({ version: z.number().int().positive() }), req.body)
    res.json({ status: 'ok', policy: await ctx.services.policies.publish(cmsContext(req), slug, version) })
  })

  router.delete('/policies/:slug', requirePermission('policies.edit'), async (req, res) => {
    const { slug } = parse(z.object({ slug: z.string().trim().max(96) }), req.params)
    await ctx.services.policies.deletePolicy(cmsContext(req), slug)
    res.json({ status: 'ok' })
  })

  // ── Website settings ───────────────────────────────────────────────────

  router.get('/settings', requirePermission('settings.manage'), async (_req, res) => {
    res.json({ status: 'ok', settings: await ctx.services.settings.all() })
  })

  router.patch('/settings', requirePermission('settings.manage'), async (req, res) => {
    const body = parse(z.object({ values: z.record(z.string().max(96), z.unknown()) }), req.body)
    res.json({ status: 'ok', settings: await ctx.services.settings.update(cmsContext(req), body.values) })
  })

  // ── Membership plans & subscriptions ───────────────────────────────────

  router.get('/plans', requirePermission('plans.view'), async (_req, res) => {
    res.json({ status: 'ok', plans: serializePlans(await ctx.services.subscriptions.listPlans({ includeInactive: true })) })
  })

  router.patch('/plans/:code', requirePermission('plans.manage'), async (req, res) => {
    const { code } = parse(z.object({ code: z.string().max(32) }), req.params)
    const data = parse(PlanUpdate, req.body)
    if (!Object.keys(data).length) throw errors.badRequest('Nothing to update')
    const before = await ctx.db.selectFrom('subscription_plans').selectAll().where('code', '=', code).executeTakeFirst()
    if (!before) throw errors.notFound('Plan')
    await ctx.db.updateTable('subscription_plans').set(data).where('code', '=', code).execute()
    await ctx.services.audit.record({
      actor: auditActor(req),
      action: 'update',
      entityType: 'plan',
      entityId: code,
      summary: before.name,
      before,
      after: data,
    })
    res.json({ status: 'ok' })
  })

  router.get('/subscriptions', requirePermission('subscriptions.view'), async (req, res) => {
    const q = parse(
      pagination.extend({
        status: z
          .enum(['active', 'canceled', 'grace_period', 'billing_retry', 'paused', 'pending', 'expired', 'revoked'])
          .optional(),
        platform: z.enum(['app_store', 'google_play', 'manual']).optional(),
        plan_code: z.string().trim().max(32).optional(),
      }),
      req.query,
    )
    let rows = ctx.db
      .selectFrom('subscriptions as s')
      .leftJoin('users as u', 'u.id', 's.user_id')
      .select([
        's.id',
        's.user_id',
        's.plan_code',
        's.platform',
        's.product_id',
        's.status',
        's.auto_renew',
        's.environment',
        's.started_at',
        's.expires_at',
        's.updated_at',
        'u.email as user_email',
      ])
    let count = ctx.db.selectFrom('subscriptions as s').select((eb) => eb.fn.countAll().as('total'))
    if (q.status) {
      rows = rows.where('s.status', '=', q.status)
      count = count.where('s.status', '=', q.status)
    }
    if (q.platform) {
      rows = rows.where('s.platform', '=', q.platform)
      count = count.where('s.platform', '=', q.platform)
    }
    if (q.plan_code) {
      rows = rows.where('s.plan_code', '=', q.plan_code)
      count = count.where('s.plan_code', '=', q.plan_code)
    }
    const [items, total] = await Promise.all([
      rows
        .orderBy('s.updated_at', 'desc')
        .limit(q.limit)
        .offset((q.page - 1) * q.limit)
        .execute(),
      count.executeTakeFirst(),
    ])
    res.json({
      status: 'ok',
      subscriptions: items,
      pagination: { page: q.page, limit: q.limit, total: Number(total?.total ?? 0) },
    })
  })

  router.post('/subscriptions/reconcile', requirePermission('subscriptions.manage'), async (req, res) => {
    const result = await ctx.services.subscriptions.reconcile({ limit: 500 })
    await ctx.services.audit.record({
      actor: auditActor(req),
      action: 'update',
      entityType: 'subscription',
      entityId: null,
      summary: 'Manual reconciliation run',
      after: result,
    })
    res.json({ status: 'ok', ...result })
  })

  router.get('/subscription-events', requirePermission('subscriptions.view'), async (req, res) => {
    const q = parse(pagination.extend({ subscription_id: z.string().uuid().optional() }), req.query)
    let query = ctx.db
      .selectFrom('subscription_events')
      .selectAll()
      .orderBy('id', 'desc')
      .limit(q.limit)
      .offset((q.page - 1) * q.limit)
    if (q.subscription_id) query = query.where('subscription_id', '=', q.subscription_id)
    res.json({ status: 'ok', events: await query.execute() })
  })

  // ── Dashboards ─────────────────────────────────────────────────────────

  router.get('/analytics/overview', requireAnyPermission('analytics.view', 'analytics.own.view'), async (req, res) => {
    const q = parse(rangeQuery, req.query)
    const range = resolveRange(q)
    const actor = requireActor(req)

    // An author without platform analytics only ever sees their own numbers.
    if (!actor.permissions.has('analytics.view')) {
      res.json({ status: 'ok', scope: 'own', author: await ctx.services.analytics.authorOverview(actor, range) })
      return
    }

    const [overview, engagement, authors, coupons, reviews, feedback] = await Promise.all([
      ctx.services.analytics.adminOverview(range),
      ctx.services.analytics.engagement(range),
      ctx.services.analytics.authorPerformance(range),
      actorCanAny(actor, 'coupons.analytics') ? ctx.services.coupons.summary(actor, q.days) : Promise.resolve(null),
      actorCanAny(actor, 'reviews.view') ? ctx.services.moderation.metrics(q.days) : Promise.resolve(null),
      actorCanAny(actor, 'feedback.view') ? ctx.services.feedback.metrics(q.days) : Promise.resolve(null),
    ])
    res.json({ status: 'ok', scope: 'platform', overview, engagement, authors, coupons, reviews, feedback })
  })

  router.get('/analytics/authors', requirePermission('analytics.view'), async (req, res) => {
    const q = parse(rangeQuery, req.query)
    res.json({ status: 'ok', authors: await ctx.services.analytics.authorPerformance(resolveRange(q), 25) })
  })

  // ── Audit log ──────────────────────────────────────────────────────────

  router.get('/audit-logs', requirePermission('audit.view'), async (req, res) => {
    const q = parse(
      pagination.extend({
        actor_id: z.string().uuid().optional(),
        action: z.string().trim().max(64).optional(),
        entity_type: z.string().trim().max(64).optional(),
        entity_id: z.string().trim().max(64).optional(),
        from: z.string().datetime({ offset: true }).optional(),
        to: z.string().datetime({ offset: true }).optional(),
      }),
      req.query,
    )
    const { rows, pagination: page } = await ctx.services.audit.list({
      page: q.page,
      limit: q.limit,
      actorId: q.actor_id,
      action: q.action,
      entityType: q.entity_type,
      entityId: q.entity_id,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
    })
    res.json({ status: 'ok', logs: rows, pagination: page, actions: await ctx.services.audit.knownActions() })
  })

  router.get('/audit-logs/:entityType/:entityId', requirePermission('audit.view'), async (req, res) => {
    const params = parse(
      z.object({ entityType: z.string().trim().max(64), entityId: z.string().trim().max(64) }),
      req.params,
    )
    res.json({ status: 'ok', logs: await ctx.services.audit.forEntity(params.entityType, params.entityId) })
  })

  return router
}
