import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { IMAGE_STANDARDS, THUMBNAIL_WIDTHS, type ResponsiveImage } from '@loikmon/media-standards'
import ResponsiveImg from '@/components/shared/ResponsiveImg.vue'

const base = 'https://cdn.test/cover/2026-09/abc'
const image: ResponsiveImage = {
  src: `${base}/md.webp`,
  srcset: (['xs', 'sm', 'md', 'lg'] as const).map((n) => `${base}/${n}.webp ${THUMBNAIL_WIDTHS[n]}w`).join(', '),
  original: `${base}/original.jpg`,
  variants: { xs: `${base}/xs.webp`, sm: `${base}/sm.webp`, md: `${base}/md.webp`, lg: `${base}/lg.webp` },
}

describe('ResponsiveImg.vue', () => {
  it('renders src, srcset, sizes and lazy loading by default', () => {
    const wrapper = mount(ResponsiveImg, { props: { image, alt: 'Cover', sizes: '50vw' } })
    const img = wrapper.get('img')
    expect(img.attributes('src')).toBe(image.src)
    expect(img.attributes('srcset')).toBe(image.srcset)
    expect(img.attributes('sizes')).toBe('50vw')
    expect(img.attributes('alt')).toBe('Cover')
    expect(img.attributes('loading')).toBe('lazy')
    expect(img.attributes('decoding')).toBe('async')
    expect(img.attributes('fetchpriority')).toBeUndefined()
  })

  it('loads eagerly with high fetch priority when eager', () => {
    const img = mount(ResponsiveImg, { props: { image, alt: 'Hero', eager: true } }).get('img')
    expect(img.attributes('loading')).toBe('eager')
    expect(img.attributes('fetchpriority')).toBe('high')
    expect(img.attributes('sizes')).toBe('100vw')
  })

  it('falls back to the flat URL without srcset when image is null', () => {
    const img = mount(ResponsiveImg, { props: { image: null, fallback: 'https://cdn.test/legacy.jpg', alt: 'Legacy' } }).get('img')
    expect(img.attributes('src')).toBe('https://cdn.test/legacy.jpg')
    expect(img.attributes('srcset')).toBeUndefined()
    expect(img.attributes('sizes')).toBeUndefined()
  })

  it('shows the empty state when there is no image at all', () => {
    const wrapper = mount(ResponsiveImg, {
      props: { image: null, fallback: null, alt: 'None' },
      slots: { empty: '<span class="icon">📚</span>' },
    })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('[data-testid="responsive-img-empty"]').text()).toContain('📚')
  })

  it('shows the empty state when the image fails to load', async () => {
    const wrapper = mount(ResponsiveImg, { props: { image, alt: 'Broken' } })
    await wrapper.get('img').trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('[data-testid="responsive-img-empty"]').exists()).toBe(true)
  })

  it('renders author avatars as a circle in the standard aspect ratio', () => {
    const wrapper = mount(ResponsiveImg, { props: { image, alt: 'Author', assetType: 'author_avatar' } })
    const box = wrapper.get('[data-testid="responsive-img"]')
    const ratio = IMAGE_STANDARDS.author_avatar.aspectRatio!
    expect(box.classes()).toContain('rounded-full')
    expect(box.attributes('style')).toContain(`aspect-ratio: ${ratio.width} / ${ratio.height}`)
  })

  it('sizes the frame from the book cover standard and is not round', () => {
    const box = mount(ResponsiveImg, { props: { image, alt: 'Book', assetType: 'book_cover' } }).get('[data-testid="responsive-img"]')
    const ratio = IMAGE_STANDARDS.book_cover.aspectRatio!
    expect(box.classes()).not.toContain('rounded-full')
    expect(box.attributes('style')).toContain(`aspect-ratio: ${ratio.width} / ${ratio.height}`)
  })
})
