/**
 * Server authors routes — unit tests
 * Covers all routes added/changed in the sync (followunfollow, editArtistApp etc.)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

// Mock upstream proxy helpers
const mockProxyGet  = vi.fn((_req: any, res: any) => res.json({ ok: true }))
const mockProxyPost = vi.fn((_req: any, res: any) => res.json({ ok: true }))

vi.mock('../middleware/upstream.js', () => ({
  proxyGet:  (...a: any[]) => mockProxyGet(...a),
  proxyPost: (...a: any[]) => mockProxyPost(...a),
}))

import authorsRouter from '../routes/authors.js'
import articlesRouter from '../routes/articles.js'

function buildApp(router: any) {
  const app = express()
  app.use(express.json())
  app.use('/', router)
  return app
}

describe('server authors routes', () => {
  beforeEach(() => vi.clearAllMocks())

  const authorsApp = buildApp(authorsRouter)

  const postRoutes = [
    '/fetchauthors',
    '/get_author_data',
    '/follow_unfollow_author',
    '/followunfollow',
    '/editArtistApp',
  ]

  const getRoutes = [
    '/fetchauthors',
    '/getauthor',
    '/get_author_data',
    '/fetchauthorcategories',
    '/fetch_author_inbox',
    '/artistdashboard',
    '/artistfilterdashboard',
  ]

  for (const route of postRoutes) {
    it(`POST ${route} → 200`, async () => {
      const res = await request(authorsApp).post(route).send({})
      expect(res.status).toBe(200)
      expect(mockProxyPost).toHaveBeenCalled()
    })
  }

  for (const route of getRoutes) {
    it(`GET ${route} → 200`, async () => {
      const res = await request(authorsApp).get(route)
      expect(res.status).toBe(200)
      expect(mockProxyGet).toHaveBeenCalled()
    })
  }
})

describe('server articles routes', () => {
  beforeEach(() => vi.clearAllMocks())

  const articlesApp = buildApp(articlesRouter)

  it('GET /fetcharticles → 200', async () => {
    const res = await request(articlesApp).get('/fetcharticles')
    expect(res.status).toBe(200)
  })

  it('POST /fetcharticles → 200', async () => {
    const res = await request(articlesApp).post('/fetcharticles').send({})
    expect(res.status).toBe(200)
  })

  it('POST /purchasearticle → 200', async () => {
    const res = await request(articlesApp).post('/purchasearticle').send({})
    expect(res.status).toBe(200)
  })

  it('POST /update_article_total_views → 200', async () => {
    const res = await request(articlesApp).post('/update_article_total_views').send({})
    expect(res.status).toBe(200)
  })
})
