import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bearer, createTestApp, hasTestDatabase, registerUser, type TestApp } from '../helpers/testApp.js'

/**
 * Moderation, feedback, policies and settings — the parts of the CMS that
 * change what readers see on the storefront.
 */
describe.skipIf(!hasTestDatabase)('CMS moderation, feedback, policies & settings (MySQL)', () => {
  let t: TestApp
  let admin: string
  let reader: string
  const ids = { book: 0, review: 0, ticket: 0 }

  beforeAll(async () => {
    t = await createTestApp({ database: 'loikmon_test_cms_platform' })
    ;({ token: admin } = await registerUser(t.app, 'admin@loikmon.test'))
    ;({ token: reader } = await registerUser(t.app, 'reader@example.com'))

    const book = await request(t.app)
      .post('/api/v1/cms/books')
      .set(bearer(admin))
      .send({ title: 'Reviewed book', is_free: true, status: 'published' })
    expect(book.status).toBe(201)
    ids.book = book.body.book.id
  })
  afterAll(async () => t?.close())

  // ── Review moderation ─────────────────────────────────────────────────────

  it('publishes a review straight away while moderation is off', async () => {
    const res = await request(t.app)
      .post('/api/v1/reviews')
      .set(bearer(reader))
      .send({ item_type: 'book', item_id: ids.book, rating: 5, content: 'Wonderful' })
    expect(res.status).toBe(201)
    expect(res.body.pending_moderation).toBe(false)
    ids.review = res.body.review.id

    const listed = await request(t.app).get(`/api/v1/reviews?item_type=book&item_id=${ids.book}`)
    expect(listed.body.reviews).toHaveLength(1)
    expect(listed.body.summary.average).toBe(5)
  })

  it('hides a review from readers and recomputes the rating', async () => {
    const hide = await request(t.app).post(`/api/v1/cms/reviews/${ids.review}/status`).set(bearer(admin)).send({ status: 'hidden' })
    expect(hide.status).toBe(200)

    const listed = await request(t.app).get(`/api/v1/reviews?item_type=book&item_id=${ids.book}`)
    expect(listed.body.reviews).toHaveLength(0)
    expect(listed.body.summary.count).toBe(0)
    expect(listed.body.summary.average).toBe(0)

    const detail = await request(t.app).get(`/api/v1/books/${ids.book}`)
    expect(detail.body.book.rating_count).toBe(0)
  })

  it('still shows the author their own hidden review, so it does not look lost', async () => {
    const listed = await request(t.app).get(`/api/v1/reviews?item_type=book&item_id=${ids.book}`).set(bearer(reader))
    expect(listed.body.user_review).not.toBeNull()
    expect(listed.body.user_review.id).toBe(ids.review)
  })

  it('restores the rating when the review is published again', async () => {
    await request(t.app).post(`/api/v1/cms/reviews/${ids.review}/status`).set(bearer(admin)).send({ status: 'published' })
    const detail = await request(t.app).get(`/api/v1/books/${ids.book}`)
    expect(detail.body.book.rating_count).toBe(1)
    expect(detail.body.book.rating).toBe(5)
  })

  it('queues new reviews when the approval toggle is on', async () => {
    const on = await request(t.app)
      .patch('/api/v1/cms/settings')
      .set(bearer(admin))
      .send({ values: { 'features.reviews_require_approval': true } })
    expect(on.status).toBe(200)

    const res = await request(t.app)
      .post('/api/v1/reviews')
      .set(bearer(reader))
      .send({ item_type: 'book', item_id: ids.book, rating: 2, content: 'Changed my mind' })
    expect(res.status).toBe(201)
    expect(res.body.pending_moderation).toBe(true)
    expect(res.body.review.status).toBe('pending')

    // The pending review must not move the public rating.
    const detail = await request(t.app).get(`/api/v1/books/${ids.book}`)
    expect(detail.body.book.rating_count).toBe(0)

    await request(t.app).patch('/api/v1/cms/settings').set(bearer(admin)).send({ values: { 'features.reviews_require_approval': false } })
  })

  it('accepts a reader report and surfaces it in the moderation queue', async () => {
    const report = await request(t.app).post(`/api/v1/reviews/${ids.review}/report`).set(bearer(reader)).send({ reason: 'spam', note: 'Looks fake' })
    expect(report.status).toBe(201)

    const queue = await request(t.app).get('/api/v1/cms/review-reports?status=open').set(bearer(admin))
    expect(queue.status).toBe(200)
    expect(queue.body.reports).toHaveLength(1)
    expect(queue.body.reports[0]).toMatchObject({ reason: 'spam', review_id: ids.review })

    const resolve = await request(t.app)
      .post(`/api/v1/cms/review-reports/${queue.body.reports[0].id}/resolve`)
      .set(bearer(admin))
      .send({ outcome: 'actioned' })
    expect(resolve.status).toBe(200)

    // "Actioned" also hides the review.
    const reviews = await request(t.app).get(`/api/v1/cms/reviews?status=hidden`).set(bearer(admin))
    expect(reviews.body.reviews.some((r: { id: number }) => r.id === ids.review)).toBe(true)
  })

  // ── Feedback ──────────────────────────────────────────────────────────────

  it('opens a ticket from the storefront and lists it in the queue', async () => {
    const res = await request(t.app)
      .post('/api/v1/feedback')
      .set(bearer(reader))
      .send({ subject: 'Cannot download my book', body: 'The PDF link expires immediately.', category: 'bug' })
    expect(res.status).toBe(201)
    expect(res.body.reference).toMatch(/^LK-/)
    ids.ticket = res.body.ticket_id

    const queue = await request(t.app).get('/api/v1/cms/feedback?status=open').set(bearer(admin))
    expect(queue.body.tickets.some((t2: { id: number }) => t2.id === ids.ticket)).toBe(true)
  })

  it('requires an e-mail address from a guest', async () => {
    const res = await request(t.app).post('/api/v1/feedback').send({ subject: 'Anonymous', body: 'No way to reply' })
    expect(res.status).toBe(400)
  })

  it('sends a public reply by e-mail and keeps internal notes private', async () => {
    const before = t.mail.length

    const internal = await request(t.app)
      .post(`/api/v1/cms/feedback/${ids.ticket}/messages`)
      .set(bearer(admin))
      .send({ body: 'Check the MinIO TTL', internal: true })
    expect(internal.status).toBe(201)
    expect(t.mail).toHaveLength(before) // nothing sent

    const reply = await request(t.app)
      .post(`/api/v1/cms/feedback/${ids.ticket}/messages`)
      .set(bearer(admin))
      .send({ body: 'Fixed — please try again.', internal: false })
    expect(reply.status).toBe(201)
    expect(t.mail).toHaveLength(before + 1)
    expect(t.mail[t.mail.length - 1].to).toBe('reader@example.com')

    // The reporter sees the reply but never the internal note.
    const mine = await request(t.app).get('/api/v1/feedback/me').set(bearer(reader))
    const ticket = mine.body.tickets.find((t2: { id: number }) => t2.id === ids.ticket)
    const bodies = ticket.messages.map((m: { body: string }) => m.body)
    expect(bodies).toContain('Fixed — please try again.')
    expect(bodies).not.toContain('Check the MinIO TTL')
  })

  it('tracks status and resolution', async () => {
    const res = await request(t.app)
      .patch(`/api/v1/cms/feedback/${ids.ticket}`)
      .set(bearer(admin))
      .send({ status: 'resolved', priority: 'high', resolution_note: 'Signed URL TTL raised' })
    expect(res.status).toBe(200)
    expect(res.body.ticket).toMatchObject({ status: 'resolved', priority: 'high' })
    expect(res.body.ticket.resolved_at).toBeTruthy()

    const metrics = await request(t.app).get('/api/v1/cms/feedback/metrics').set(bearer(admin))
    expect(metrics.body.metrics.by_status.resolved).toBe(1)
  })

  // ── Policies ──────────────────────────────────────────────────────────────

  it('keeps a policy invisible to readers until it is published', async () => {
    const before = await request(t.app).get('/api/v1/policies/terms')
    expect(before.status).toBe(404)

    const draft = await request(t.app)
      .put('/api/v1/cms/policies/terms/draft')
      .set(bearer(admin))
      .send({ title: 'Terms & Conditions', body: '<p>Version one</p>', summary: 'First publication' })
    expect(draft.status).toBe(200)
    expect(draft.body.policy.draft.version).toBe(1)

    // Still a draft.
    expect((await request(t.app).get('/api/v1/policies/terms')).status).toBe(404)

    const publish = await request(t.app).post('/api/v1/cms/policies/terms/publish').set(bearer(admin)).send({ version: 1 })
    expect(publish.status).toBe(200)

    const live = await request(t.app).get('/api/v1/policies/terms')
    expect(live.status).toBe(200)
    expect(live.body.policy).toMatchObject({ slug: 'terms', version: 1 })
    expect(live.body.policy.body).toContain('Version one')
  })

  it('publishes a second version and archives the first', async () => {
    await request(t.app).put('/api/v1/cms/policies/terms/draft').set(bearer(admin)).send({ body: '<p>Version two</p>', summary: 'Clarified refunds' })
    await request(t.app).post('/api/v1/cms/policies/terms/publish').set(bearer(admin)).send({ version: 2 })

    const detail = await request(t.app).get('/api/v1/cms/policies/terms').set(bearer(admin))
    const versions = detail.body.policy.versions
    expect(versions.find((v: { version: number }) => v.version === 1).status).toBe('archived')
    expect(versions.find((v: { version: number }) => v.version === 2).status).toBe('published')

    const live = await request(t.app).get('/api/v1/policies/terms')
    expect(live.body.policy.body).toContain('Version two')
  })

  it('sanitises policy text on save', async () => {
    await request(t.app)
      .put('/api/v1/cms/policies/privacy/draft')
      .set(bearer(admin))
      .send({ body: '<p>Safe</p><script>alert(1)</script>' })
    const detail = await request(t.app).get('/api/v1/cms/policies/privacy').set(bearer(admin))
    expect(detail.body.policy.draft.body).toBe('<p>Safe</p>')
  })

  // ── Settings ──────────────────────────────────────────────────────────────

  it('serves the public settings anonymously and hides the private ones', async () => {
    const res = await request(t.app).get('/api/v1/settings')
    expect(res.status).toBe(200)
    expect(res.body.settings['branding.site_name']).toBe('Loikmon')
    expect(res.body.settings).not.toHaveProperty('email.support_address')
  })

  it('rejects an unknown setting key rather than creating it', async () => {
    const res = await request(t.app).patch('/api/v1/cms/settings').set(bearer(admin)).send({ values: { 'made.up.key': 1 } })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })

  it('applies a settings change to the storefront and audits it', async () => {
    const res = await request(t.app)
      .patch('/api/v1/cms/settings')
      .set(bearer(admin))
      .send({ values: { 'branding.site_name': 'Loikmon Library', 'features.registration_enabled': false } })
    expect(res.status).toBe(200)

    const audit = await request(t.app).get('/api/v1/cms/audit-logs?action=settings.update').set(bearer(admin))
    expect(audit.body.logs[0].after_data).toMatchObject({ 'branding.site_name': 'Loikmon Library' })
  })

  // ── Sliders ───────────────────────────────────────────────────────────────

  it('hides a slider outside its scheduling window', async () => {
    const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
    const live = await request(t.app)
      .post('/api/v1/cms/sliders')
      .set(bearer(admin))
      .send({ title: 'Live now', image_key: 'slider/t/a.jpg', is_active: true })
    const scheduled = await request(t.app)
      .post('/api/v1/cms/sliders')
      .set(bearer(admin))
      .send({ title: 'Next week', image_key: 'slider/t/b.jpg', is_active: true, starts_at: future })
    expect(live.status).toBe(201)
    expect(scheduled.status).toBe(201)
    expect(live.body.slider).toMatchObject({
      image_key: 'slider/t/a.jpg',
      image_url: 'https://storage.test/public/slider/t/a.jpg',
    })

    const cmsSliders = await request(t.app).get('/api/v1/cms/sliders').set(bearer(admin))
    expect(cmsSliders.status).toBe(200)
    expect(cmsSliders.body.sliders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          image_key: 'slider/t/a.jpg',
          image_url: 'https://storage.test/public/slider/t/a.jpg',
        }),
      ]),
    )

    const home = await request(t.app).get('/api/v1/home')
    const titles = home.body.sliders.map((s: { title: string }) => s.title)
    expect(titles).toContain('Live now')
    expect(titles).not.toContain('Next week')
  })

  it('respects the audience rule', async () => {
    await request(t.app)
      .post('/api/v1/cms/sliders')
      .set(bearer(admin))
      .send({ title: 'Members only', image_key: 'slider/t/c.jpg', is_active: true, audience: 'members' })

    const guest = await request(t.app).get('/api/v1/home')
    expect(guest.body.sliders.map((s: { title: string }) => s.title)).not.toContain('Members only')

    const member = await request(t.app).get('/api/v1/home').set(bearer(reader))
    expect(member.body.sliders.map((s: { title: string }) => s.title)).toContain('Members only')
  })
})
