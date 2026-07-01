import { describe, it, expect, beforeEach } from 'vitest'
import axios from 'axios'
import { setClient, getClient } from '../client.js'

// ── Helpers ────────────────────────────────────────────────────────────────────
function makeTestClient(baseURL = 'http://localhost:4000/api') {
  return axios.create({ baseURL, timeout: 5000 })
}

// Reset the singleton before each test
beforeEach(() => {
  setClient(null as any)
})

describe('@loikmon/api — client', () => {

  describe('axios instance configuration', () => {
    it('creates instance with correct base URL', () => {
      const client = makeTestClient('http://test.local/api')
      expect(client.defaults.baseURL).toBe('http://test.local/api')
    })

    it('has a timeout set', () => {
      const client = makeTestClient()
      expect(client.defaults.timeout).toBeGreaterThan(0)
    })

    it('getClient() returns a singleton', () => {
      const a = getClient()
      const b = getClient()
      expect(a).toBe(b)
    })

    it('getClient() uses loikmon base URL by default', () => {
      const client = getClient()
      expect(client.defaults.baseURL).toBe('https://loikmon.org/webapis/')
    })
  })

  describe('request interceptor — CORS safe (text/plain, no custom headers)', () => {
    it('wraps POST body in { data: ... } envelope', () => {
      const client = getClient()
      const interceptor = (client.interceptors.request as any).handlers[0].fulfilled
      const config = {
        method: 'post',
        headers: {} as any,
        data: { page: '0', cat: 0 },
      } as any
      const result = interceptor(config)
      const parsed = JSON.parse(result.data)
      expect(parsed).toHaveProperty('data')
      expect(parsed.data).toEqual({ page: '0', cat: 0 })
    })

    it('sets Content-Type to text/plain on POST', () => {
      const client = getClient()
      const interceptor = (client.interceptors.request as any).handlers[0].fulfilled
      const config = { method: 'post', headers: {} as any, data: { q: 'test' } } as any
      const result = interceptor(config)
      expect(result.headers['Content-Type']).toBe('text/plain')
    })

    it('does NOT double-wrap when data already has { data: ... }', () => {
      const client = getClient()
      const interceptor = (client.interceptors.request as any).handlers[0].fulfilled
      const config = {
        method: 'post',
        headers: {} as any,
        data: { data: { page: '0' } },
      } as any
      const result = interceptor(config)
      const parsed = JSON.parse(result.data)
      // Should remain { data: { page: '0' } }, not { data: { data: { page: '0' } } }
      expect(parsed).toEqual({ data: { page: '0' } })
    })

    it('does NOT attach Authorization header — prevents CORS preflight', () => {
      // Critical: loikmon.org returns 404 on OPTIONS preflight.
      // Any custom header (e.g. Authorization) triggers a preflight → request blocked.
      // Auth is done via email in the POST body, not via headers.
      const client = getClient()
      const interceptor = (client.interceptors.request as any).handlers[0].fulfilled
      const config = { method: 'post', headers: {} as any, data: { email: 'u@test.com' } } as any
      const result = interceptor(config)
      expect(result.headers['Authorization']).toBeUndefined()
    })

    it('does not modify GET requests', () => {
      const client = getClient()
      const interceptor = (client.interceptors.request as any).handlers[0].fulfilled
      const config = { method: 'get', headers: {} as any, data: undefined } as any
      const result = interceptor(config)
      expect(result.data).toBeUndefined()
      expect(result.headers['Content-Type']).toBeUndefined()
    })

    it('handles null data gracefully', () => {
      const client = getClient()
      const interceptor = (client.interceptors.request as any).handlers[0].fulfilled
      const config = { method: 'post', headers: {} as any, data: null } as any
      // data is null → interceptor should not wrap (data !== undefined is false)
      const result = interceptor(config)
      expect(result.data).toBeNull()
    })
  })

  describe('setClient / getClient swap', () => {
    it('accepts a custom axios instance (for testing)', () => {
      const custom = axios.create({ baseURL: 'http://mock-server/api' })
      setClient(custom)
      expect(getClient()).toBe(custom)
    })
  })
})
