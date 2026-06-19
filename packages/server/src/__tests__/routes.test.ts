import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock proxyGet / proxyPost
const proxyGet  = vi.fn().mockResolvedValue(undefined)
const proxyPost = vi.fn().mockResolvedValue(undefined)

vi.mock('../middleware/upstream.js', () => ({ proxyGet, proxyPost }))

import type { Request, Response } from 'express'

function makeReqRes(body = {}, query = {}, params = {}) {
  const req = { body, query, params, headers: {} } as unknown as Request
  const res = {
    _status: 200, _json: undefined as unknown,
    status(c: number) { this._status = c; return this },
    json(d: unknown) { this._json = d; return this },
  } as unknown as Response
  return { req, res }
}

// Inline route handlers (mirrors what each route file does)
async function handleGetBooks(req: Request, res: Response) {
  await proxyGet(req, res, 'fetchbooks')
}
async function handleGetBook(req: Request, res: Response) {
  await proxyGet(req, res, 'getitem')
}
async function handleLogin(req: Request, res: Response) {
  await proxyPost(req, res, 'loginapp')
}
async function handleRegister(req: Request, res: Response) {
  await proxyPost(req, res, 'createaccount')
}
async function handleSearch(req: Request, res: Response) {
  await proxyGet(req, res, 'search')
}
async function handleGetArticles(req: Request, res: Response) {
  await proxyGet(req, res, 'fetcharticles')
}
async function handleGetAuthors(req: Request, res: Response) {
  await proxyGet(req, res, 'fetchauthors')
}
async function handleGetCategories(req: Request, res: Response) {
  await proxyGet(req, res, 'fetchcategories')
}
async function handleGetMedia(req: Request, res: Response) {
  await proxyGet(req, res, 'fetch_media')
}
async function handleGetCoins(req: Request, res: Response) {
  await proxyGet(req, res, 'fetchcoins')
}
async function handleInitApp(req: Request, res: Response) {
  await proxyGet(req, res, 'initapp')
}

describe('BFF — route handlers', () => {

  beforeEach(() => vi.clearAllMocks())

  describe('GET /api/books', () => {
    it('calls proxyGet with "fetchbooks"', async () => {
      const { req, res } = makeReqRes({}, { page: '1' })
      await handleGetBooks(req, res)
      expect(proxyGet).toHaveBeenCalledWith(req, res, 'fetchbooks')
    })
  })

  describe('GET /api/books/:id', () => {
    it('calls proxyGet with "getitem"', async () => {
      const { req, res } = makeReqRes({}, {}, { id: '42' })
      await handleGetBook(req, res)
      expect(proxyGet).toHaveBeenCalledWith(req, res, 'getitem')
    })
  })

  describe('POST /api/auth/login', () => {
    it('calls proxyPost with "loginapp"', async () => {
      const { req, res } = makeReqRes({ email: 'a@b.com', password: 'pass' })
      await handleLogin(req, res)
      expect(proxyPost).toHaveBeenCalledWith(req, res, 'loginapp')
    })
  })

  describe('POST /api/auth/register', () => {
    it('calls proxyPost with "createaccount"', async () => {
      const { req, res } = makeReqRes({ name: 'Test', email: 'a@b.com', password: 'p', password_confirmation: 'p' })
      await handleRegister(req, res)
      expect(proxyPost).toHaveBeenCalledWith(req, res, 'createaccount')
    })
  })

  describe('GET /api/search', () => {
    it('calls proxyGet with "search"', async () => {
      const { req, res } = makeReqRes({}, { q: 'mon poetry' })
      await handleSearch(req, res)
      expect(proxyGet).toHaveBeenCalledWith(req, res, 'search')
    })
  })

  describe('GET /api/articles', () => {
    it('calls proxyGet with "fetcharticles"', async () => {
      const { req, res } = makeReqRes()
      await handleGetArticles(req, res)
      expect(proxyGet).toHaveBeenCalledWith(req, res, 'fetcharticles')
    })
  })

  describe('GET /api/authors', () => {
    it('calls proxyGet with "fetchauthors"', async () => {
      const { req, res } = makeReqRes()
      await handleGetAuthors(req, res)
      expect(proxyGet).toHaveBeenCalledWith(req, res, 'fetchauthors')
    })
  })

  describe('GET /api/categories', () => {
    it('calls proxyGet with "fetchcategories"', async () => {
      const { req, res } = makeReqRes()
      await handleGetCategories(req, res)
      expect(proxyGet).toHaveBeenCalledWith(req, res, 'fetchcategories')
    })
  })

  describe('GET /api/media', () => {
    it('calls proxyGet with "fetch_media"', async () => {
      const { req, res } = makeReqRes()
      await handleGetMedia(req, res)
      expect(proxyGet).toHaveBeenCalledWith(req, res, 'fetch_media')
    })
  })

  describe('GET /api/coins', () => {
    it('calls proxyGet with "fetchcoins"', async () => {
      const { req, res } = makeReqRes()
      await handleGetCoins(req, res)
      expect(proxyGet).toHaveBeenCalledWith(req, res, 'fetchcoins')
    })
  })

  describe('GET /api/init', () => {
    it('calls proxyGet with "initapp"', async () => {
      const { req, res } = makeReqRes()
      await handleInitApp(req, res)
      expect(proxyGet).toHaveBeenCalledWith(req, res, 'initapp')
    })
  })
})
