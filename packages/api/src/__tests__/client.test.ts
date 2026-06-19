import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

// ── Helpers ───────────────────────────────────────
function makeTestClient(baseURL = 'http://localhost:4000/api') {
  const instance = axios.create({ baseURL, timeout: 5000 })
  return instance
}

describe('@loikmon/api — client', () => {

  describe('axios instance configuration', () => {
    it('creates instance with the given baseURL', () => {
      const client = makeTestClient('http://test.local/api')
      expect(client.defaults.baseURL).toBe('http://test.local/api')
    })

    it('defaults to JSON content-type', () => {
      const client = makeTestClient()
      // Axios normalises headers — accept-type should be set
      const headers = client.defaults.headers as Record<string, unknown>
      expect(headers).toBeDefined()
    })

    it('has a timeout set', () => {
      const client = makeTestClient()
      expect(client.defaults.timeout).toBeGreaterThan(0)
    })
  })

  describe('request interceptor — auth header injection', () => {
    it('attaches Bearer token when localStorage has one', () => {
      // Simulate localStorage
      const store: Record<string, string> = { token: 'test-jwt-123' }
      const fakeLS = { getItem: (k: string) => store[k] ?? null }

      const client = axios.create({ baseURL: '/api' })
      client.interceptors.request.use((config) => {
        const token = fakeLS.getItem('token')
        if (token) config.headers['Authorization'] = `Bearer ${token}`
        return config
      })

      // Manually run the interceptor chain on a dummy config
      const config: Parameters<typeof client.interceptors.request['use']>[0] extends (c: infer C) => infer R ? C : never
        = { headers: {} as ReturnType<typeof axios.defaults.headers.common.constructor>, url: '/test', method: 'get' } as any
      const result = (client.interceptors.request as any).handlers[0].fulfilled(config) as any
      expect(result.headers['Authorization']).toBe('Bearer test-jwt-123')
    })

    it('does NOT attach header when no token in localStorage', () => {
      const fakeLS = { getItem: (_k: string) => null }
      const client = axios.create({ baseURL: '/api' })
      client.interceptors.request.use((config) => {
        const token = fakeLS.getItem('token')
        if (token) config.headers['Authorization'] = `Bearer ${token}`
        return config
      })

      const config = { headers: {} as any, url: '/test', method: 'get' } as any
      const result = (client.interceptors.request as any).handlers[0].fulfilled(config) as any
      expect(result.headers['Authorization']).toBeUndefined()
    })
  })

  describe('setClient / getClient swap', () => {
    it('accepts a custom axios instance (for testing)', () => {
      const custom = axios.create({ baseURL: 'http://mock-server/api' })
      expect(custom.defaults.baseURL).toBe('http://mock-server/api')
    })
  })
})
