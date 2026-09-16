import type { Kysely, Transaction } from 'kysely'
import type { Database, Role, RoleScope } from '../db/types.js'
import { isPermission, SYSTEM_ROLE_KEYS, type Permission } from '../domain/permissions.js'
import { errors } from '../lib/errors.js'

/**
 * Role-based access control.
 *
 * Roles live in the database so an administrator can define custom ones; the
 * permission *vocabulary* is fixed in code (`domain/permissions.ts`). A user's
 * effective permissions are the union over every role assigned to them, and
 * their effective scope is the broadest scope any of those roles carries.
 *
 * `users.role` stays the single role key the legacy `requireAdmin` guard and
 * the entitlement calculation read; this service keeps it equal to the
 * highest-ranked role the user holds.
 */

export interface CmsActor {
  userId: string
  email: string
  /** Denormalised primary role key ('admin', 'manager', 'author', 'user', ...). */
  primaryRole: string
  roleKeys: string[]
  permissions: ReadonlySet<string>
  /** 'own' restricts every catalogue query to `ownedAuthorIds`. */
  scope: RoleScope
  /** Author profiles linked to this account (`authors.user_id`). */
  ownedAuthorIds: number[]
}

export interface RoleWithPermissions extends Role {
  permissions: string[]
  users_count: number
}

/** Cache entry lifetime. Short enough that a revoked role stops working promptly. */
const CACHE_TTL_MS = 30_000

export class RbacService {
  private readonly cache = new Map<string, { expires: number; actor: CmsActor }>()

  constructor(
    private readonly db: Kysely<Database>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // ── Actor resolution ───────────────────────────────────────────────────

  /** Effective permissions, scope and owned author profiles for one user. */
  async resolveActor(user: { id: string; email: string; role: string }): Promise<CmsActor> {
    const cached = this.cache.get(user.id)
    if (cached && cached.expires > Date.now()) return cached.actor

    const [roleRows, permissionRows, authorRows] = await Promise.all([
      this.db
        .selectFrom('user_roles as ur')
        .innerJoin('roles as r', 'r.id', 'ur.role_id')
        .select(['r.id', 'r.role_key', 'r.scope', 'r.rank'])
        .where('ur.user_id', '=', user.id)
        .execute(),
      this.db
        .selectFrom('user_roles as ur')
        .innerJoin('role_permissions as rp', 'rp.role_id', 'ur.role_id')
        .select('rp.permission')
        .where('ur.user_id', '=', user.id)
        .distinct()
        .execute(),
      this.db.selectFrom('authors').select('id').where('user_id', '=', user.id).execute(),
    ])

    // A user created before the CMS module (or by a direct SQL insert) has no
    // rows in user_roles; fall back to the legacy `users.role` column.
    const roleKeys = roleRows.length ? roleRows.map((r) => r.role_key) : [user.role || 'user']
    const permissions = new Set(permissionRows.map((r) => r.permission))
    if (!roleRows.length && user.role === 'admin') {
      for (const permission of await this.permissionsOfRoleKey('admin')) permissions.add(permission)
    }

    const actor: CmsActor = {
      userId: user.id,
      email: user.email,
      primaryRole: roleRows.length
        ? roleRows.reduce((best, r) => (r.rank > best.rank ? r : best), roleRows[0]).role_key
        : user.role || 'user',
      roleKeys,
      permissions,
      scope: roleRows.some((r) => r.scope === 'all') ? 'all' : roleRows.length ? 'own' : user.role === 'admin' ? 'all' : 'own',
      ownedAuthorIds: authorRows.map((r) => r.id),
    }
    this.cache.set(user.id, { expires: Date.now() + CACHE_TTL_MS, actor })
    return actor
  }

  private async permissionsOfRoleKey(key: string): Promise<string[]> {
    const rows = await this.db
      .selectFrom('role_permissions as rp')
      .innerJoin('roles as r', 'r.id', 'rp.role_id')
      .select('rp.permission')
      .where('r.role_key', '=', key)
      .execute()
    return rows.map((r) => r.permission)
  }

  /** Drop cached permissions after a role or assignment changes. */
  invalidate(userId?: string): void {
    if (userId) this.cache.delete(userId)
    else this.cache.clear()
  }

  // ── Roles ──────────────────────────────────────────────────────────────

  async listRoles(): Promise<RoleWithPermissions[]> {
    const [roles, permissions, counts] = await Promise.all([
      this.db.selectFrom('roles').selectAll().orderBy('rank', 'desc').orderBy('name').execute(),
      this.db.selectFrom('role_permissions').select(['role_id', 'permission']).execute(),
      this.db
        .selectFrom('user_roles')
        .select((eb) => ['role_id', eb.fn.countAll().as('n')])
        .groupBy('role_id')
        .execute(),
    ])
    const byRole = new Map<number, string[]>()
    for (const row of permissions) {
      const list = byRole.get(row.role_id) ?? []
      list.push(row.permission)
      byRole.set(row.role_id, list)
    }
    const countByRole = new Map(counts.map((c) => [c.role_id, Number(c.n)]))
    return roles.map((role) => ({
      ...role,
      permissions: (byRole.get(role.id) ?? []).sort(),
      users_count: countByRole.get(role.id) ?? 0,
    }))
  }

  async getRole(id: number): Promise<RoleWithPermissions> {
    const role = (await this.listRoles()).find((r) => r.id === id)
    if (!role) throw errors.notFound('Role')
    return role
  }

  async createRole(input: {
    key: string
    name: string
    description?: string | null
    scope: RoleScope
    rank?: number
    permissions: string[]
  }): Promise<RoleWithPermissions> {
    const key = normaliseRoleKey(input.key)
    if (SYSTEM_ROLE_KEYS.includes(key)) throw errors.conflict(`"${key}" is a reserved role key`)
    const permissions = assertPermissions(input.permissions)
    const id = await this.db.transaction().execute(async (trx) => {
      const inserted = await trx
        .insertInto('roles')
        .values({
          role_key: key,
          name: input.name,
          description: input.description ?? null,
          scope: input.scope,
          rank: clampRank(input.rank ?? 150),
          is_system: false,
        })
        .executeTakeFirstOrThrow()
      const roleId = Number(inserted.insertId)
      await this.writePermissions(trx, roleId, permissions)
      return roleId
    })
    this.invalidate()
    return this.getRole(id)
  }

  async updateRole(
    id: number,
    input: { name?: string; description?: string | null; scope?: RoleScope; rank?: number; permissions?: string[] },
  ): Promise<RoleWithPermissions> {
    const role = await this.db.selectFrom('roles').selectAll().where('id', '=', id).executeTakeFirst()
    if (!role) throw errors.notFound('Role')
    const permissions = input.permissions ? assertPermissions(input.permissions) : undefined
    // The admin role must keep every permission, or the platform can be locked out.
    if (role.role_key === 'admin' && permissions) throw errors.roleProtected('The administrator role always holds every permission')
    if (role.is_system && (input.scope !== undefined || input.rank !== undefined)) {
      throw errors.roleProtected('The scope and rank of a system role cannot be changed')
    }

    await this.db.transaction().execute(async (trx) => {
      const patch: Record<string, unknown> = {}
      if (input.name !== undefined) patch.name = input.name
      if (input.description !== undefined) patch.description = input.description
      if (input.scope !== undefined) patch.scope = input.scope
      if (input.rank !== undefined) patch.rank = clampRank(input.rank)
      if (Object.keys(patch).length) await trx.updateTable('roles').set(patch).where('id', '=', id).execute()
      if (permissions) {
        await trx.deleteFrom('role_permissions').where('role_id', '=', id).execute()
        await this.writePermissions(trx, id, permissions)
      }
    })
    this.invalidate()
    return this.getRole(id)
  }

  async deleteRole(id: number): Promise<void> {
    const role = await this.db.selectFrom('roles').selectAll().where('id', '=', id).executeTakeFirst()
    if (!role) throw errors.notFound('Role')
    if (role.is_system) throw errors.roleProtected('System roles cannot be deleted')
    const inUse = await this.db.selectFrom('user_roles').select('user_id').where('role_id', '=', id).executeTakeFirst()
    if (inUse) throw errors.conflict('Reassign the users holding this role before deleting it')
    await this.db.deleteFrom('roles').where('id', '=', id).execute()
    this.invalidate()
  }

  private async writePermissions(trx: Transaction<Database>, roleId: number, permissions: Permission[]) {
    if (!permissions.length) return
    await trx
      .insertInto('role_permissions')
      .values(permissions.map((permission) => ({ role_id: roleId, permission })))
      .execute()
  }

  // ── Assignment ─────────────────────────────────────────────────────────

  async getUserRoles(userId: string): Promise<Array<Pick<Role, 'id' | 'role_key' | 'name' | 'scope'>>> {
    return this.db
      .selectFrom('user_roles as ur')
      .innerJoin('roles as r', 'r.id', 'ur.role_id')
      .select(['r.id', 'r.role_key', 'r.name', 'r.scope'])
      .where('ur.user_id', '=', userId)
      .orderBy('r.rank', 'desc')
      .execute()
  }

  /** Replaces the user's role set and refreshes the denormalised `users.role`. */
  async setUserRoles(userId: string, roleIds: number[], grantedBy: string | null): Promise<string> {
    const unique = [...new Set(roleIds)]
    const roles = unique.length
      ? await this.db.selectFrom('roles').selectAll().where('id', 'in', unique).execute()
      : []
    if (roles.length !== unique.length) throw errors.badRequest('One or more roles do not exist')

    const primaryRole = await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom('user_roles').where('user_id', '=', userId).execute()
      if (roles.length) {
        await trx
          .insertInto('user_roles')
          .values(roles.map((role) => ({ user_id: userId, role_id: role.id, granted_by: grantedBy })))
          .execute()
      }
      const key = roles.length ? roles.reduce((best, r) => (r.rank > best.rank ? r : best), roles[0]).role_key : 'user'
      await trx.updateTable('users').set({ role: key, updated_at: this.now() }).where('id', '=', userId).execute()
      return key
    })
    this.invalidate(userId)
    return primaryRole
  }

  /** True when every remaining admin would be removed by this change. */
  async wouldRemoveLastAdmin(userId: string, nextRoleIds: number[]): Promise<boolean> {
    const adminRole = await this.db.selectFrom('roles').select('id').where('role_key', '=', 'admin').executeTakeFirst()
    if (!adminRole) return false
    if (nextRoleIds.includes(adminRole.id)) return false
    const others = await this.db
      .selectFrom('user_roles')
      .select('user_id')
      .where('role_id', '=', adminRole.id)
      .where('user_id', '!=', userId)
      .executeTakeFirst()
    return !others
  }
}

export function normaliseRoleKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

function clampRank(rank: number): number {
  return Math.min(399, Math.max(1, Math.trunc(rank)))
}

function assertPermissions(values: string[]): Permission[] {
  const unknown = values.filter((v) => !isPermission(v))
  if (unknown.length) throw errors.validation(unknown.map((v) => ({ path: 'permissions', message: `Unknown permission "${v}"` })))
  return [...new Set(values)] as Permission[]
}

/** True when the actor holds every listed permission. */
export function actorCan(actor: CmsActor, ...required: string[]): boolean {
  return required.every((permission) => actor.permissions.has(permission))
}

/** True when the actor holds at least one of the listed permissions. */
export function actorCanAny(actor: CmsActor, ...required: string[]): boolean {
  return required.some((permission) => actor.permissions.has(permission))
}
