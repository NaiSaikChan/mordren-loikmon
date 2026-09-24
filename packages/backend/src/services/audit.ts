import type { Kysely, SelectQueryBuilder, Transaction } from 'kysely'
import type { AuditLog, Database } from '../db/types.js'
import type { Logger } from '../lib/logger.js'
import { pageInfo, type PageInfo } from '../http/validate.js'

/**
 * Append-only activity log.
 *
 * Everything that changes access, money or published content is recorded with
 * the actor, the target entity and the before/after values. Writes never throw
 * into the caller: losing an audit line must not fail the user's operation, so
 * failures are logged at error level instead (and are visible in monitoring).
 */

export type AuditAction =
  | 'login'
  | 'create'
  | 'update'
  | 'delete'
  | 'publish'
  | 'unpublish'
  | 'submit'
  | 'approve'
  | 'reject'
  | 'restore'
  | 'role.assign'
  | 'role.create'
  | 'role.update'
  | 'role.delete'
  | 'permission.update'
  | 'coupon.create'
  | 'coupon.update'
  | 'coupon.delete'
  | 'coupon.redeem'
  | 'moderate'
  | 'assign'
  | 'settings.update'
  | 'grant.create'
  | 'grant.revoke'
  | 'upload'

export interface AuditActorInfo {
  id: string | null
  email: string | null
  role: string | null
  ip?: string | null
  userAgent?: string | null
  requestId?: string | null
}

export interface AuditEntry {
  actor: AuditActorInfo
  action: AuditAction
  entityType: string
  entityId?: string | number | null
  summary?: string | null
  before?: unknown
  after?: unknown
}

/** Values that must never be copied into the audit trail. */
const REDACTED_KEYS = /password|token|secret|private_key|authorization/i

/** Drop secrets and shrink long text so one entry cannot bloat the table. */
export function redactSnapshot(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value ?? null
  if (Array.isArray(value)) return depth > 4 ? '[array]' : value.slice(0, 50).map((v) => redactSnapshot(v, depth + 1))
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value.length > 2000 ? `${value.slice(0, 2000)}…` : value
  if (typeof value !== 'object') return value
  if (depth > 4) return '[object]'
  const out: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    out[key] = REDACTED_KEYS.test(key) ? '[redacted]' : redactSnapshot(entry, depth + 1)
  }
  return out
}

/** Only the fields that actually changed, so an update entry stays readable. */
export function diffSnapshots(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const from: Record<string, unknown> = {}
  const to: Record<string, unknown> = {}
  if (!before || !after) return { before: (before ?? {}) as Record<string, unknown>, after: (after ?? {}) as Record<string, unknown> }
  for (const key of Object.keys(after)) {
    const a = before[key]
    const b = after[key]
    const same = a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : JSON.stringify(a) === JSON.stringify(b)
    if (!same) {
      from[key] = a ?? null
      to[key] = b ?? null
    }
  }
  return { before: from, after: to }
}

export interface AuditQuery {
  page: number
  limit: number
  actorId?: string
  action?: string
  entityType?: string
  entityId?: string
  from?: Date
  to?: Date
}

export class AuditService {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly logger: Logger,
  ) {}

  /**
   * Record one entry. Pass `trx` to write it inside the same transaction as the
   * change, so the trail cannot disagree with the data.
   */
  async record(entry: AuditEntry, trx?: Transaction<Database>): Promise<void> {
    const executor = trx ?? this.db
    const values = {
      actor_id: entry.actor.id,
      actor_email: entry.actor.email,
      actor_role: entry.actor.role,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId === null || entry.entityId === undefined ? null : String(entry.entityId),
      summary: entry.summary ? entry.summary.slice(0, 255) : null,
      before_data: entry.before === undefined ? null : JSON.stringify(redactSnapshot(entry.before)),
      after_data: entry.after === undefined ? null : JSON.stringify(redactSnapshot(entry.after)),
      ip: entry.actor.ip ?? null,
      user_agent: entry.actor.userAgent ? entry.actor.userAgent.slice(0, 255) : null,
      request_id: entry.actor.requestId ?? null,
    }
    try {
      await executor.insertInto('audit_logs').values(values).execute()
    } catch (err) {
      // Inside a transaction the caller decides; standalone we must not fail
      // the user's request because the trail could not be written.
      if (trx) throw err
      this.logger.error({ err, action: entry.action, entity: entry.entityType }, 'failed to write audit entry')
    }
  }

  async list(query: AuditQuery): Promise<{ rows: AuditLog[]; pagination: PageInfo }> {
    // One filter function applied to both the page query and the count query.
    const filtered = <T extends SelectQueryBuilder<Database, 'audit_logs', object>>(builder: T): T => {
      let q = builder
      if (query.actorId) q = q.where('actor_id', '=', query.actorId) as T
      if (query.action) q = q.where('action', '=', query.action) as T
      if (query.entityType) q = q.where('entity_type', '=', query.entityType) as T
      if (query.entityId) q = q.where('entity_id', '=', query.entityId) as T
      if (query.from) q = q.where('created_at', '>=', query.from) as T
      if (query.to) q = q.where('created_at', '<=', query.to) as T
      return q
    }

    const [items, total] = await Promise.all([
      filtered(this.db.selectFrom('audit_logs').selectAll())
        .orderBy('id', 'desc')
        .limit(query.limit)
        .offset((query.page - 1) * query.limit)
        .execute(),
      filtered(this.db.selectFrom('audit_logs').select((eb) => eb.fn.countAll().as('total'))).executeTakeFirst(),
    ])
    return { rows: items, pagination: pageInfo(query.page, query.limit, Number(total?.total ?? 0)) }
  }

  /** History of one entity, newest first (used by the "Activity" tab of an editor). */
  async forEntity(entityType: string, entityId: string | number, limit = 50): Promise<AuditLog[]> {
    return this.db
      .selectFrom('audit_logs')
      .selectAll()
      .where('entity_type', '=', entityType)
      .where('entity_id', '=', String(entityId))
      .orderBy('id', 'desc')
      .limit(limit)
      .execute()
  }

  /** Distinct action names present in the log, for the filter dropdown. */
  async knownActions(): Promise<string[]> {
    const rows = await this.db.selectFrom('audit_logs').select('action').distinct().orderBy('action').execute()
    return rows.map((r) => r.action)
  }
}
