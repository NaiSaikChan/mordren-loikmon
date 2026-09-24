import { Router } from 'express'
import { z } from 'zod'
import type { AppContext } from '../../context.js'
import { requirePermission } from '../../middleware/permissions.js'
import { idParam, pagination, parse, queryBool } from '../../validate.js'
import { cmsContext, idsBody, itemType, rangeQuery } from './shared.js'

/** Review moderation, review reports and the feedback ticket queue. */

const reviewStatus = z.enum(['published', 'pending', 'hidden'])
const ticketStatus = z.enum(['open', 'pending', 'resolved', 'closed'])
const ticketPriority = z.enum(['low', 'normal', 'high', 'urgent'])
const ticketCategory = z.enum(['bug', 'content', 'billing', 'account', 'suggestion', 'other'])

export function communityRouter(ctx: AppContext) {
  const router = Router()
  const moderation = ctx.services.moderation
  const feedback = ctx.services.feedback

  // ── Reviews ────────────────────────────────────────────────────────────

  router.get('/reviews', requirePermission('reviews.view'), async (req, res) => {
    const q = parse(
      pagination.extend({
        q: z.string().trim().max(200).optional(),
        status: reviewStatus.optional(),
        item_type: itemType.optional(),
        item_id: z.coerce.number().int().positive().optional(),
        rating: z.coerce.number().int().min(1).max(5).optional(),
        reported: queryBool,
      }),
      req.query,
    )
    const { rows, pagination: page } = await moderation.listReviews({
      page: q.page,
      limit: q.limit,
      q: q.q,
      status: q.status,
      itemType: q.item_type,
      itemId: q.item_id,
      rating: q.rating,
      reportedOnly: q.reported,
    })
    res.json({ status: 'ok', reviews: rows, pagination: page })
  })

  router.get('/reviews/metrics', requirePermission('reviews.view'), async (req, res) => {
    const q = parse(rangeQuery, req.query)
    res.json({ status: 'ok', metrics: await moderation.metrics(q.days) })
  })

  router.post('/reviews/bulk', requirePermission('reviews.moderate'), async (req, res) => {
    const body = parse(idsBody.extend({ status: reviewStatus }), req.body)
    res.json({ status: 'ok', ...(await moderation.bulkModerate(cmsContext(req), body.ids, body.status)) })
  })

  router.post('/reviews/:id/status', requirePermission('reviews.moderate'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    const body = parse(z.object({ status: reviewStatus, note: z.string().trim().max(500).nullable().optional() }), req.body)
    res.json({ status: 'ok', review: await moderation.setReviewStatus(cmsContext(req), id, body.status, body.note) })
  })

  router.delete('/reviews/:id', requirePermission('reviews.delete'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    await moderation.deleteReview(cmsContext(req), id)
    res.json({ status: 'ok' })
  })

  // ── Reports ────────────────────────────────────────────────────────────

  router.get('/review-reports', requirePermission('reviews.view'), async (req, res) => {
    const q = parse(pagination.extend({ status: z.enum(['open', 'dismissed', 'actioned']).optional() }), req.query)
    const { rows, pagination: page } = await moderation.listReports(q)
    res.json({ status: 'ok', reports: rows, pagination: page })
  })

  router.post('/review-reports/:id/resolve', requirePermission('reviews.moderate'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    const { outcome } = parse(z.object({ outcome: z.enum(['dismissed', 'actioned']) }), req.body)
    await moderation.resolveReport(cmsContext(req), id, outcome)
    res.json({ status: 'ok' })
  })

  // ── Feedback tickets ───────────────────────────────────────────────────

  router.get('/feedback', requirePermission('feedback.view'), async (req, res) => {
    const q = parse(
      pagination.extend({
        q: z.string().trim().max(200).optional(),
        status: ticketStatus.optional(),
        category: ticketCategory.optional(),
        priority: ticketPriority.optional(),
        assigned_to: z.string().uuid().optional(),
        unassigned: queryBool,
      }),
      req.query,
    )
    const { rows, pagination: page } = await feedback.list({
      page: q.page,
      limit: q.limit,
      q: q.q,
      status: q.status,
      category: q.category,
      priority: q.priority,
      assignedTo: q.assigned_to,
      unassigned: q.unassigned,
    })
    res.json({ status: 'ok', tickets: rows, pagination: page })
  })

  router.get('/feedback/metrics', requirePermission('feedback.view'), async (req, res) => {
    const q = parse(rangeQuery, req.query)
    res.json({ status: 'ok', metrics: await feedback.metrics(q.days) })
  })

  router.get('/feedback/:id', requirePermission('feedback.view'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    res.json({ status: 'ok', ticket: await feedback.get(id) })
  })

  router.post('/feedback/:id/messages', requirePermission('feedback.respond'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    const body = parse(z.object({ body: z.string().trim().min(1).max(8000), internal: z.boolean().default(false) }), req.body)
    res.status(201).json({ status: 'ok', ticket: await feedback.reply(cmsContext(req), id, body.body, body.internal) })
  })

  router.patch('/feedback/:id', requirePermission('feedback.respond'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    const body = parse(
      z.object({
        status: ticketStatus.optional(),
        priority: ticketPriority.optional(),
        category: ticketCategory.optional(),
        resolution_note: z.string().trim().max(1000).nullable().optional(),
      }),
      req.body,
    )
    res.json({ status: 'ok', ticket: await feedback.update(cmsContext(req), id, body) })
  })

  router.put('/feedback/:id/assignee', requirePermission('feedback.assign'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    const { assigned_to } = parse(z.object({ assigned_to: z.string().uuid().nullable() }), req.body)
    res.json({ status: 'ok', ticket: await feedback.assign(cmsContext(req), id, assigned_to) })
  })

  router.delete('/feedback/:id', requirePermission('feedback.delete'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    await feedback.remove(cmsContext(req), id)
    res.json({ status: 'ok' })
  })

  return router
}
