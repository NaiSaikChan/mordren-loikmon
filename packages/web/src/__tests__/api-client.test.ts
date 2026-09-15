/**
 * API bootstrap — the real @loikmon/api client configured by `installApiClient`:
 * bearer token from the auth store, and 401 → session cleared.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { auth as authApi, books as booksApi, getClient, setClient } from '@loikmon/api'
import { installApiClient } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { createTestRouter, makeUser } from './helpers'

type Reply = { status: number; data: unknown }

/** Replace the HTTP transport: records requests and answers with `reply`. */
function stubTransport(reply: (config: InternalAxiosRequestConfig) => Reply) {
  const seen: InternalAxiosRequestConfig[] = []
  getClient().defaults.adapter = async (config) => {
    seen.push(config)
    const { status, data } = reply(config)
    const res = { data, status, statusText: String(status), headers: {}, config }
    if (status >= 400) {
      throw new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', config, null, res)
    }
    return res
  }
  return seen
}

describe('installApiClient', () => {
  beforeEach(() => {
    localStorage.clear()
    setClient(null)
  })

  afterEach(() => setClient(null))

  it('uses /api/v1 and sends the bearer token from the auth store', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    installApiClient({ pinia })
    const store = useAuthStore(pinia)
    store.token = 'tok-abc'

    const seen = stubTransport(() => ({ status: 200, data: { status: 'ok', book: {} } }))
    await booksApi.getBook(1)

    expect(getClient().defaults.baseURL).toBe('/api/v1')
    expect(seen[0].url).toBe('books/1')
    expect(AxiosHeaders.from(seen[0].headers).get('Authorization')).toBe('Bearer tok-abc')
  })

  it('sends no Authorization header when signed out', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    installApiClient({ pinia })

    const seen = stubTransport(() => ({ status: 200, data: { status: 'ok', books: [] } }))
    await booksApi.fetchBooks({ page: 1 })

    expect(AxiosHeaders.from(seen[0].headers).has('Authorization')).toBe(false)
  })

  it('clears the session when an authenticated request gets 401', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    installApiClient({ pinia })
    localStorage.setItem('token', 'tok-revoked')
    const store = useAuthStore(pinia)
    store.user = makeUser()

    stubTransport(() => ({ status: 401, data: { status: 'error', code: 'UNAUTHORIZED', message: 'Authentication required' } }))

    await expect(authApi.me()).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' })
    expect(store.token).toBeNull()
    expect(store.user).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('sends the user to sign in when the 401 happens on a protected page', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = await createTestRouter('/', [
      { path: '/library', name: 'library', component: { render: () => null }, meta: { requiresAuth: true } },
    ])
    await router.push('/library')
    installApiClient({ pinia, router })
    useAuthStore(pinia).token = 'tok-revoked'

    stubTransport(() => ({ status: 401, data: { status: 'error', code: 'UNAUTHORIZED', message: 'Authentication required' } }))
    await authApi.me().catch(() => undefined)
    await new Promise((r) => setTimeout(r, 0))

    expect(router.currentRoute.value.name).toBe('auth')
    expect(router.currentRoute.value.query.redirect).toBe('/library')
  })

  it('does not clear the session for LOGIN_REQUIRED on anonymous requests', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    installApiClient({ pinia })

    stubTransport(() => ({ status: 401, data: { status: 'error', code: 'LOGIN_REQUIRED', message: 'Sign in to access this content' } }))
    await expect(booksApi.getFileUrl(1, 'epub')).rejects.toMatchObject({ code: 'LOGIN_REQUIRED' })
    expect(useAuthStore(pinia).restored).toBe(true)
  })
})
