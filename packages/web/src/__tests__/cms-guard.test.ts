/**
 * The CMS route guard: authentication, CMS access, and per-route permissions.
 *
 * The guard is a convenience for the operator — every endpoint re-checks the
 * same permissions — but it must never send somebody to a page they cannot use.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { defineComponent, h } from 'vue'
import { makeUser, response } from './helpers'
import type { CmsSession } from '@loikmon/api'
import { CMS_NAV, ROUTE_PERMISSIONS, firstAllowedRoute } from '../cms/navigation'

const mockMe = vi.fn()

vi.mock('@loikmon/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@loikmon/api')>()
  return { ...actual, cms: { me: (...a: unknown[]) => mockMe(...a) } }
})

import { useCmsSessionStore } from '../cms/stores/session'
import { useAuthStore } from '../stores/auth'

const Blank = defineComponent({ render: () => h('div') })

function session(permissions: string[], canAccess = permissions.length > 0): CmsSession {
  return {
    status: 'ok',
    can_access: canAccess,
    user: { id: 'u1', email: 'staff@loikmon.org', primary_role: 'manager' },
    roles: [],
    scope: 'all',
    permissions,
    author_profiles: [],
    permission_groups: [],
  }
}

/** A miniature router carrying the same guard logic as `router/index.ts`. */
async function makeRouter() {
  const routes: RouteRecordRaw[] = [
    { path: '/', name: 'home', component: Blank },
    { path: '/auth', name: 'auth', component: Blank },
    {
      path: '/cms',
      component: Blank,
      meta: { requiresAuth: true, requiresCms: true },
      children: CMS_NAV.flatMap((section) =>
        section.items.map((item) => ({
          path: item.name === 'cms-dashboard' ? '' : item.name.replace('cms-', ''),
          name: item.name,
          component: Blank,
          meta: { permissions: ROUTE_PERMISSIONS[item.name], requiresCms: true },
        })),
      ),
    },
  ]

  const router = createRouter({ history: createMemoryHistory(), routes })

  router.beforeEach(async (to) => {
    const needsAuth = to.matched.some((r) => r.meta?.requiresAuth)
    const needsCms = to.matched.some((r) => r.meta?.requiresCms)
    if (!needsAuth && !needsCms) return

    const auth = useAuthStore()
    await auth.ensureRestored()
    if (!auth.isLoggedIn) return { name: 'auth', query: { redirect: to.fullPath } }
    if (!needsCms) return

    const cms = useCmsSessionStore()
    await cms.ensureLoaded()
    if (!cms.canAccess) return { name: 'home' }

    const required = (to.meta?.permissions as string[] | undefined) ?? []
    if (required.length && !cms.canAny(...required)) {
      const fallback = firstAllowedRoute((...p) => cms.canAny(...p))
      return fallback && fallback !== to.name ? { name: fallback } : { name: 'home' }
    }
  })

  await router.push('/')
  await router.isReady()
  return router
}

/** The store validates a stored token on its own; here we hand it a live one. */
function signIn() {
  const auth = useAuthStore()
  auth.token = 'token-1'
  auth.user = makeUser({ id: 'u1', email: 'staff@loikmon.org' })
  auth.restored = true
}

describe('CMS route guard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockMe.mockReset()
  })

  it('sends a signed-out visitor to sign in, remembering where they were going', async () => {
    const router = await makeRouter()
    await router.push('/cms/books')
    expect(router.currentRoute.value.name).toBe('auth')
    expect(router.currentRoute.value.query.redirect).toBe('/cms/books')
  })

  it('sends a reader with no CMS access back to the storefront', async () => {
    mockMe.mockResolvedValue(response(session([], false)))
    const router = await makeRouter()
    signIn()

    await router.push('/cms/books')

    expect(router.currentRoute.value.name).toBe('home')
  })

  it('lets a manager into a section they hold the permission for', async () => {
    mockMe.mockResolvedValue(response(session(['books.view', 'articles.view'])))
    const router = await makeRouter()
    signIn()

    await router.push('/cms/books')

    expect(router.currentRoute.value.name).toBe('cms-books')
  })

  it('redirects to the first usable section instead of showing a dead end', async () => {
    // A reviews-only moderator asking for the users page.
    mockMe.mockResolvedValue(response(session(['reviews.view'])))
    const router = await makeRouter()
    signIn()

    await router.push('/cms/users')

    expect(router.currentRoute.value.name).toBe('cms-reviews')
  })

  it('lets an author reach the dashboard through the own-content permission', async () => {
    mockMe.mockResolvedValue(response(session(['analytics.own.view', 'books.view'])))
    const router = await makeRouter()
    signIn()

    await router.push('/cms')

    expect(router.currentRoute.value.name).toBe('cms-dashboard')
  })
})

describe('navigation config', () => {
  it('maps every menu entry to at least one permission', () => {
    for (const section of CMS_NAV) {
      for (const item of section.items) {
        expect(item.permissions.length).toBeGreaterThan(0)
        expect(ROUTE_PERMISSIONS[item.name]).toEqual(item.permissions)
      }
    }
  })

  it('uses unique route names', () => {
    const names = CMS_NAV.flatMap((s) => s.items.map((i) => i.name))
    expect(new Set(names).size).toBe(names.length)
  })

  it('returns null when nothing is reachable', () => {
    expect(firstAllowedRoute(() => false)).toBeNull()
  })

  it('prefers the dashboard when everything is reachable', () => {
    expect(firstAllowedRoute(() => true)).toBe('cms-dashboard')
  })
})
