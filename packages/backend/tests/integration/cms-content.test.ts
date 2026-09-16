import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bearer, createTestApp, hasTestDatabase, registerUser, type TestApp } from '../helpers/testApp.js'

/**
 * Editorial workflow and the author ownership rule.
 *
 * The important assertions here are the negative ones: an author holding
 * `books.edit` must still be unable to see or touch another author's rows.
 */
describe.skipIf(!hasTestDatabase)('CMS content workflow & ownership (MySQL)', () => {
  let t: TestApp
  let admin: string
  let alice: string
  let bob: string
  let aliceId: string
  let bobId: string
  const ids = { aliceAuthor: 0, bobAuthor: 0, aliceBook: 0, bobBook: 0, category: 0 }

  beforeAll(async () => {
    t = await createTestApp({ database: 'loikmon_test_cms_content' })
    ;({ token: admin } = await registerUser(t.app, 'admin@loikmon.test'))
    ;({ token: alice, user: { id: aliceId } } = await registerUser(t.app, 'alice@example.com'))
    ;({ token: bob, user: { id: bobId } } = await registerUser(t.app, 'bob@example.com'))

    const roles = await request(t.app).get('/api/v1/cms/roles').set(bearer(admin))
    const authorRole = roles.body.roles.find((r: { role_key: string }) => r.role_key === 'author')

    const author = async (name: string, userId: string) => {
      const res = await request(t.app).post('/api/v1/cms/authors').set(bearer(admin)).send({ name, user_id: userId })
      expect(res.status).toBe(201)
      return res.body.author.id as number
    }
    ids.aliceAuthor = await author('Alice Mon', aliceId)
    ids.bobAuthor = await author('Bob Mon', bobId)

    for (const userId of [aliceId, bobId]) {
      const res = await request(t.app).put(`/api/v1/cms/users/${userId}/roles`).set(bearer(admin)).send({ role_ids: [authorRole.id] })
      expect(res.status).toBe(200)
    }

    const category = await request(t.app).post('/api/v1/cms/categories').set(bearer(admin)).send({ name: 'History', type: 'all' })
    ids.category = category.body.category.id
  })
  afterAll(async () => t?.close())

  it('gives an author the `own` scope and their author profile', async () => {
    const res = await request(t.app).get('/api/v1/cms/me').set(bearer(alice))
    expect(res.status).toBe(200)
    expect(res.body.scope).toBe('own')
    expect(res.body.author_profiles).toEqual([{ id: ids.aliceAuthor, name: 'Alice Mon' }])
  })

  it('creates a draft for the author who owns the profile', async () => {
    const res = await request(t.app)
      .post('/api/v1/cms/books')
      .set(bearer(alice))
      .send({ title: 'Alice on Hongsawadi', author_id: ids.aliceAuthor, category_id: ids.category })
    expect(res.status).toBe(201)
    expect(res.body.book).toMatchObject({ status: 'draft', is_published: false })
    ids.aliceBook = res.body.book.id

    const bobRes = await request(t.app).post('/api/v1/cms/books').set(bearer(bob)).send({ title: 'Bob on Dvaravati', author_id: ids.bobAuthor })
    expect(bobRes.status).toBe(201)
    ids.bobBook = bobRes.body.book.id
  })

  it('refuses to create content under somebody else"s author profile', async () => {
    const res = await request(t.app).post('/api/v1/cms/books').set(bearer(alice)).send({ title: 'Impostor', author_id: ids.bobAuthor })
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('OWNERSHIP_REQUIRED')
  })

  it('lists only the actor"s own books', async () => {
    const mine = await request(t.app).get('/api/v1/cms/books').set(bearer(alice))
    expect(mine.status).toBe(200)
    expect(mine.body.books.map((b: { id: number }) => b.id)).toEqual([ids.aliceBook])

    const everything = await request(t.app).get('/api/v1/cms/books').set(bearer(admin))
    expect(everything.body.books.length).toBe(2)
  })

  it('hides another author"s book behind a 403, not a silent empty response', async () => {
    const res = await request(t.app).get(`/api/v1/cms/books/${ids.bobBook}`).set(bearer(alice))
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('OWNERSHIP_REQUIRED')
  })

  it('refuses to edit or delete another author"s book', async () => {
    expect((await request(t.app).patch(`/api/v1/cms/books/${ids.bobBook}`).set(bearer(alice)).send({ title: 'Hijacked' })).status).toBe(403)
    expect((await request(t.app).delete(`/api/v1/cms/books/${ids.bobBook}`).set(bearer(alice))).status).toBe(403)
  })

  it('refuses to transfer a book to another author', async () => {
    const res = await request(t.app).patch(`/api/v1/cms/books/${ids.aliceBook}`).set(bearer(alice)).send({ author_id: ids.bobAuthor })
    expect(res.status).toBe(403)
  })

  it('keeps is_published in step with the workflow status', async () => {
    const publish = await request(t.app).post(`/api/v1/cms/books/${ids.aliceBook}/status`).set(bearer(alice)).send({ status: 'published' })
    expect(publish.status).toBe(200)

    const detail = await request(t.app).get(`/api/v1/cms/books/${ids.aliceBook}`).set(bearer(alice))
    expect(detail.body.book).toMatchObject({ status: 'published', is_published: true })

    // …and the storefront now sees it.
    const store = await request(t.app).get('/api/v1/books')
    expect(store.body.books.map((b: { id: number }) => b.id)).toContain(ids.aliceBook)

    const archive = await request(t.app).post(`/api/v1/cms/books/${ids.aliceBook}/status`).set(bearer(alice)).send({ status: 'archived' })
    expect(archive.status).toBe(200)
    const storeAfter = await request(t.app).get('/api/v1/books')
    expect(storeAfter.body.books.map((b: { id: number }) => b.id)).not.toContain(ids.aliceBook)
  })

  it('refuses a transition the workflow does not allow', async () => {
    // archived -> published is not a legal move; it must go back to draft first.
    const res = await request(t.app).post(`/api/v1/cms/books/${ids.aliceBook}/status`).set(bearer(alice)).send({ status: 'published' })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('INVALID_TRANSITION')

    expect((await request(t.app).post(`/api/v1/cms/books/${ids.aliceBook}/status`).set(bearer(alice)).send({ status: 'draft' })).status).toBe(200)
  })

  it('sanitises HTML written into an article body', async () => {
    const res = await request(t.app)
      .post('/api/v1/cms/articles')
      .set(bearer(alice))
      .send({
        title: 'Sanitised <script>alert(1)</script>',
        content: '<p onclick="steal()">Body</p><script>alert(2)</script><a href="javascript:x()">bad</a>',
        author_id: ids.aliceAuthor,
      })
    expect(res.status).toBe(201)
    expect(res.body.article.title).not.toContain('<script')
    expect(res.body.article.content).not.toContain('onclick')
    expect(res.body.article.content).not.toContain('alert(2)')
    expect(res.body.article.content).not.toContain('javascript:')
    expect(res.body.article.content).toContain('Body')
    // The excerpt is derived from the body when the editor leaves it empty.
    expect(res.body.article.excerpt).toContain('Body')
  })

  it('records a version on every save and restores one on request', async () => {
    const patch = await request(t.app).patch(`/api/v1/cms/books/${ids.aliceBook}`).set(bearer(alice)).send({ title: 'Second title' })
    expect(patch.status).toBe(200)
    expect(patch.body.book.title).toBe('Second title')
    expect(patch.body.book.revision).toBeGreaterThan(1)

    const versions = await request(t.app).get(`/api/v1/cms/books/${ids.aliceBook}/versions`).set(bearer(alice))
    expect(versions.status).toBe(200)
    expect(versions.body.versions.length).toBeGreaterThan(0)

    const oldest = versions.body.versions[versions.body.versions.length - 1]
    const restore = await request(t.app).post(`/api/v1/cms/books/${ids.aliceBook}/versions/${oldest.version}/restore`).set(bearer(alice))
    expect(restore.status).toBe(200)
    expect(restore.body.item.title).toBe('Alice on Hongsawadi')
  })

  it('refuses to read another author"s version history', async () => {
    const res = await request(t.app).get(`/api/v1/cms/books/${ids.bobBook}/versions`).set(bearer(alice))
    expect(res.status).toBe(403)
  })

  it('manages audiobook chapters and keeps their order', async () => {
    const add = async (title: string) => {
      const res = await request(t.app)
        .post(`/api/v1/cms/books/${ids.aliceBook}/chapters`)
        .set(bearer(alice))
        .send({ title, audio_key: `audio/t/${title}.mp3`, duration_seconds: 120 })
      expect(res.status).toBe(201)
      return res.body.chapter.id as number
    }
    const one = await add('One')
    const two = await add('Two')
    const three = await add('Three')

    const reordered = await request(t.app)
      .put(`/api/v1/cms/books/${ids.aliceBook}/chapters/order`)
      .set(bearer(alice))
      .send({ ids: [three, one, two] })
    expect(reordered.status).toBe(200)
    expect(reordered.body.chapters.map((c: { title: string }) => c.title)).toEqual(['Three', 'One', 'Two'])
    expect(reordered.body.chapters.map((c: { chapter_number: number }) => c.chapter_number)).toEqual([1, 2, 3])
  })

  it('refuses to add a chapter to another author"s book', async () => {
    const res = await request(t.app)
      .post(`/api/v1/cms/books/${ids.bobBook}/chapters`)
      .set(bearer(alice))
      .send({ title: 'Sneaky', audio_key: 'audio/t/x.mp3' })
    expect(res.status).toBe(403)
  })

  it('runs bulk actions only over rows the actor owns', async () => {
    const res = await request(t.app)
      .post('/api/v1/cms/books/bulk')
      .set(bearer(alice))
      .send({ ids: [ids.aliceBook, ids.bobBook], action: 'publish' })
    expect(res.status).toBe(200)
    expect(res.body.succeeded).toEqual([ids.aliceBook])
    expect(res.body.failed).toHaveLength(1)
    expect(res.body.failed[0].id).toBe(ids.bobBook)
  })

  it('stores tags, keeping Mon script intact', async () => {
    const res = await request(t.app)
      .patch(`/api/v1/cms/books/${ids.aliceBook}`)
      .set(bearer(alice))
      .send({ tags: ['ဘာသာစကား', 'History'] })
    expect(res.status).toBe(200)
    expect(res.body.book.tags).toEqual(expect.arrayContaining(['ဘာသာစကား', 'History']))

    const tags = await request(t.app).get('/api/v1/cms/tags').set(bearer(alice))
    expect(tags.body.tags.map((t2: { name: string }) => t2.name)).toEqual(expect.arrayContaining(['ဘာသာစကား']))
  })
})
