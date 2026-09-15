import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { ApiError, configureClient, errorCode, errorMessage, getClient, isApiError, setClient } from '../client.js'

/** Axios adapter that records requests and replies with the given response. */
function adapter(reply: (config: InternalAxiosRequestConfig) => { status: number; data: unknown; headers?: Record<string, string> } | Error) {
  const calls: InternalAxiosRequestConfig[] = []
  const fn: AxiosAdapter = async (config) => {
    calls.push(config)
    const result = reply(config)
    if (result instanceof Error) throw Object.assign(result, { config, isAxiosError: true, toJSON: () => ({}) })
    const response = { data: result.data, status: result.status, statusText: '', headers: result.headers ?? {}, config }
    if (result.status >= 400) {
      const error = Object.assign(new Error(`Request failed with status code ${result.status}`), { config, response, isAxiosError: true, toJSON: () => ({}) })
      throw error
    }
    return response
  }
  return { fn, calls }
}

afterEach(() => setClient(null))

describe('client', () => {
  it('defaults to /api/v1 and attaches the bearer token from the provider', async () => {
    const client = configureClient({ getToken: () => 'tok-123' })
    const { fn, calls } = adapter(() => ({ status: 200, data: { status: 'ok' } }))
    client.defaults.adapter = fn
    await client.get('books')
    expect(calls[0]!.baseURL).toBe('/api/v1')
    expect(calls[0]!.headers.get('Authorization')).toBe('Bearer tok-123')
  })

  it('supports async token providers and anonymous requests', async () => {
    const client = configureClient({ baseURL: 'https://api.loikmon.org/api/v1', getToken: async () => null })
    const { fn, calls } = adapter(() => ({ status: 200, data: {} }))
    client.defaults.adapter = fn
    await client.get('home')
    expect(calls[0]!.headers.get('Authorization')).toBeFalsy()
    expect(calls[0]!.baseURL).toBe('https://api.loikmon.org/api/v1')
  })

  it('normalises backend errors into ApiError with code and request id', async () => {
    const client = configureClient({})
    client.defaults.adapter = adapter(() => ({
      status: 403,
      data: { status: 'error', code: 'SUBSCRIPTION_REQUIRED', message: 'An active subscription is required', request_id: 'req-1' },
    })).fn
    const err = await client.get('books/1/file').catch((e: unknown) => e)
    expect(isApiError(err)).toBe(true)
    expect(err).toMatchObject({ status: 403, code: 'SUBSCRIPTION_REQUIRED', requestId: 'req-1' })
    expect(errorCode(err)).toBe('SUBSCRIPTION_REQUIRED')
    expect(errorMessage(err)).toBe('An active subscription is required')
  })

  it('reports network failures distinctly', async () => {
    const client = configureClient({})
    client.defaults.adapter = adapter(() => new Error('socket hang up')).fn
    const err = (await client.get('home').catch((e: unknown) => e)) as ApiError
    expect(err.code).toBe('NETWORK_ERROR')
    expect(err.isNetworkError).toBe(true)
  })

  it('calls onUnauthorized only when a token was sent', async () => {
    const onUnauthorized = vi.fn()
    let token: string | null = 'expired'
    const client = configureClient({ getToken: () => token, onUnauthorized })
    client.defaults.adapter = adapter(() => ({ status: 401, data: { status: 'error', code: 'UNAUTHORIZED', message: 'Authentication required' } })).fn

    await client.get('auth/me').catch(() => {})
    expect(onUnauthorized).toHaveBeenCalledTimes(1)

    token = null
    await client.post('auth/login', { email: 'a', password: 'b' }).catch(() => {})
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('keeps the session on 401s that are not about the session (wrong current password)', async () => {
    const onUnauthorized = vi.fn()
    const client = configureClient({ getToken: () => 'valid', onUnauthorized })
    client.defaults.adapter = adapter(() => ({ status: 401, data: { status: 'error', code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } })).fn
    const err = await client.post('auth/password/change', {}).catch((e: unknown) => e)
    expect(errorCode(err)).toBe('INVALID_CREDENTIALS')
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('getClient lazily creates a singleton', () => {
    const a = getClient('/custom/api')
    expect(getClient()).toBe(a)
    expect(a.defaults.baseURL).toBe('/custom/api')
  })
})
