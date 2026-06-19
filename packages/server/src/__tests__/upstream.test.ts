import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubEnv('LOIKMON_API_BASE', 'https://loikmon.org/webapis')

// ── vi.hoisted ensures these are initialised BEFORE vi.mock factory runs ──────
const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet:  vi.fn(),
  mockPost: vi.fn(),
}))

vi.mock('axios', () => ({
  default: { get: mockGet, post: mockPost },
}))

import { proxyGet, proxyPost } from '../middleware/upstream.js'
import type { Request, Response } from 'express'

function fakeReq(
  headers: Record<string, string> = {},
  query: Record<string, string> = {},
  body: unknown = {},
): Request {
  return { headers, query, body } as unknown as Request
}

function fakeRes() {
  const res: any = {
    _status: 200,
    _json: undefined,
    status(code: number) { this._status = code; return this },
    json(data: unknown) { this._json = data; return this },
  }
  return res
}

describe('BFF — upstream.ts proxyGet', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls the correct upstream URL', async () => {
    mockGet.mockResolvedValueOnce({ data: {} })
    await proxyGet(fakeReq(), fakeRes(), 'fetchbooks')
    expect(mockGet.mock.calls[0][0]).toBe('https://loikmon.org/webapis/fetchbooks')
  })

  it('passes req.query as axios params', async () => {
    mockGet.mockResolvedValueOnce({ data: {} })
    const req = fakeReq({}, { page: '2', category_id: '3' })
    const res = fakeRes()
    await proxyGet(req, res, 'fetchbooks')
    expect(mockGet.mock.calls[0][1].params).toMatchObject({ page: '2', category_id: '3' })
  })

  it('injects Authorization header when present on req', async () => {
    mockGet.mockResolvedValueOnce({ data: {} })
    const req = fakeReq({ authorization: 'Bearer test-token' })
    const res = fakeRes()
    await proxyGet(req, res, 'fetchbooks')
    expect(mockGet.mock.calls[0][1].headers['Authorization']).toBe('Bearer test-token')
  })

  it('does NOT inject Authorization when absent', async () => {
    mockGet.mockResolvedValueOnce({ data: {} })
    const req = fakeReq({})
    const res = fakeRes()
    await proxyGet(req, res, 'fetchbooks')
    expect(mockGet.mock.calls[0][1].headers['Authorization']).toBeUndefined()
  })

  it('returns upstream data via res.json', async () => {
    const upstream = { data: [{ id: 1, title: 'Mon Book' }] }
    mockGet.mockResolvedValueOnce({ data: upstream })
    const res = fakeRes()
    await proxyGet(fakeReq(), res, 'fetchbooks')
    expect(res._json).toEqual(upstream)
  })

  it('returns 502 + error message on generic network failure', async () => {
    mockGet.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const res = fakeRes()
    await proxyGet(fakeReq(), res, 'fetchbooks')
    expect(res._status).toBe(502)
    expect(res._json.error).toBe('ECONNREFUSED')
  })

  it('forwards upstream HTTP error status + data', async () => {
    mockGet.mockRejectedValueOnce({
      response: { status: 401, data: { message: 'Unauthenticated.' } },
      message: 'Request failed',
    })
    const res = fakeRes()
    await proxyGet(fakeReq(), res, 'fetchbooks')
    expect(res._status).toBe(401)
    expect(res._json.message).toBe('Unauthenticated.')
  })
})

describe('BFF — upstream.ts proxyPost', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls the correct upstream URL', async () => {
    mockPost.mockResolvedValueOnce({ data: {} })
    await proxyPost(fakeReq(), fakeRes(), 'loginapp')
    expect(mockPost.mock.calls[0][0]).toBe('https://loikmon.org/webapis/loginapp')
  })

  it('passes req.body as POST body', async () => {
    mockPost.mockResolvedValueOnce({ data: {} })
    const body = { email: 'test@test.com', password: 'secret' }
    const req = fakeReq({}, {}, body)
    const res = fakeRes()
    await proxyPost(req, res, 'loginapp')
    expect(mockPost.mock.calls[0][1]).toEqual(body)
  })

  it('always sets Content-Type: application/json', async () => {
    mockPost.mockResolvedValueOnce({ data: {} })
    const res = fakeRes()
    await proxyPost(fakeReq(), res, 'loginapp')
    expect(mockPost.mock.calls[0][2].headers['Content-Type']).toBe('application/json')
  })

  it('injects Authorization header on POST when present', async () => {
    mockPost.mockResolvedValueOnce({ data: {} })
    const req = fakeReq({ authorization: 'Bearer mytoken' })
    const res = fakeRes()
    await proxyPost(req, res, 'createaccount')
    expect(mockPost.mock.calls[0][2].headers['Authorization']).toBe('Bearer mytoken')
  })

  it('returns 502 on connection timeout', async () => {
    mockPost.mockRejectedValueOnce(new Error('ETIMEDOUT'))
    const res = fakeRes()
    await proxyPost(fakeReq(), res, 'loginapp')
    expect(res._status).toBe(502)
  })

  it('forwards upstream 422 validation errors', async () => {
    mockPost.mockRejectedValueOnce({
      response: { status: 422, data: { errors: { email: ['already taken'] } } },
      message: 'Unprocessable Entity',
    })
    const res = fakeRes()
    await proxyPost(fakeReq(), res, 'createaccount')
    expect(res._status).toBe(422)
    expect(res._json.errors.email[0]).toBe('already taken')
  })
})
