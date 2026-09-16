import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bearer, createTestApp, hasTestDatabase, registerUser, type TestApp } from '../helpers/testApp.js'

/**
 * The coupon ownership model, exercised through the API.
 *
 * The rules under test are the ones the specification calls out: an author may
 * generate coupons for their own books and articles, may not touch another
 * author's campaigns, and may not create global or subscription campaigns.
 */
describe.skipIf(!hasTestDatabase)('CMS coupons & ownership (MySQL)', () => {
  let t: TestApp
  let admin: string
  let alice: string
  let bob: string
  const ids = { aliceAuthor: 0, bobAuthor: 0, aliceBook: 0, bobBook: 0, aliceCoupon: 0, globalCoupon: 0 }

  beforeAll(async () => {
    t = await createTestApp({ database: 'loikmon_test_cms_coupons' })
    ;({ token: admin } = await registerUser(t.app, 'admin@loikmon.test'))
    const aliceUser = await registerUser(t.app, 'alice@example.com')
    const bobUser = await registerUser(t.app, 'bob@example.com')
    alice = aliceUser.token
    bob = bobUser.token

    const roles = await request(t.app).get('/api/v1/cms/roles').set(bearer(admin))
    const authorRole = roles.body.roles.find((r: { role_key: string }) => r.role_key === 'author')

    const makeAuthor = async (name: string, userId: string) => {
      const res = await request(t.app).post('/api/v1/cms/authors').set(bearer(admin)).send({ name, user_id: userId })
      await request(t.app).put(`/api/v1/cms/users/${userId}/roles`).set(bearer(admin)).send({ role_ids: [authorRole.id] })
      return res.body.author.id as number
    }
    ids.aliceAuthor = await makeAuthor('Alice', aliceUser.user.id)
    ids.bobAuthor = await makeAuthor('Bob', bobUser.user.id)

    const book = async (token: string, title: string, authorId: number) => {
      const res = await request(t.app).post('/api/v1/cms/books').set(bearer(token)).send({ title, author_id: authorId, status: 'published' })
      expect(res.status).toBe(201)
      return res.body.book.id as number
    }
    ids.aliceBook = await book(alice, 'Alice book', ids.aliceAuthor)
    ids.bobBook = await book(bob, 'Bob book', ids.bobAuthor)
  })
  afterAll(async () => t?.close())

  it('lets an author create a campaign for their own book', async () => {
    const res = await request(t.app)
      .post('/api/v1/cms/coupons')
      .set(bearer(alice))
      .send({
        name: 'Alice launch',
        scope: 'book',
        book_id: ids.aliceBook,
        discount_type: 'percent',
        discount_value: 20,
        usage_limit: 2,
        usage_limit_per_user: 1,
        status: 'active',
      })
    expect(res.status).toBe(201)
    expect(res.body.coupon).toMatchObject({ scope: 'book', author_id: ids.aliceAuthor, discount_value: 20, status: 'active' })
    expect(res.body.coupon.code).toMatch(/^[A-Z0-9-]+$/)
    ids.aliceCoupon = res.body.coupon.id
  })

  it('refuses an author a campaign on somebody else"s book', async () => {
    const res = await request(t.app)
      .post('/api/v1/cms/coupons')
      .set(bearer(alice))
      .send({ name: 'Nope', scope: 'book', book_id: ids.bobBook, discount_type: 'percent', discount_value: 10 })
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('OWNERSHIP_REQUIRED')
  })

  it('refuses an author a platform-wide or subscription campaign', async () => {
    for (const scope of ['global', 'subscription']) {
      const res = await request(t.app)
        .post('/api/v1/cms/coupons')
        .set(bearer(alice))
        .send({ name: `Nope ${scope}`, scope, discount_type: 'percent', discount_value: 10 })
      expect(res.status).toBe(403)
      expect(res.body.details.required).toContain('coupons.global.manage')
    }
  })

  it('lets an administrator create a subscription campaign', async () => {
    const res = await request(t.app)
      .post('/api/v1/cms/coupons')
      .set(bearer(admin))
      .send({
        code: 'WELCOME50',
        name: 'Welcome offer',
        scope: 'subscription',
        plan_code: 'monthly',
        discount_type: 'percent',
        discount_value: 50,
        status: 'active',
      })
    expect(res.status).toBe(201)
    expect(res.body.coupon).toMatchObject({ code: 'WELCOME50', scope: 'subscription', plan_code: 'monthly', author_id: null })
    ids.globalCoupon = res.body.coupon.id
  })

  it('shows an author only their own campaigns', async () => {
    const mine = await request(t.app).get('/api/v1/cms/coupons').set(bearer(alice))
    expect(mine.status).toBe(200)
    expect(mine.body.coupons.map((c: { id: number }) => c.id)).toEqual([ids.aliceCoupon])

    const all = await request(t.app).get('/api/v1/cms/coupons').set(bearer(admin))
    expect(all.body.coupons.length).toBe(2)
  })

  it('refuses an author access to another author"s campaign', async () => {
    expect((await request(t.app).get(`/api/v1/cms/coupons/${ids.aliceCoupon}`).set(bearer(bob))).status).toBe(403)
    expect((await request(t.app).patch(`/api/v1/cms/coupons/${ids.aliceCoupon}`).set(bearer(bob)).send({ name: 'Stolen' })).status).toBe(403)
    expect((await request(t.app).delete(`/api/v1/cms/coupons/${ids.aliceCoupon}`).set(bearer(bob))).status).toBe(403)
  })

  it('refuses an author the platform-wide campaign analytics', async () => {
    const res = await request(t.app).get(`/api/v1/cms/coupons/${ids.globalCoupon}/performance`).set(bearer(alice))
    expect(res.status).toBe(403)
  })

  it('validates a code against a hypothetical order', async () => {
    const detail = await request(t.app).get(`/api/v1/cms/coupons/${ids.aliceCoupon}`).set(bearer(alice))
    const code = detail.body.coupon.code

    const ok = await request(t.app)
      .post('/api/v1/cms/coupons/validate')
      .set(bearer(alice))
      .send({ code, item_type: 'book', item_id: ids.aliceBook, gross_cents: 1000 })
    expect(ok.status).toBe(200)
    expect(ok.body).toMatchObject({ discount_cents: 200, net_cents: 800 })

    const wrongItem = await request(t.app)
      .post('/api/v1/cms/coupons/validate')
      .set(bearer(alice))
      .send({ code, item_type: 'book', item_id: ids.bobBook, gross_cents: 1000 })
    expect(wrongItem.status).toBe(422)
    expect(wrongItem.body.code).toBe('COUPON_NOT_APPLICABLE')
  })

  it('rejects a percentage outside 1-100', async () => {
    const res = await request(t.app)
      .post('/api/v1/cms/coupons')
      .set(bearer(alice))
      .send({ name: 'Too much', scope: 'book', book_id: ids.aliceBook, discount_type: 'percent', discount_value: 150 })
    expect(res.status).toBe(400)
  })

  it('rejects an end date before the start date', async () => {
    const res = await request(t.app)
      .post('/api/v1/cms/coupons')
      .set(bearer(alice))
      .send({
        name: 'Backwards',
        scope: 'book',
        book_id: ids.aliceBook,
        discount_type: 'fixed',
        discount_value: 100,
        starts_at: '2026-06-01T00:00:00Z',
        ends_at: '2026-05-01T00:00:00Z',
      })
    expect(res.status).toBe(400)
  })

  it('keeps the code stable once the campaign exists', async () => {
    const before = await request(t.app).get(`/api/v1/cms/coupons/${ids.aliceCoupon}`).set(bearer(alice))
    const res = await request(t.app).patch(`/api/v1/cms/coupons/${ids.aliceCoupon}`).set(bearer(alice)).send({ code: 'HIJACK', name: 'Renamed' })
    expect(res.status).toBe(200)
    expect(res.body.coupon.code).toBe(before.body.coupon.code)
    expect(res.body.coupon.name).toBe('Renamed')
  })

  it('reports performance for an author"s own campaign', async () => {
    const res = await request(t.app).get(`/api/v1/cms/coupons/${ids.aliceCoupon}/performance`).set(bearer(alice))
    expect(res.status).toBe(200)
    expect(res.body.performance).toMatchObject({ coupon_id: ids.aliceCoupon, redemptions: 0, redemption_rate: 0 })
  })

  it('exports the campaigns the actor may see as CSV', async () => {
    const res = await request(t.app).get('/api/v1/cms/coupons/export').set(bearer(alice))
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    const lines = res.text.trim().split('\r\n')
    expect(lines[0]).toContain('code')
    expect(lines).toHaveLength(2) // header + the author's single campaign
  })

  it('audits every campaign change with the actor', async () => {
    const res = await request(t.app).get('/api/v1/cms/audit-logs?entity_type=coupon').set(bearer(admin))
    expect(res.status).toBe(200)
    const actions = res.body.logs.map((l: { action: string }) => l.action)
    expect(actions).toContain('coupon.create')
    expect(actions).toContain('coupon.update')
    expect(res.body.logs.some((l: { actor_email: string }) => l.actor_email === 'alice@example.com')).toBe(true)
  })
})
