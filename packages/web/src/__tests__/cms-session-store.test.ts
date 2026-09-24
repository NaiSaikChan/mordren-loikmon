/**
 * CMS session store — the permission set the whole admin UI branches on.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { apiError, response } from './helpers'
import type { CmsSession } from '@loikmon/api'

const mockMe = vi.fn()

vi.mock('@loikmon/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@loikmon/api')>()
  return { ...actual, cms: { me: (...a: unknown[]) => mockMe(...a) } }
})

import { useCmsSessionStore } from '../cms/stores/session'

function session(overrides: Partial<CmsSession> = {}): CmsSession {
  return {
    status: 'ok',
    can_access: true,
    user: { id: 'u1', email: 'manager@loikmon.org', primary_role: 'manager' },
    roles: [{ id: 2, role_key: 'manager', name: 'Manager', scope: 'all' }],
    scope: 'all',
    permissions: ['books.view', 'books.edit', 'articles.view'],
    author_profiles: [],
    permission_groups: [],
    ...overrides,
  }
}

describe('CMS session store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockMe.mockReset()
  })

  it('loads the permission set once and reuses it', async () => {
    mockMe.mockResolvedValue(response(session()))
    const store = useCmsSessionStore()

    await store.load()
    await store.load()

    expect(mockMe).toHaveBeenCalledTimes(1)
    expect(store.canAccess).toBe(true)
    expect(store.primaryRole).toBe('manager')
  })

  it('coalesces concurrent loads into one request', async () => {
    mockMe.mockResolvedValue(response(session()))
    const store = useCmsSessionStore()

    await Promise.all([store.load(), store.load(), store.ensureLoaded()])

    expect(mockMe).toHaveBeenCalledTimes(1)
  })

  it('refetches when forced, so a role change takes effect immediately', async () => {
    mockMe.mockResolvedValue(response(session()))
    const store = useCmsSessionStore()
    await store.load()

    mockMe.mockResolvedValue(
      response(
        session({
          permissions: ['books.view'],
          scope: 'own',
          user: { id: 'u1', email: 'author@loikmon.org', primary_role: 'author' },
        }),
      ),
    )
    await store.load(true)

    expect(mockMe).toHaveBeenCalledTimes(2)
    expect(store.can('books.edit')).toBe(false)
    expect(store.isOwnScope).toBe(true)
  })

  it('requires every permission for can(), any for canAny()', async () => {
    mockMe.mockResolvedValue(response(session()))
    const store = useCmsSessionStore()
    await store.load()

    expect(store.can('books.view')).toBe(true)
    expect(store.can('books.view', 'books.edit')).toBe(true)
    expect(store.can('books.view', 'books.delete')).toBe(false)
    expect(store.canAny('books.delete', 'articles.view')).toBe(true)
    expect(store.canAny('books.delete', 'users.view')).toBe(false)
  })

  it('treats 403 as "no CMS for this account" rather than an error to show', async () => {
    mockMe.mockRejectedValue(apiError(403, 'FORBIDDEN'))
    const store = useCmsSessionStore()

    await store.load()

    expect(store.canAccess).toBe(false)
    expect(store.error).toBeNull()
    expect(store.loaded).toBe(true)
  })

  it('surfaces a real failure so the operator knows the CMS is unreachable', async () => {
    mockMe.mockRejectedValue(apiError(0, 'NETWORK_ERROR', 'Cannot reach the server'))
    const store = useCmsSessionStore()

    await store.load()

    expect(store.canAccess).toBe(false)
    expect(store.error).toBe('Cannot reach the server')
  })

  it('exposes the author profiles that define the own-content scope', async () => {
    mockMe.mockResolvedValue(
      response(session({ scope: 'own', author_profiles: [{ id: 5, name: 'Alice Mon' }], permissions: ['own_content.manage'] })),
    )
    const store = useCmsSessionStore()
    await store.load()

    expect(store.isOwnScope).toBe(true)
    expect(store.authorProfiles).toEqual([{ id: 5, name: 'Alice Mon' }])
  })

  it('forgets everything on reset, so signing out clears the menu', async () => {
    mockMe.mockResolvedValue(response(session()))
    const store = useCmsSessionStore()
    await store.load()

    store.reset()

    expect(store.canAccess).toBe(false)
    expect(store.loaded).toBe(false)
    expect(store.can('books.view')).toBe(false)
  })
})
