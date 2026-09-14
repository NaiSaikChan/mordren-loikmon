import { describe, it, expect, vi } from 'vitest'

// Avoid real infra during route test.
vi.mock('../database/pool.js', () => ({
  pingDatabase: vi.fn().mockResolvedValue(true),
  pool: {},
  query: vi.fn(),
  queryOne: vi.fn(),
}))
vi.mock('../services/storageService.js', () => ({
  pingStorage: vi.fn().mockResolvedValue(true),
  ensureBuckets: vi.fn(),
  getSignedUrl: vi.fn(),
  getPublicUrl: vi.fn(),
}))

const request = (await import('supertest')).default
const { createApp } = await import('../app.js')

describe('health + plans endpoints', () => {
  const app = createApp()

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })

  it('GET /health/ready reports readiness', async () => {
    const res = await request(app).get('/health/ready')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ready')
  })

  it('GET /api/subscriptions/plans returns 4 plans', async () => {
    const res = await request(app).get('/api/subscriptions/plans')
    expect(res.status).toBe(200)
    expect(res.body.plans).toHaveLength(4)
    expect(res.body.plans[0].code).toBe('monthly')
  })

  it('unknown route returns 404 envelope', async () => {
    const res = await request(app).get('/api/does-not-exist')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('not_found')
  })

  it('protected content requires auth', async () => {
    const res = await request(app).get('/api/content/book/demo-book-1/url')
    expect(res.status).toBe(401)
  })
})
