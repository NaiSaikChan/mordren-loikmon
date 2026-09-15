import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bearer, createTestApp, hasTestDatabase, registerUser, type TestApp } from '../helpers/testApp.js'

describe.skipIf(!hasTestDatabase)('catalogue & access control (MySQL)', () => {
  let t: TestApp
  let reader: string
  let admin: string
  let readerId: string
  const ids = { category: 0, author: 0, freeBook: 0, paidBook: 0, freeArticle: 0, paidArticle: 0 }

  beforeAll(async () => {
    t = await createTestApp()
    ;({ token: reader, user: { id: readerId } } = await registerUser(t.app, 'reader@example.com'))
    ;({ token: admin } = await registerUser(t.app, 'admin@loikmon.test'))

    const post = async (path: string, body: object) => {
      const res = await request(t.app).post(`/api/v1/admin/${path}`).set(bearer(admin)).send(body)
      if (res.status !== 201) throw new Error(`${path}: ${res.status} ${JSON.stringify(res.body)}`)
      return res.body.item.id as number
    }
    ids.category = await post('categories', { name: 'ဇာတ်', type: 'all' })
    ids.author = await post('authors', { name: 'ကၞေဟ်မန်', bio: 'Historian' })
    ids.freeBook = await post('books', { title: 'Free primer', author_id: ids.author, category_id: ids.category, is_free: true, pdf_key: 'pdf/t/free.pdf', cover_key: 'cover/t/free.jpg' })
    ids.paidBook = await post('books', { title: 'Hongsawadi chronicle', description: 'Mon kings', author_id: ids.author, category_id: ids.category, epub_key: 'epub/t/paid.epub', pdf_key: 'pdf/t/paid.pdf' })
    ids.freeArticle = await post('articles', { title: 'Open letter', content: '<p>Free to read</p>', is_free: true, category_id: ids.category })
    ids.paidArticle = await post('articles', { title: 'Members story', content: '<p>Secret <b>history</b></p>', author_id: ids.author })

    const chapter = await request(t.app)
      .post(`/api/v1/admin/books/${ids.paidBook}/chapters`)
      .set(bearer(admin))
      .send({ chapter_number: 1, title: 'Preview', audio_key: 'audio/t/1.mp3', duration_seconds: 60, is_preview: true })
    expect(chapter.status).toBe(201)
    await request(t.app).post(`/api/v1/admin/books/${ids.paidBook}/chapters`).set(bearer(admin)).send({ chapter_number: 2, title: 'Full', audio_key: 'audio/t/2.mp3', duration_seconds: 600 })
  })
  afterAll(async () => t?.close())

  it('lists books with legacy-compatible fields and never leaks file URLs', async () => {
    const res = await request(t.app).get('/api/v1/books?sort=latest&limit=10')
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(2)
    const paid = res.body.books.find((b: { id: number }) => b.id === ids.paidBook)
    expect(paid).toMatchObject({
      title: 'Hongsawadi chronicle',
      authorname: 'ကၞေဟ်မန်',
      categoryname: 'ဇာတ်',
      is_free: false,
      formats: ['pdf', 'epub'],
      has_audio: true,
      audio_chapters_count: 2,
      audio_duration_seconds: 660,
    })
    expect(JSON.stringify(res.body)).not.toMatch(/epub\/t\/paid|pdf\/t\/paid/)
  })

  it('filters and searches (including Mon script)', async () => {
    expect((await request(t.app).get('/api/v1/books?free=true')).body.books.map((b: { id: number }) => b.id)).toEqual([ids.freeBook])
    expect((await request(t.app).get(`/api/v1/books?author=${ids.author}`)).body.total).toBe(2)
    expect((await request(t.app).get('/api/v1/books?has_audio=true')).body.books).toHaveLength(1)
    const search = await request(t.app).get(`/api/v1/search?q=${encodeURIComponent('ကၞေဟ်')}`)
    expect(search.body.authors).toHaveLength(1)
    const byTitle = await request(t.app).get('/api/v1/search?q=chronicle&type=book')
    expect(byTitle.body.books.map((b: { id: number }) => b.id)).toEqual([ids.paidBook])
    const wildcard = await request(t.app).get('/api/v1/search?q=%25')
    expect(wildcard.body.books).toHaveLength(0)
    const invalid = await request(t.app).get('/api/v1/books?limit=1000')
    expect(invalid.body.code).toBe('VALIDATION_ERROR')
  })

  it('gates book files: free for all, paid needs login then a subscription', async () => {
    const free = await request(t.app).get(`/api/v1/books/${ids.freeBook}/file`)
    expect(free.status).toBe(200)
    expect(free.body).toMatchObject({ format: 'pdf', url: expect.stringContaining('pdf/t/free.pdf') })

    const anon = await request(t.app).get(`/api/v1/books/${ids.paidBook}/file`)
    expect([anon.status, anon.body.code]).toEqual([401, 'LOGIN_REQUIRED'])

    const noSub = await request(t.app).get(`/api/v1/books/${ids.paidBook}/file?format=epub`).set(bearer(reader))
    expect([noSub.status, noSub.body.code]).toEqual([403, 'SUBSCRIPTION_REQUIRED'])

    const detail = await request(t.app).get(`/api/v1/books/${ids.paidBook}`).set(bearer(reader))
    expect(detail.body.book.access).toEqual({ granted: false, reason: 'subscription_required' })

    const missingFormat = await request(t.app).get(`/api/v1/books/${ids.freeBook}/file?format=epub`)
    expect(missingFormat.status).toBe(404)
  })

  it('locks audio chapters except previews and article bodies for non-subscribers', async () => {
    const chapters = await request(t.app).get(`/api/v1/books/${ids.paidBook}/chapters`).set(bearer(reader))
    expect(chapters.body.chapters.map((c: { locked: boolean; audio_url: string | null }) => [c.locked, Boolean(c.audio_url)])).toEqual([
      [false, true],
      [true, false],
    ])

    const article = await request(t.app).get(`/api/v1/articles/${ids.paidArticle}`).set(bearer(reader))
    expect(article.body.article).toMatchObject({ content: null, locked: true, excerpt: 'Secret history' })

    const list = await request(t.app).get('/api/v1/articles')
    expect(JSON.stringify(list.body)).not.toContain('<b>history</b>')
    const freeArticle = await request(t.app).get(`/api/v1/articles/${ids.freeArticle}`)
    expect(freeArticle.body.article).toMatchObject({ content: '<p>Free to read</p>', locked: false })
  })

  it('unlocks everything with an admin grant and locks again when revoked', async () => {
    const grant = await request(t.app).post(`/api/v1/admin/users/${readerId}/grants`).set(bearer(admin)).send({ reason: 'author', expires_at: null })
    expect(grant.status).toBe(201)

    const file = await request(t.app).get(`/api/v1/books/${ids.paidBook}/file?format=epub`).set(bearer(reader))
    expect(file.status).toBe(200)
    const chapters = await request(t.app).get(`/api/v1/books/${ids.paidBook}/chapters`).set(bearer(reader))
    expect(chapters.body.chapters.every((c: { locked: boolean }) => !c.locked)).toBe(true)
    const article = await request(t.app).get(`/api/v1/articles/${ids.paidArticle}`).set(bearer(reader))
    expect(article.body.article.content).toContain('Secret')

    expect((await request(t.app).delete(`/api/v1/admin/grants/${grant.body.id}`).set(bearer(admin))).status).toBe(200)
    expect((await request(t.app).get(`/api/v1/books/${ids.paidBook}/file`).set(bearer(reader))).status).toBe(403)
  })

  it('handles reviews, rating aggregates, library, follows and progress', async () => {
    const review = await request(t.app).post('/api/v1/reviews').set(bearer(reader)).send({ item_type: 'book', item_id: ids.paidBook, rating: 4, content: 'ကောန်' })
    expect(review.status).toBe(201)
    await request(t.app).post('/api/v1/reviews').set(bearer(admin)).send({ item_type: 'book', item_id: ids.paidBook, rating: 5 })
    await request(t.app).post('/api/v1/reviews').set(bearer(reader)).send({ item_type: 'book', item_id: ids.paidBook, rating: 2 }) // edit, not duplicate
    const listed = await request(t.app).get(`/api/v1/reviews?item_type=book&item_id=${ids.paidBook}`).set(bearer(reader))
    expect(listed.body.summary).toEqual({ average: 3.5, count: 2 })
    expect(listed.body.user_review.rating).toBe(2)
    expect((await request(t.app).get(`/api/v1/books/${ids.paidBook}`)).body.book).toMatchObject({ rating: 3.5, rating_count: 2 })

    const forbidden = await request(t.app).delete(`/api/v1/reviews/${review.body.review.id}`).set(bearer(admin))
    expect(forbidden.status).toBe(200) // admins may moderate
    expect((await request(t.app).post('/api/v1/reviews').set(bearer(reader)).send({ item_type: 'book', item_id: 999999, rating: 5 })).status).toBe(404)

    expect((await request(t.app).put(`/api/v1/library/book/${ids.paidBook}`).set(bearer(reader))).body.in_library).toBe(true)
    await request(t.app).put(`/api/v1/library/article/${ids.freeArticle}`).set(bearer(reader))
    const library = await request(t.app).get('/api/v1/library').set(bearer(reader))
    expect([library.body.books.length, library.body.articles.length]).toEqual([1, 1])

    const follow = await request(t.app).put(`/api/v1/authors/${ids.author}/follow`).set(bearer(reader))
    expect(follow.body).toMatchObject({ is_following: true, followers_count: 1 })
    const author = await request(t.app).get(`/api/v1/authors/${ids.author}`).set(bearer(reader))
    expect(author.body.author).toMatchObject({ is_following: true, books_count: 2, articles_count: 1 })

    await request(t.app).put(`/api/v1/books/${ids.paidBook}/progress`).set(bearer(reader)).send({ format: 'epub', location: 'epubcfi(/6/4!/4/2)', progress: 42.5 })
    const progress = await request(t.app).get(`/api/v1/books/${ids.paidBook}/progress`).set(bearer(reader))
    expect(progress.body.progress[0]).toMatchObject({ format: 'epub', progress: 42.5 })
  })

  it('counts views once per viewer window', async () => {
    for (let i = 0; i < 3; i++) await request(t.app).post(`/api/v1/books/${ids.freeBook}/views`).set(bearer(reader))
    expect((await request(t.app).get(`/api/v1/books/${ids.freeBook}`)).body.book.views).toBe(1)
  })

  it('serves home, categories, collections and FAQs', async () => {
    const collection = await request(t.app).post('/api/v1/admin/collections').set(bearer(admin)).send({ title: 'Start here' })
    await request(t.app)
      .put(`/api/v1/admin/collections/${collection.body.item.id}/items`)
      .set(bearer(admin))
      .send({ items: [{ item_type: 'book', item_id: ids.paidBook }, { item_type: 'book', item_id: ids.freeBook }] })
    await request(t.app).post('/api/v1/admin/faqs').set(bearer(admin)).send({ question: 'Q?', answer: 'A.' })

    const detail = await request(t.app).get(`/api/v1/collections/${collection.body.item.id}`)
    expect(detail.body.collection.books.map((b: { id: number }) => b.id)).toEqual([ids.paidBook, ids.freeBook])
    const categories = await request(t.app).get('/api/v1/categories?type=book')
    expect(categories.body.categories[0]).toMatchObject({ name: 'ဇာတ်', books_count: 2, articles_count: 1 })
    const home = await request(t.app).get('/api/v1/home')
    expect(home.body.latest_books).toHaveLength(2)
    expect(home.body.audio_books).toHaveLength(1)
    expect((await request(t.app).get('/api/v1/faqs')).body.faqs).toHaveLength(1)
  })

  it('restricts the admin API and cleans up replaced files', async () => {
    expect((await request(t.app).get('/api/v1/admin/users').set(bearer(reader))).status).toBe(403)
    expect((await request(t.app).get('/api/v1/admin/users')).status).toBe(401)

    const patched = await request(t.app).patch(`/api/v1/admin/books/${ids.freeBook}`).set(bearer(admin)).send({ pdf_key: 'pdf/t/free-v2.pdf' })
    expect(patched.status).toBe(200)
    expect(t.storage.removed).toContain('pdf/t/free.pdf')

    const orphan = await request(t.app).post('/api/v1/admin/books').set(bearer(admin)).send({ title: 'Orphan', author_id: 987654 })
    expect([orphan.status, orphan.body.code]).toEqual([400, 'BAD_REQUEST'])
    expect((await request(t.app).post('/api/v1/admin/chapters').set(bearer(admin)).send({ chapter_number: 1, title: 'x', audio_key: 'a' })).status).toBe(404)

    const bad = await request(t.app).post('/api/v1/admin/uploads/presign').set(bearer(admin)).send({ kind: 'pdf', content_type: 'image/png' })
    expect(bad.body.code).toBe('VALIDATION_ERROR')
    const presign = await request(t.app).post('/api/v1/admin/uploads/presign').set(bearer(admin)).send({ kind: 'audio', content_type: 'audio/mpeg', filename: 'ch1.mp3' })
    expect(presign.body.upload).toMatchObject({ method: 'PUT', key: expect.stringMatching(/^audio\/.+\.mp3$/) })
  })
})
