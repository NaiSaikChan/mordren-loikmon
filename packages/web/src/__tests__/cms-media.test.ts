/**
 * CMS media controls: the upload picker validates against the shared asset
 * standards before uploading, shows the thumbnail once a file is attached,
 * and asks for a preview before hero banners are uploaded.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describeStandard } from '@loikmon/media-standards'

const api = vi.hoisted(() => ({
  resolve: vi.fn(),
  upload: vi.fn(),
  list: vi.fn(),
}))

vi.mock('@loikmon/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@loikmon/api')>()),
  cms: { media: { resolve: api.resolve, upload: api.upload, list: api.list, signedUrl: vi.fn() } },
  uploadLargeAsset: vi.fn(),
}))

import MediaPicker from '../cms/components/MediaPicker.vue'
import MediaThumb from '../cms/components/MediaThumb.vue'

const responsive = (base: string) => ({
  src: `${base}/md.webp`,
  srcset: `${base}/xs.webp 150w, ${base}/sm.webp 300w, ${base}/md.webp 600w, ${base}/lg.webp 1200w`,
  original: `${base}/original.jpg`,
  variants: { xs: `${base}/xs.webp`, sm: `${base}/sm.webp`, md: `${base}/md.webp`, lg: `${base}/lg.webp` },
})

const asset = (key: string, extra: Record<string, unknown> = {}) => ({
  id: 7,
  key,
  asset_type: 'book_cover',
  asset_type_label: 'Book cover',
  category: 'image',
  storage_kind: 'cover',
  visibility: 'public',
  folder_id: null,
  original_name: 'cover.jpg',
  title: null,
  alt_text: null,
  mime_type: 'image/jpeg',
  format: 'jpg',
  size_bytes: 123_456,
  total_bytes: 200_000,
  width: 1600,
  height: 2400,
  has_alpha: false,
  dominant_color: '#aa3333',
  display: 'rounded',
  url: `https://cdn.test/${key}`,
  image: responsive('https://cdn.test/cover/2026-09/abc'),
  variants: {},
  uploaded_by: null,
  created_at: '2026-09-17T00:00:00Z',
  updated_at: '2026-09-17T00:00:00Z',
  ...extra,
})

/** jsdom cannot decode images: report the size the test wants. */
function stubImageSize(width: number, height: number) {
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width, height, close: () => undefined })))
}

function pickFile(wrapper: ReturnType<typeof mount>, file: File) {
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  return input.trigger('change')
}

beforeEach(() => {
  setActivePinia(createPinia())
  api.resolve.mockReset()
  api.upload.mockReset()
  api.list.mockReset().mockResolvedValue({ data: { assets: [], pagination: { page: 1, limit: 30, total: 0, total_pages: 1, has_more: false } } })
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('MediaPicker', () => {
  it('describes the asset standard and restricts the file input to its formats', () => {
    const wrapper = mount(MediaPicker, { props: { modelValue: null, assetType: 'book_cover' } })
    expect(wrapper.text()).toContain(describeStandard('book_cover'))
    expect(wrapper.text()).toContain('Book cover')
    const accept = wrapper.find('input[type="file"]').attributes('accept')!
    expect(accept).toContain('image/webp')
    expect(accept).toContain('.avif')
    expect(accept).not.toContain('svg')
  })

  it('shows the thumbnail of a key that is already on the record', async () => {
    const key = 'cover/2026-09/abc/original.jpg'
    api.resolve.mockResolvedValue({ data: { items: [{ key, registered: true, asset: asset(key) }] } })
    const wrapper = mount(MediaPicker, { props: { modelValue: key, assetType: 'book_cover' } })
    await flushPromises()
    expect(api.resolve).toHaveBeenCalledWith([key])
    const img = wrapper.find('img')
    expect(img.attributes('srcset')).toContain('sm.webp 300w')
    expect(img.attributes('loading')).toBe('lazy')
    expect(wrapper.text()).toContain('cover.jpg')
  })

  it('rejects an image below the minimum size in the browser, without uploading', async () => {
    stubImageSize(600, 900)
    const wrapper = mount(MediaPicker, { props: { modelValue: null, assetType: 'book_cover' } })
    await pickFile(wrapper, new File(['x'], 'small.webp', { type: 'image/webp' }))
    await flushPromises()
    expect(api.upload).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('at least 800×1200')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('uploads a valid image, binds its key and shows the processed thumbnail', async () => {
    stubImageSize(1600, 2400)
    const key = 'cover/2026-09/abc/original.webp'
    api.upload.mockResolvedValue({ data: { status: 'ok', key, public_url: null, asset: asset(key), warnings: [], reused: false } })
    const wrapper = mount(MediaPicker, { props: { modelValue: null, assetType: 'book_cover' } })
    await pickFile(wrapper, new File(['x'], 'cover.webp', { type: 'image/webp' }))
    await flushPromises()
    expect(api.upload).toHaveBeenCalledWith('book_cover', expect.any(File), expect.any(Object))
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([key])
    expect(wrapper.find('img').attributes('src')).toContain('https://cdn.test/cover/2026-09/abc/')
  })

  it('previews a hero banner in its frame and only uploads once confirmed', async () => {
    stubImageSize(1080, 1350)
    const key = 'slider/2026-09/m/original.webp'
    api.upload.mockResolvedValue({ data: { status: 'ok', key, public_url: null, asset: asset(key, { asset_type: 'hero_mobile' }), warnings: [], reused: false } })
    const wrapper = mount(MediaPicker, { props: { modelValue: null, assetType: 'hero_mobile' } })
    await pickFile(wrapper, new File(['x'], 'phone.webp', { type: 'image/webp' }))
    await flushPromises()
    expect(api.upload).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Preview — Hero banner (mobile) (4:5) · 1080×1350')

    const confirm = wrapper.findAll('button').find((b) => b.text() === 'Use this image')!
    await confirm.trigger('click')
    await flushPromises()
    expect(api.upload).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([key])
  })
})

describe('MediaThumb', () => {
  it('frames avatars as circles and covers at their standard ratio', () => {
    const avatar = mount(MediaThumb, { props: { src: 'https://cdn.test/a.webp', assetType: 'author_avatar', width: 64 } })
    expect(avatar.classes()).toContain('rounded-full')
    expect(avatar.attributes('style')).toContain('aspect-ratio: 1 / 1')

    const cover = mount(MediaThumb, { props: { image: responsive('https://cdn.test/c'), assetType: 'book_cover', width: 72 } })
    expect(cover.attributes('style')).toContain('aspect-ratio: 2 / 3')
    // 72 CSS px at 2× needs 144 px: the 150 px variant.
    expect(cover.find('img').attributes('src')).toBe('https://cdn.test/c/xs.webp')
    expect(cover.find('img').attributes('sizes')).toBe('72px')
  })
})
