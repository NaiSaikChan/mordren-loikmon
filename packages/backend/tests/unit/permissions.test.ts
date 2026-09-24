import { describe, expect, it } from 'vitest'
import { PERMISSIONS, PERMISSION_GROUPS, SYSTEM_ROLES, isPermission } from '../../src/domain/permissions.js'
import { actorCan, actorCanAny, normaliseRoleKey, type CmsActor } from '../../src/services/rbac.js'

const role = (key: string) => SYSTEM_ROLES.find((r) => r.key === key)!

function actor(permissions: string[], overrides: Partial<CmsActor> = {}): CmsActor {
  return {
    userId: 'u1',
    email: 'u1@loikmon.test',
    primaryRole: 'manager',
    roleKeys: ['manager'],
    permissions: new Set(permissions),
    scope: 'all',
    ownedAuthorIds: [],
    ...overrides,
  }
}

describe('permission catalogue', () => {
  it('has no duplicates', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length)
  })

  it('places every permission in exactly one group, so the role editor shows them all', () => {
    const grouped = PERMISSION_GROUPS.flatMap((group) => group.permissions)
    expect(new Set(grouped).size).toBe(grouped.length)
    expect([...grouped].sort()).toEqual([...PERMISSIONS].sort())
  })

  it('recognises only known permissions', () => {
    expect(isPermission('books.publish')).toBe(true)
    expect(isPermission('books.teleport')).toBe(false)
  })
})

describe('system roles', () => {
  it('gives the administrator every permission', () => {
    expect(role('admin').permissions).toHaveLength(PERMISSIONS.length)
    expect(role('admin').scope).toBe('all')
  })

  it('withholds system configuration from managers', () => {
    const manager = role('manager').permissions
    for (const forbidden of ['roles.manage', 'settings.manage', 'audit.view', 'users.delete']) {
      expect(manager).not.toContain(forbidden)
    }
    // …while still running the catalogue and the community.
    for (const allowed of ['books.publish', 'articles.publish', 'reviews.moderate', 'feedback.respond', 'coupons.create']) {
      expect(manager).toContain(allowed)
    }
  })

  it('limits authors to their own content and their own coupons', () => {
    const author = role('author')
    expect(author.scope).toBe('own')
    expect(author.permissions).toContain('author.coupons.create')
    expect(author.permissions).toContain('own_content.publish')
    // The rules that make "an author cannot touch another author's campaign" hold:
    for (const forbidden of ['coupons.global.manage', 'coupons.create', 'users.view', 'roles.manage', 'settings.manage', 'analytics.view']) {
      expect(author.permissions).not.toContain(forbidden)
    }
  })

  it('gives a plain member no CMS access at all', () => {
    expect(role('user').permissions).toHaveLength(0)
  })

  it('ranks roles so the primary role is unambiguous', () => {
    const ranks = SYSTEM_ROLES.map((r) => r.rank)
    expect(new Set(ranks).size).toBe(ranks.length)
    expect(role('admin').rank).toBeGreaterThan(role('manager').rank)
    expect(role('manager').rank).toBeGreaterThan(role('author').rank)
    expect(role('author').rank).toBeGreaterThan(role('user').rank)
  })
})

describe('actorCan', () => {
  it('requires every listed permission', () => {
    const a = actor(['books.view', 'books.edit'])
    expect(actorCan(a, 'books.view')).toBe(true)
    expect(actorCan(a, 'books.view', 'books.edit')).toBe(true)
    expect(actorCan(a, 'books.view', 'books.delete')).toBe(false)
  })

  it('accepts any of the listed permissions', () => {
    const a = actor(['own_content.manage'])
    expect(actorCanAny(a, 'books.edit', 'own_content.manage')).toBe(true)
    expect(actorCanAny(a, 'books.edit', 'articles.edit')).toBe(false)
  })
})

describe('normaliseRoleKey', () => {
  it('produces a safe lowercase identifier', () => {
    expect(normaliseRoleKey('  Audio Editor ')).toBe('audio-editor')
    expect(normaliseRoleKey('Ops/Support!')).toBe('ops-support')
    expect(normaliseRoleKey('---x---')).toBe('x')
  })

  it('caps the length at the column width', () => {
    expect(normaliseRoleKey('a'.repeat(200))).toHaveLength(64)
  })
})
