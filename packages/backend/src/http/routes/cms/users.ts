import { Router } from 'express'
import { sql, type SelectQueryBuilder } from 'kysely'
import { z } from 'zod'
import { PERMISSIONS, PERMISSION_GROUPS } from '../../../domain/permissions.js'
import { errors } from '../../../lib/errors.js'
import { normaliseRoleKey } from '../../../services/rbac.js'
import type { Database } from '../../../db/types.js'
import type { AppContext } from '../../context.js'
import { auditActor, requirePermission, requireActor } from '../../middleware/permissions.js'
import { idParam, likePattern, pageInfo, pagination, parse } from '../../validate.js'

/**
 * User accounts, role assignment and the role editor.
 *
 * Role and permission changes are the highest-value target in the CMS, so each
 * one is audited and two rules are enforced regardless of permissions:
 * an administrator cannot strip their own admin role, and the last
 * administrator cannot be demoted.
 */

const userIdParam = z.object({ userId: z.string().uuid() })

const RoleInput = z.object({
  key: z.string().trim().min(2).max(64),
  name: z.string().trim().min(2).max(128),
  description: z.string().trim().max(255).nullable().optional(),
  scope: z.enum(['all', 'own']).default('all'),
  rank: z.number().int().min(1).max(399).optional(),
  permissions: z.array(z.string().max(64)).max(PERMISSIONS.length),
})

export function usersRouter(ctx: AppContext) {
  const router = Router()
  const db = ctx.db

  // ── Permission catalogue (role editor) ─────────────────────────────────

  router.get('/permissions', requirePermission('roles.manage'), (_req, res) => {
    res.json({ status: 'ok', permissions: PERMISSIONS, groups: PERMISSION_GROUPS })
  })

  // ── Roles ──────────────────────────────────────────────────────────────

  router.get('/roles', requirePermission('roles.manage'), async (_req, res) => {
    res.json({ status: 'ok', roles: await ctx.services.rbac.listRoles() })
  })

  router.post('/roles', requirePermission('roles.manage'), async (req, res) => {
    const body = parse(RoleInput, req.body)
    const role = await ctx.services.rbac.createRole({ ...body, key: normaliseRoleKey(body.key) })
    await ctx.services.audit.record({
      actor: auditActor(req),
      action: 'role.create',
      entityType: 'role',
      entityId: role.id,
      summary: role.role_key,
      after: role,
    })
    res.status(201).json({ status: 'ok', role })
  })

  router.patch('/roles/:id', requirePermission('roles.manage'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    const body = parse(RoleInput.partial().omit({ key: true }), req.body)
    const before = await ctx.services.rbac.getRole(id)
    const role = await ctx.services.rbac.updateRole(id, body)
    await ctx.services.audit.record({
      actor: auditActor(req),
      action: body.permissions ? 'permission.update' : 'role.update',
      entityType: 'role',
      entityId: id,
      summary: role.role_key,
      before: { permissions: before.permissions, name: before.name, scope: before.scope },
      after: { permissions: role.permissions, name: role.name, scope: role.scope },
    })
    res.json({ status: 'ok', role })
  })

  router.delete('/roles/:id', requirePermission('roles.manage'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    const before = await ctx.services.rbac.getRole(id)
    await ctx.services.rbac.deleteRole(id)
    await ctx.services.audit.record({
      actor: auditActor(req),
      action: 'role.delete',
      entityType: 'role',
      entityId: id,
      summary: before.role_key,
      before,
    })
    res.json({ status: 'ok' })
  })

  // ── Users ──────────────────────────────────────────────────────────────

  router.get('/users', requirePermission('users.view'), async (req, res) => {
    const q = parse(
      pagination.extend({
        q: z.string().trim().max(200).optional(),
        role: z.string().trim().max(64).optional(),
        verified: z.enum(['true', 'false']).optional(),
        subscribed: z.enum(['true', 'false']).optional(),
      }),
      req.query,
    )

    const filtered = <T extends SelectQueryBuilder<Database, 'users', object>>(builder: T): T => {
      let query = builder
      if (q.q) {
        const pattern = likePattern(q.q)
        query = query.where(
          sql<boolean>`(users.email LIKE ${pattern} OR users.name LIKE ${pattern} OR users.phone LIKE ${pattern})`,
        ) as T
      }
      if (q.role) query = query.where('users.role', '=', q.role) as T
      if (q.verified) query = query.where('users.email_verified', '=', q.verified === 'true') as T
      if (q.subscribed) {
        const active = sql<boolean>`EXISTS (
          SELECT 1 FROM subscriptions s
          WHERE s.user_id = users.id AND s.status IN ('active','grace_period')
            AND (s.expires_at IS NULL OR s.expires_at > NOW())
        )`
        query = query.where(q.subscribed === 'true' ? active : sql<boolean>`NOT ${active}`) as T
      }
      return query
    }

    const [users, total] = await Promise.all([
      filtered(
        db
          .selectFrom('users')
          .select(['users.id', 'users.email', 'users.name', 'users.role', 'users.email_verified', 'users.phone', 'users.created_at'])
          .select((eb) => [
            eb
              .selectFrom('user_roles as ur')
              .innerJoin('roles as r', 'r.id', 'ur.role_id')
              .whereRef('ur.user_id', '=', 'users.id')
              .select(sql<string>`GROUP_CONCAT(r.role_key)`.as('keys'))
              .as('role_keys'),
            eb.selectFrom('authors').whereRef('authors.user_id', '=', 'users.id').select('authors.id').as('author_id'),
          ]) as unknown as SelectQueryBuilder<Database, 'users', object>,
      )
        .orderBy('users.created_at', 'desc')
        .limit(q.limit)
        .offset((q.page - 1) * q.limit)
        .execute(),
      filtered(db.selectFrom('users').select((eb) => eb.fn.countAll().as('total'))).executeTakeFirst(),
    ])

    res.json({
      status: 'ok',
      users: (users as Array<Record<string, unknown>>).map((u) => ({
        ...u,
        role_keys: u.role_keys ? String(u.role_keys).split(',') : [String(u.role ?? 'user')],
      })),
      pagination: pageInfo(q.page, q.limit, Number(total?.total ?? 0)),
    })
  })

  router.get('/users/:userId', requirePermission('users.view'), async (req, res) => {
    const { userId } = parse(userIdParam, req.params)
    const user = await db
      .selectFrom('users')
      .select(['id', 'email', 'name', 'firstname', 'lastname', 'phone', 'role', 'email_verified', 'image', 'created_at'])
      .where('id', '=', userId)
      .executeTakeFirst()
    if (!user) throw errors.notFound('User')

    const [roles, subscriptions, grants, entitlement, authorProfile, activity] = await Promise.all([
      ctx.services.rbac.getUserRoles(userId),
      ctx.services.subscriptions.listUserSubscriptions(userId),
      db.selectFrom('entitlement_grants').selectAll().where('user_id', '=', userId).orderBy('created_at', 'desc').execute(),
      ctx.services.subscriptions.getEntitlement(userId, user.role),
      db.selectFrom('authors').select(['id', 'name']).where('user_id', '=', userId).executeTakeFirst(),
      ctx.services.audit.list({ page: 1, limit: 20, actorId: userId }),
    ])
    res.json({
      status: 'ok',
      user,
      roles,
      subscriptions,
      grants,
      entitlement,
      author_profile: authorProfile ?? null,
      recent_activity: activity.rows,
    })
  })

  router.patch('/users/:userId', requirePermission('users.edit'), async (req, res) => {
    const { userId } = parse(userIdParam, req.params)
    const body = parse(
      z.object({
        name: z.string().trim().min(1).max(160).optional(),
        firstname: z.string().trim().max(120).nullable().optional(),
        lastname: z.string().trim().max(120).nullable().optional(),
        phone: z.string().trim().max(40).nullable().optional(),
        email_verified: z.boolean().optional(),
      }),
      req.body,
    )
    if (!Object.keys(body).length) throw errors.badRequest('Nothing to update')
    const before = await db.selectFrom('users').selectAll().where('id', '=', userId).executeTakeFirst()
    if (!before) throw errors.notFound('User')
    await db.updateTable('users').set({ ...body, updated_at: new Date() }).where('id', '=', userId).execute()
    await ctx.services.audit.record({
      actor: auditActor(req),
      action: 'update',
      entityType: 'user',
      entityId: userId,
      summary: before.email,
      before: { name: before.name, phone: before.phone, email_verified: before.email_verified },
      after: body,
    })
    res.json({ status: 'ok' })
  })

  /** Replaces the user's roles. `users.role` is refreshed from the result. */
  router.put('/users/:userId/roles', requirePermission('roles.manage'), async (req, res) => {
    const { userId } = parse(userIdParam, req.params)
    const { role_ids } = parse(z.object({ role_ids: z.array(z.number().int().positive()).max(10) }), req.body)
    const actor = requireActor(req)

    const before = await ctx.services.rbac.getUserRoles(userId)
    if (userId === actor.userId && before.some((r) => r.role_key === 'admin')) {
      const keeps = await db.selectFrom('roles').select('id').where('role_key', '=', 'admin').executeTakeFirst()
      if (keeps && !role_ids.includes(keeps.id)) throw errors.badRequest('You cannot remove your own administrator role')
    }
    if (await ctx.services.rbac.wouldRemoveLastAdmin(userId, role_ids)) {
      throw errors.conflict('At least one administrator must remain')
    }

    const primaryRole = await ctx.services.rbac.setUserRoles(userId, role_ids, actor.userId)
    const after = await ctx.services.rbac.getUserRoles(userId)
    await ctx.services.audit.record({
      actor: auditActor(req),
      action: 'role.assign',
      entityType: 'user',
      entityId: userId,
      summary: `Roles: ${after.map((r) => r.role_key).join(', ') || 'none'}`,
      before: { roles: before.map((r) => r.role_key) },
      after: { roles: after.map((r) => r.role_key) },
    })
    res.json({ status: 'ok', primary_role: primaryRole, roles: after })
  })

  router.delete('/users/:userId', requirePermission('users.delete'), async (req, res) => {
    const { userId } = parse(userIdParam, req.params)
    const actor = requireActor(req)
    if (userId === actor.userId) throw errors.badRequest('You cannot delete your own account from the CMS')
    const before = await db.selectFrom('users').select(['id', 'email', 'role']).where('id', '=', userId).executeTakeFirst()
    if (!before) throw errors.notFound('User')
    if (await ctx.services.rbac.wouldRemoveLastAdmin(userId, [])) throw errors.conflict('At least one administrator must remain')
    await db.deleteFrom('users').where('id', '=', userId).execute()
    ctx.services.rbac.invalidate(userId)
    await ctx.services.audit.record({
      actor: auditActor(req),
      action: 'delete',
      entityType: 'user',
      entityId: userId,
      summary: before.email,
      before,
    })
    res.json({ status: 'ok' })
  })

  // ── Complimentary access ───────────────────────────────────────────────

  router.post('/users/:userId/grants', requirePermission('subscriptions.manage'), async (req, res) => {
    const { userId } = parse(userIdParam, req.params)
    const body = parse(
      z.object({ reason: z.string().trim().min(1).max(255), expires_at: z.string().datetime({ offset: true }).nullable().default(null) }),
      req.body,
    )
    if (!(await ctx.db.selectFrom('users').select('id').where('id', '=', userId).executeTakeFirst())) throw errors.notFound('User')
    const id = await ctx.services.subscriptions.grantAccess({
      userId,
      reason: body.reason,
      expiresAt: body.expires_at ? new Date(body.expires_at) : null,
      grantedBy: requireActor(req).userId,
    })
    await ctx.services.audit.record({
      actor: auditActor(req),
      action: 'grant.create',
      entityType: 'entitlement_grant',
      entityId: id,
      summary: `${body.reason} for ${userId}`,
      after: body,
    })
    res.status(201).json({ status: 'ok', id })
  })

  router.delete('/grants/:id', requirePermission('subscriptions.manage'), async (req, res) => {
    const { id } = parse(idParam, req.params)
    if (!(await ctx.services.subscriptions.revokeGrant(id))) throw errors.notFound('Active grant')
    await ctx.services.audit.record({
      actor: auditActor(req),
      action: 'grant.revoke',
      entityType: 'entitlement_grant',
      entityId: id,
      summary: 'Grant revoked',
    })
    res.json({ status: 'ok' })
  })

  // ── Bulk actions ───────────────────────────────────────────────────────

  router.post('/users/bulk', requirePermission('users.edit'), async (req, res) => {
    const body = parse(
      z.object({
        user_ids: z.array(z.string().uuid()).min(1).max(200),
        action: z.enum(['verify_email', 'assign_role', 'remove_role']),
        role_id: z.number().int().positive().optional(),
      }),
      req.body,
    )
    const actor = requireActor(req)
    const succeeded: string[] = []
    const failed: Array<{ id: string; message: string }> = []

    for (const userId of body.user_ids) {
      try {
        if (body.action === 'verify_email') {
          await db.updateTable('users').set({ email_verified: true, updated_at: new Date() }).where('id', '=', userId).execute()
        } else {
          if (!body.role_id) throw errors.badRequest('role_id is required for this action')
          if (!actor.permissions.has('roles.manage')) throw errors.permissionDenied('roles.manage')
          const current = (await ctx.services.rbac.getUserRoles(userId)).map((r) => r.id)
          const next =
            body.action === 'assign_role'
              ? [...new Set([...current, body.role_id])]
              : current.filter((id) => id !== body.role_id)
          if (await ctx.services.rbac.wouldRemoveLastAdmin(userId, next)) throw errors.conflict('At least one administrator must remain')
          await ctx.services.rbac.setUserRoles(userId, next, actor.userId)
        }
        succeeded.push(userId)
      } catch (err) {
        failed.push({ id: userId, message: err instanceof Error ? err.message : 'Failed' })
      }
    }

    await ctx.services.audit.record({
      actor: auditActor(req),
      action: body.action === 'verify_email' ? 'update' : 'role.assign',
      entityType: 'user',
      entityId: null,
      summary: `Bulk ${body.action} on ${succeeded.length} user(s)`,
      after: { succeeded, failed },
    })
    res.json({ status: 'ok', succeeded, failed })
  })

  return router
}
