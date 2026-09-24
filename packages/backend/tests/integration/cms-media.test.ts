import { isProcessedImageKey, variantKey } from '@loikmon/media-standards'
import { sql } from 'kysely'
import sharp from 'sharp'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CHECKSUM_MAX_LENGTH, contentChecksum } from '../../src/services/media.js'
import { bearer, createTestApp, hasTestDatabase, registerUser, type TestApp } from '../helpers/testApp.js'

const image = (width: number, height: number, format: 'jpeg' | 'png' | 'webp' = 'webp', seed = 0) =>
  sharp({ create: { width, height, channels: 3, background: { r: (seed * 37) % 255, g: 90, b: 160 } } })
    .toFormat(format)
    .toBuffer()

/**
 * Media library: standards-driven validation, processing into variants,
 * reuse, usage tracking, folders and the "library files outlive content"
 * rule.
 */
describe.skipIf(!hasTestDatabase)('CMS media library (MySQL)', () => {
  let t: TestApp
  let admin: string
  let reader: string

  const upload = (assetType: string, file: Buffer, name: string, extra: Record<string, string> = {}) => {
    let req = request(t.app).post('/api/v1/cms/media').set(bearer(admin)).field('asset_type', assetType)
    for (const [k, v] of Object.entries(extra)) req = req.field(k, v)
    return req.attach('file', file, name)
  }

  beforeAll(async () => {
    t = await createTestApp({ database: 'loikmon_test_cms_media' })
    ;({ token: admin } = await registerUser(t.app, 'admin@loikmon.test'))
    ;({ token: reader } = await registerUser(t.app, 'reader@example.com'))
  })
  afterAll(async () => t?.close())

  it('migrates a checksum column wide enough for the prefixed digest', async () => {
    // An early 0004 created char(64), which fits the digest but not the
    // `sha256:` prefix, so every upload failed with "Data too long for column
    // 'checksum'". 0005 repairs it; this asserts the migrated schema, since a
    // column too narrow only shows up against a real database.
    const [column] = await sql<{ length: number | null }>`
      SELECT CHARACTER_MAXIMUM_LENGTH AS length FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'media_assets' AND COLUMN_NAME = 'checksum'`
      .execute(t.container.ctx.db)
      .then((r) => r.rows)
    expect(column?.length ?? 0).toBeGreaterThanOrEqual(CHECKSUM_MAX_LENGTH)
    expect(contentChecksum(Buffer.from('x')).length).toBeLessThanOrEqual(CHECKSUM_MAX_LENGTH)
  })

  it('rejects a book cover below the minimum dimensions with a clear message', async () => {
    const res = await upload('book_cover', await image(600, 900), 'small.webp')
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
    expect(res.body.message).toContain('at least 800×1200')
  })

  it('rejects a file whose bytes are not the image it claims to be', async () => {
    const res = await upload('book_cover', Buffer.from('%PDF-1.7 definitely not a jpeg'), 'cover.jpg')
    expect(res.status).toBe(400)
  })

  it('stores the original plus every variant, registers the asset and returns warnings', async () => {
    const res = await upload('book_cover', await image(800, 1200, 'jpeg'), 'Cover.jpg', { alt_text: 'A red cover' })
    expect(res.status).toBe(201)
    const { key, asset, warnings } = res.body
    expect(isProcessedImageKey(key)).toBe(true)
    expect(key).toMatch(/^cover\/\d{4}-\d{2}\/[0-9a-f-]{36}\/original\.jpg$/)
    for (const variant of ['xs', 'sm', 'md', 'lg', 'webp', 'og'] as const) {
      expect(t.storage.objects.has(variantKey(key, variant)!), variant).toBe(true)
    }
    expect(asset).toMatchObject({ asset_type: 'book_cover', width: 800, height: 1200, format: 'jpg', alt_text: 'A red cover', visibility: 'public' })
    expect(asset.image.srcset).toContain('/sm.webp 300w')
    expect(Object.keys(asset.variants).sort()).toEqual(['lg', 'md', 'og', 'sm', 'webp', 'xs'])
    expect(warnings.map((w: { code: string }) => w.code)).toEqual(expect.arrayContaining(['below_recommended', 'not_preferred_format']))
  })

  it('reuses an identical upload instead of storing it twice', async () => {
    const file = await image(1600, 900, 'webp', 7)
    const first = await upload('article_cover', file, 'a.webp')
    const second = await upload('article_cover', file, 'a-again.webp')
    expect(first.status).toBe(201)
    expect(second.status).toBe(200)
    expect(second.body.reused).toBe(true)
    expect(second.body.key).toBe(first.body.key)
  })

  it('accepts legacy kind-only uploads as free-form library images', async () => {
    const res = request(t.app).post('/api/v1/cms/media').set(bearer(admin)).field('kind', 'slider').attach('file', await image(300, 200), 'x.webp')
    expect((await res).status).toBe(201)
  })

  it('refuses uploads from accounts without media.upload', async () => {
    const res = await request(t.app)
      .post('/api/v1/cms/media')
      .set(bearer(reader))
      .field('asset_type', 'library_image')
      .attach('file', await image(100, 100), 'x.webp')
    expect(res.status).toBe(403)
  })

  it('tracks where an asset is used, keeps it when content lets go of it, and detects it as unused', async () => {
    const cover = await upload('book_cover', await image(1600, 2400, 'webp', 3), 'tracked.webp')
    const { key, asset } = cover.body

    const book = await request(t.app).post('/api/v1/cms/books').set(bearer(admin)).send({ title: 'Tracked', cover_key: key })
    expect(book.status).toBe(201)

    const detail = await request(t.app).get(`/api/v1/cms/media/${asset.id}`).set(bearer(admin))
    expect(detail.body.asset.usage_count).toBe(1)
    expect(detail.body.asset.usages[0]).toMatchObject({ reference: 'book.cover', entity_type: 'book', entity_label: 'Tracked' })

    const used = await request(t.app).get('/api/v1/cms/media?usage=used').set(bearer(admin))
    expect(used.body.assets.map((a: { id: number }) => a.id)).toContain(asset.id)

    // In use: a plain delete is refused and names the usage.
    const refused = await request(t.app).delete(`/api/v1/cms/media/${asset.id}`).set(bearer(admin))
    expect(refused.status).toBe(409)

    // The book drops the cover: the file stays in the library.
    const cleared = await request(t.app).patch(`/api/v1/cms/books/${book.body.book.id}`).set(bearer(admin)).send({ cover_key: null })
    expect(cleared.status).toBe(200)
    expect(t.storage.objects.has(key)).toBe(true)

    const unused = await request(t.app).get('/api/v1/cms/media?usage=unused').set(bearer(admin))
    expect(unused.body.assets.map((a: { id: number }) => a.id)).toContain(asset.id)

    const deleted = await request(t.app).post('/api/v1/cms/media/bulk-delete').set(bearer(admin)).send({ ids: [asset.id] })
    expect(deleted.body.deleted).toEqual([asset.id])
    expect(t.storage.objects.has(key)).toBe(false)
    expect(t.storage.objects.has(variantKey(key, 'md')!)).toBe(false)
  })

  it('still deletes unregistered files that content releases', async () => {
    const book = await request(t.app).post('/api/v1/cms/books').set(bearer(admin)).send({ title: 'Legacy', cover_key: 'cover/2020-01/legacy.jpg' })
    await request(t.app).patch(`/api/v1/cms/books/${book.body.book.id}`).set(bearer(admin)).send({ cover_key: null })
    expect(t.storage.removed).toContain('cover/2020-01/legacy.jpg')
  })

  it('organises assets in folders and filters by folder, type and search term', async () => {
    const folder = await request(t.app).post('/api/v1/cms/media-folders').set(bearer(admin)).send({ name: 'Campaigns' })
    expect(folder.status).toBe(201)
    const duplicate = await request(t.app).post('/api/v1/cms/media-folders').set(bearer(admin)).send({ name: 'Campaigns' })
    expect(duplicate.status).toBe(409)

    const banner = await upload('promo_banner', await image(1600, 900, 'webp', 11), 'Summer sale.webp', { folder_id: String(folder.body.folder.id) })
    expect(banner.body.asset.folder_id).toBe(folder.body.folder.id)

    const inFolder = await request(t.app).get(`/api/v1/cms/media?folder=${folder.body.folder.id}`).set(bearer(admin))
    expect(inFolder.body.assets).toHaveLength(1)
    const searched = await request(t.app).get('/api/v1/cms/media?q=summer&asset_type=promo_banner').set(bearer(admin))
    expect(searched.body.assets.map((a: { original_name: string }) => a.original_name)).toEqual(['Summer sale.webp'])

    const folders = await request(t.app).get('/api/v1/cms/media-folders').set(bearer(admin))
    expect(folders.body.folders.find((f: { id: number }) => f.id === folder.body.folder.id).asset_count).toBe(1)

    // Deleting the folder moves its assets back to the root.
    await request(t.app).delete(`/api/v1/cms/media-folders/${folder.body.folder.id}`).set(bearer(admin)).expect(200)
    const moved = await request(t.app).get(`/api/v1/cms/media/${banner.body.asset.id}`).set(bearer(admin))
    expect(moved.body.asset.folder_id).toBeNull()
  })

  it('bulk-uploads files independently, reporting each failure', async () => {
    const res = await request(t.app)
      .post('/api/v1/cms/media/bulk')
      .set(bearer(admin))
      .attach('files', await image(640, 480, 'png', 21), 'ok.png')
      .attach('files', Buffer.from('not an image at all'), 'broken.png')
    expect(res.status).toBe(207)
    expect(res.body.results.map((r: { ok: boolean }) => r.ok)).toEqual([true, false])
  })

  it('resolves keys held by content, including legacy keys without a registry row', async () => {
    const cover = await upload('audiobook_cover', await image(1000, 1000, 'webp', 5), 'square.webp')
    const res = await request(t.app)
      .post('/api/v1/cms/media/resolve')
      .set(bearer(admin))
      .send({ keys: [cover.body.key, 'cover/2019-01/old.jpg', 'audio/2020-01/secret.mp3'] })
    const [registered, legacy, privateFile] = res.body.items
    expect(registered).toMatchObject({ registered: true, asset: { asset_type: 'audiobook_cover' } })
    expect(legacy).toMatchObject({ registered: false, url: 'https://storage.test/public/cover/2019-01/old.jpg' })
    expect(privateFile).toMatchObject({ registered: false, url: null })
  })

  it('processes profile pictures with the user avatar standard without adding them to the library', async () => {
    const tooSmall = await request(t.app).post('/api/v1/auth/me/avatar').set(bearer(reader)).attach('file', await image(200, 200), 'me.webp')
    expect(tooSmall.status).toBe(400)
    const ok = await request(t.app).post('/api/v1/auth/me/avatar').set(bearer(reader)).attach('file', await image(400, 400, 'png'), 'me.png')
    expect(ok.status).toBe(200)
    expect(ok.body.user.avatar_image.srcset).toContain('/xs.webp 150w')
    const library = await request(t.app).get('/api/v1/cms/media?q=me.png').set(bearer(admin))
    expect(library.body.assets).toHaveLength(0)
  })

  it('exposes responsive images and the generated social card on the public API', async () => {
    const cover = await upload('book_cover', await image(1600, 2400, 'webp', 9), 'public.webp')
    const book = await request(t.app)
      .post('/api/v1/cms/books')
      .set(bearer(admin))
      .send({ title: 'Public cover', cover_key: cover.body.key, is_free: true, status: 'published' })
    const res = await request(t.app).get(`/api/v1/books/${book.body.book.id}`)
    expect(res.body.book.cover_image.src).toMatch(/\/md\.webp$/)
    expect(res.body.book.og_image_url).toMatch(/\/og\.jpg$/)
  })
})
