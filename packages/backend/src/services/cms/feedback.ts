import { randomUUID } from 'node:crypto'
import { sql, type Kysely, type SelectQueryBuilder } from 'kysely'
import type { Database, FeedbackTicket, TicketCategory, TicketPriority, TicketStatus } from '../../db/types.js'
import { likePattern, pageInfo } from '../../http/validate.js'
import { errors } from '../../lib/errors.js'
import type { Logger } from '../../lib/logger.js'
import { emailTemplates, type Mailer } from '../../lib/mailer.js'
import { sanitizePlainText } from '../../lib/sanitize.js'
import { AuditService } from '../audit.js'
import type { CmsRequestContext } from './content.js'

/**
 * User feedback as a small ticketing system.
 *
 * A ticket is opened by a reader (signed in or not), answered by staff and
 * closed with a resolution. Replies are e-mailed to the reporter; internal
 * notes stay inside the CMS and are never included in a reporter-facing view.
 */

export interface TicketListParams {
  page: number
  limit: number
  q?: string
  status?: TicketStatus
  category?: TicketCategory
  priority?: TicketPriority
  assignedTo?: string
  unassigned?: boolean
}

export interface CreateTicketInput {
  subject: string
  body: string
  category?: TicketCategory
  email?: string | null
  name?: string | null
  userId?: string | null
}

export class FeedbackService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly audit: AuditService,
    private readonly mailer: Mailer,
    private readonly logger: Logger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // ── Reader side ────────────────────────────────────────────────────────

  /** Opens a ticket from the storefront's contact form. */
  async open(input: CreateTicketInput): Promise<FeedbackTicket> {
    const subject = sanitizePlainText(input.subject).slice(0, 255)
    const body = sanitizePlainText(input.body).slice(0, 8000)
    if (!subject || !body) throw errors.badRequest('A subject and a message are required')
    if (!input.userId && !input.email) throw errors.badRequest('An e-mail address is required so we can reply')

    const reference = `LK-${randomUUID().slice(0, 8).toUpperCase()}`
    const id = await this.db.transaction().execute(async (trx) => {
      const inserted = await trx
        .insertInto('feedback_tickets')
        .values({
          reference,
          user_id: input.userId ?? null,
          email: input.email ? input.email.toLowerCase().slice(0, 255) : null,
          name: input.name ? sanitizePlainText(input.name).slice(0, 160) : null,
          subject,
          category: input.category ?? 'other',
        })
        .executeTakeFirstOrThrow()
      const ticketId = Number(inserted.insertId)
      await trx.insertInto('feedback_messages').values({ ticket_id: ticketId, author_user_id: input.userId ?? null, body }).execute()
      return ticketId
    })
    return this.db.selectFrom('feedback_tickets').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  }

  /** The signed-in user's own tickets, with the public (non-internal) thread. */
  async listForUser(userId: string) {
    const tickets = await this.db
      .selectFrom('feedback_tickets')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .limit(50)
      .execute()
    if (!tickets.length) return []
    const messages = await this.db
      .selectFrom('feedback_messages')
      .selectAll()
      .where(
        'ticket_id',
        'in',
        tickets.map((t) => t.id),
      )
      .where('is_internal', '=', false)
      .orderBy('created_at')
      .execute()
    return tickets.map((ticket) => ({ ...ticket, messages: messages.filter((m) => m.ticket_id === ticket.id) }))
  }

  // ── Staff side ─────────────────────────────────────────────────────────

  async list(params: TicketListParams) {
    const filtered = <T extends SelectQueryBuilder<Database, 'feedback_tickets', object>>(builder: T): T => {
      let q = builder
      if (params.status) q = q.where('status', '=', params.status) as T
      if (params.category) q = q.where('category', '=', params.category) as T
      if (params.priority) q = q.where('priority', '=', params.priority) as T
      if (params.assignedTo) q = q.where('assigned_to', '=', params.assignedTo) as T
      if (params.unassigned) q = q.where('assigned_to', 'is', null) as T
      if (params.q) {
        const pattern = likePattern(params.q)
        q = q.where(sql<boolean>`(subject LIKE ${pattern} OR reference LIKE ${pattern} OR email LIKE ${pattern})`) as T
      }
      return q
    }

    const [rows, total] = await Promise.all([
      filtered(
        this.db
          .selectFrom('feedback_tickets')
          .selectAll('feedback_tickets')
          .select((eb) => [
            eb
              .selectFrom('users')
              .whereRef('users.id', '=', 'feedback_tickets.assigned_to')
              .select('users.name')
              .as('assignee_name'),
            eb
              .selectFrom('feedback_messages as m')
              .whereRef('m.ticket_id', '=', 'feedback_tickets.id')
              .select(eb.fn.countAll().as('n'))
              .as('messages_count'),
          ]) as unknown as SelectQueryBuilder<Database, 'feedback_tickets', object>,
      )
        // Urgent first, then oldest — the queue a support agent wants.
        .orderBy(sql`FIELD(priority, 'urgent', 'high', 'normal', 'low')` as never)
        .orderBy('created_at')
        .limit(params.limit)
        .offset((params.page - 1) * params.limit)
        .execute(),
      filtered(this.db.selectFrom('feedback_tickets').select((eb) => eb.fn.countAll().as('total'))).executeTakeFirst(),
    ])
    return { rows: rows as Array<Record<string, unknown>>, pagination: pageInfo(params.page, params.limit, Number(total?.total ?? 0)) }
  }

  async get(id: number) {
    const ticket = await this.db.selectFrom('feedback_tickets').selectAll().where('id', '=', id).executeTakeFirst()
    if (!ticket) throw errors.notFound('Ticket')
    const messages = await this.db
      .selectFrom('feedback_messages as m')
      .leftJoin('users as u', 'u.id', 'm.author_user_id')
      .select(['m.id', 'm.body', 'm.is_internal', 'm.author_user_id', 'm.created_at', 'u.name as author_name', 'u.email as author_email'])
      .where('m.ticket_id', '=', id)
      .orderBy('m.created_at')
      .execute()
    return { ...ticket, messages }
  }

  /** Adds a reply (or an internal note) and e-mails the reporter when public. */
  async reply(ctx: CmsRequestContext, id: number, body: string, isInternal: boolean) {
    const ticket = await this.db.selectFrom('feedback_tickets').selectAll().where('id', '=', id).executeTakeFirst()
    if (!ticket) throw errors.notFound('Ticket')
    const message = sanitizePlainText(body).slice(0, 8000)
    if (!message) throw errors.badRequest('The reply cannot be empty')

    await this.db.transaction().execute(async (trx) => {
      await trx
        .insertInto('feedback_messages')
        .values({ ticket_id: id, author_user_id: ctx.actor.userId, body: message, is_internal: isInternal })
        .execute()
      const patch: Record<string, unknown> = {}
      if (!isInternal) {
        if (!ticket.first_response_at) patch.first_response_at = this.now()
        if (ticket.status === 'open') patch.status = 'pending'
      }
      if (Object.keys(patch).length) await trx.updateTable('feedback_tickets').set(patch as never).where('id', '=', id).execute()
    })

    if (!isInternal) await this.notifyReporter(ticket, message)
    await this.audit.record({
      actor: ctx.audit,
      action: 'update',
      entityType: 'ticket',
      entityId: id,
      summary: `${ticket.reference}: ${isInternal ? 'internal note' : 'reply sent'}`,
    })
    return this.get(id)
  }

  async assign(ctx: CmsRequestContext, id: number, assignee: string | null) {
    const ticket = await this.db.selectFrom('feedback_tickets').selectAll().where('id', '=', id).executeTakeFirst()
    if (!ticket) throw errors.notFound('Ticket')
    if (assignee) {
      const user = await this.db.selectFrom('users').select('id').where('id', '=', assignee).executeTakeFirst()
      if (!user) throw errors.notFound('User')
    }
    await this.db.updateTable('feedback_tickets').set({ assigned_to: assignee }).where('id', '=', id).execute()
    await this.audit.record({
      actor: ctx.audit,
      action: 'assign',
      entityType: 'ticket',
      entityId: id,
      summary: ticket.reference,
      before: { assigned_to: ticket.assigned_to },
      after: { assigned_to: assignee },
    })
    return this.get(id)
  }

  async update(
    ctx: CmsRequestContext,
    id: number,
    input: { status?: TicketStatus; priority?: TicketPriority; category?: TicketCategory; resolution_note?: string | null },
  ) {
    const ticket = await this.db.selectFrom('feedback_tickets').selectAll().where('id', '=', id).executeTakeFirst()
    if (!ticket) throw errors.notFound('Ticket')
    const patch: Record<string, unknown> = {}
    if (input.status !== undefined) {
      patch.status = input.status
      patch.resolved_at = input.status === 'resolved' || input.status === 'closed' ? (ticket.resolved_at ?? this.now()) : null
    }
    if (input.priority !== undefined) patch.priority = input.priority
    if (input.category !== undefined) patch.category = input.category
    if (input.resolution_note !== undefined) {
      patch.resolution_note = input.resolution_note === null ? null : sanitizePlainText(input.resolution_note).slice(0, 1000)
    }
    if (!Object.keys(patch).length) throw errors.badRequest('Nothing to update')

    await this.db.updateTable('feedback_tickets').set(patch as never).where('id', '=', id).execute()
    await this.audit.record({
      actor: ctx.audit,
      action: 'update',
      entityType: 'ticket',
      entityId: id,
      summary: ticket.reference,
      before: { status: ticket.status, priority: ticket.priority },
      after: patch,
    })
    return this.get(id)
  }

  async remove(ctx: CmsRequestContext, id: number): Promise<void> {
    const ticket = await this.db.selectFrom('feedback_tickets').selectAll().where('id', '=', id).executeTakeFirst()
    if (!ticket) throw errors.notFound('Ticket')
    await this.db.deleteFrom('feedback_tickets').where('id', '=', id).execute()
    await this.audit.record({ actor: ctx.audit, action: 'delete', entityType: 'ticket', entityId: id, summary: ticket.reference, before: ticket })
  }

  /** Queue health for the dashboard: volume, backlog and resolution speed. */
  async metrics(days = 30) {
    const since = new Date(this.now().getTime() - days * 24 * 3600 * 1000)
    const [byStatus, byCategory, resolution, daily] = await Promise.all([
      this.db
        .selectFrom('feedback_tickets')
        .select((eb) => ['status', eb.fn.countAll().as('n')])
        .groupBy('status')
        .execute(),
      this.db
        .selectFrom('feedback_tickets')
        .select((eb) => ['category', eb.fn.countAll().as('n')])
        .where('created_at', '>=', since)
        .groupBy('category')
        .execute(),
      this.db
        .selectFrom('feedback_tickets')
        .select([
          sql<number>`AVG(TIMESTAMPDIFF(MINUTE, created_at, resolved_at))`.as('avg_resolution_minutes'),
          sql<number>`AVG(TIMESTAMPDIFF(MINUTE, created_at, first_response_at))`.as('avg_first_response_minutes'),
        ])
        .where('resolved_at', 'is not', null)
        .where('created_at', '>=', since)
        .executeTakeFirst(),
      this.db
        .selectFrom('feedback_tickets')
        .select((eb) => [sql<string>`DATE(created_at)`.as('date'), eb.fn.countAll().as('n')])
        .where('created_at', '>=', since)
        .groupBy(sql`DATE(created_at)`)
        .orderBy(sql`DATE(created_at)`)
        .execute(),
    ])

    const statusCounts = Object.fromEntries(byStatus.map((r) => [r.status, Number(r.n)])) as Record<TicketStatus, number>
    return {
      by_status: statusCounts,
      open: (statusCounts.open ?? 0) + (statusCounts.pending ?? 0),
      by_category: byCategory.map((r) => ({ category: r.category, count: Number(r.n) })),
      avg_resolution_minutes: Math.round(Number(resolution?.avg_resolution_minutes ?? 0)),
      avg_first_response_minutes: Math.round(Number(resolution?.avg_first_response_minutes ?? 0)),
      daily: daily.map((d) => ({ date: String(d.date), count: Number(d.n) })),
    }
  }

  private async notifyReporter(ticket: FeedbackTicket, message: string): Promise<void> {
    const to = ticket.email ?? (await this.emailOfUser(ticket.user_id))
    if (!to) return
    try {
      await this.mailer.send({ to, ...emailTemplates.ticketReply(ticket.reference, ticket.subject, message) })
    } catch (err) {
      // A failed notification must not roll back the reply that was saved.
      this.logger.warn({ err, ticket: ticket.reference }, 'could not e-mail the ticket reply')
    }
  }

  private async emailOfUser(userId: string | null): Promise<string | null> {
    if (!userId) return null
    const row = await this.db.selectFrom('users').select('email').where('id', '=', userId).executeTakeFirst()
    return row?.email ?? null
  }
}
