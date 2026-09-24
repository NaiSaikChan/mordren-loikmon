import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { errors } from '../../lib/errors.js'
import type { AppContext } from '../context.js'
import { requireAuth, requireUser } from '../middleware/auth.js'
import { idParam, parse } from '../validate.js'

/**
 * Public surface of the CMS: the settings, policies, sliders and feedback the
 * storefront reads or writes without a CMS permission.
 *
 * Everything here is either anonymous-readable (settings, published policies)
 * or belongs to the signed-in user (their own tickets).
 */
export function siteRouter(ctx: AppContext, limiters: { feedback: RequestHandler }) {
  const router = Router()

  /** Branding, SEO and feature toggles marked `is_public`. */
  router.get('/settings', async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=60')
    res.json({ status: 'ok', settings: await ctx.services.settings.publicSettings() })
  })

  router.get('/policies', async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300')
    res.json({ status: 'ok', policies: await ctx.services.policies.listPublished() })
  })

  router.get('/policies/:slug', async (req, res) => {
    const { slug } = parse(z.object({ slug: z.string().trim().max(96) }), req.params)
    const policy = await ctx.services.policies.published(slug)
    if (!policy) throw errors.notFound('Policy')
    res.set('Cache-Control', 'public, max-age=300')
    res.json({
      status: 'ok',
      policy: {
        slug: policy.slug,
        kind: policy.kind,
        title: policy.content.title,
        summary: policy.content.summary,
        body: policy.content.body,
        version: policy.content.version,
        effective_at: policy.content.effective_at ? new Date(policy.content.effective_at).toISOString() : null,
        published_at: policy.content.published_at ? new Date(policy.content.published_at).toISOString() : null,
      },
    })
  })

  // ── Feedback ───────────────────────────────────────────────────────────

  /** Contact form. Open to guests, so it gets its own stricter rate limit. */
  router.post('/feedback', limiters.feedback, async (req, res) => {
    if (!(await ctx.services.settings.flag('features.feedback_enabled', true))) {
      throw errors.serviceUnavailable('Feedback is currently closed')
    }
    const body = parse(
      z.object({
        subject: z.string().trim().min(3).max(255),
        body: z.string().trim().min(5).max(8000),
        category: z.enum(['bug', 'content', 'billing', 'account', 'suggestion', 'other']).optional(),
        email: z.string().email().max(255).optional(),
        name: z.string().trim().max(160).optional(),
      }),
      req.body,
    )
    const ticket = await ctx.services.feedback.open({
      ...body,
      userId: req.user?.id ?? null,
      email: body.email ?? req.user?.email ?? null,
      name: body.name ?? req.user?.name ?? null,
    })
    res.status(201).json({ status: 'ok', reference: ticket.reference, ticket_id: ticket.id })
  })

  router.get('/feedback/me', requireAuth, async (req, res) => {
    res.json({ status: 'ok', tickets: await ctx.services.feedback.listForUser(requireUser(req).id) })
  })

  /** Readers flag a review; it lands in the moderation queue. */
  router.post('/reviews/:id/report', requireAuth, async (req, res) => {
    const { id } = parse(idParam, req.params)
    const body = parse(
      z.object({
        reason: z.enum(['spam', 'abuse', 'spoiler', 'off_topic', 'other']),
        note: z.string().trim().max(500).nullable().optional(),
      }),
      req.body,
    )
    await ctx.services.moderation.report({ reviewId: id, reporterId: requireUser(req).id, reason: body.reason, note: body.note })
    res.status(201).json({ status: 'ok' })
  })

  return router
}
