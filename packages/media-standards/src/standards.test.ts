import { describe, expect, it } from 'vitest'
import {
  acceptForAssetType,
  allVariantKeys,
  aspectRatioDeviation,
  ASPECT_RATIO_TOLERANCE,
  describeStandard,
  detectFormat,
  IMAGE_STANDARDS,
  isProcessedImageKey,
  MEDIA_STANDARDS,
  processedImageKey,
  responsiveImage,
  UPLOAD_LIMITS,
  validateMediaUpload,
  variantForWidth,
  variantKey,
  visibilityOfKey,
} from './index.js'

describe('image standards', () => {
  it('keep recommended and minimum sizes on their declared aspect ratio', () => {
    for (const [type, standard] of Object.entries(IMAGE_STANDARDS)) {
      if (!standard.aspectRatio) continue
      for (const s of [standard.recommended, standard.minimum, standard.thumbnail]) {
        if (!s) continue
        expect(aspectRatioDeviation(standard.aspectRatio, s.width, s.height), `${type} ${s.width}×${s.height}`).toBeLessThanOrEqual(
          ASPECT_RATIO_TOLERANCE,
        )
      }
    }
  })

  it('never recommend less than the minimum', () => {
    for (const standard of Object.values(IMAGE_STANDARDS)) {
      if (!standard.minimum || !standard.recommended) continue
      expect(standard.recommended.width).toBeGreaterThanOrEqual(standard.minimum.width)
      expect(standard.recommended.height).toBeGreaterThanOrEqual(standard.minimum.height)
    }
  })

  it('cap every image at the 10 MB upload limit and prefer WebP for raster assets', () => {
    for (const standard of Object.values(IMAGE_STANDARDS)) {
      expect(standard.maxBytes).toBe(UPLOAD_LIMITS.image)
      expect(['webp', 'svg']).toContain(standard.preferredFormat)
    }
  })

  it('pair the desktop and mobile hero banners', () => {
    expect(IMAGE_STANDARDS.hero_desktop.pairedWith).toBe('hero_mobile')
    expect(IMAGE_STANDARDS.hero_mobile.pairedWith).toBe('hero_desktop')
  })

  it('map every standard to a storage kind with the right visibility', () => {
    for (const standard of Object.values(MEDIA_STANDARDS)) {
      const expected = standard.category === 'image' ? 'public' : 'private'
      expect(visibilityOfKey(`${standard.storageKind}/2026-09/x.bin`)).toBe(expected)
    }
  })
})

describe('validateMediaUpload', () => {
  const MB = 1024 * 1024

  it('accepts a book cover at the minimum size and warns that it is below recommended', () => {
    const result = validateMediaUpload('book_cover', { mimeType: 'image/webp', bytes: MB, width: 800, height: 1200 })
    expect(result.ok).toBe(true)
    expect(result.warnings.map((w) => w.code)).toEqual(['below_recommended'])
  })

  it('rejects a book cover below the minimum', () => {
    const result = validateMediaUpload('book_cover', { mimeType: 'image/jpeg', bytes: MB, width: 799, height: 1200 })
    expect(result.ok).toBe(false)
    expect(result.errors.map((e) => e.code)).toEqual(['below_minimum'])
    expect(result.warnings.map((w) => w.code)).toContain('not_preferred_format')
  })

  it('rejects files over 10 MB and formats outside the list', () => {
    const big = validateMediaUpload('article_cover', { mimeType: 'image/png', bytes: 10 * MB + 1, width: 1600, height: 900 })
    expect(big.errors.map((e) => e.code)).toEqual(['file_too_large'])
    const gif = validateMediaUpload('article_cover', { mimeType: 'image/gif', bytes: MB, width: 1600, height: 900 })
    expect(gif.errors.map((e) => e.code)).toEqual(['format_not_allowed'])
  })

  it('applies a lower deployment limit but never a higher one', () => {
    expect(validateMediaUpload('book_pdf', { mimeType: 'application/pdf', bytes: 20 * MB }, { maxBytes: 10 * MB }).ok).toBe(false)
    expect(validateMediaUpload('article_cover', { mimeType: 'image/webp', bytes: 11 * MB, width: 1600, height: 900 }, { maxBytes: 100 * MB }).ok).toBe(false)
  })

  it('warns, without rejecting, when the aspect ratio is off', () => {
    const result = validateMediaUpload('hero_desktop', { mimeType: 'image/webp', bytes: MB, width: 1920, height: 1080 })
    expect(result.ok).toBe(true)
    expect(result.warnings.map((w) => w.code)).toContain('aspect_ratio_mismatch')
  })

  it('accepts the specified slider minimum despite its rounding', () => {
    expect(validateMediaUpload('hero_desktop', { mimeType: 'image/webp', bytes: MB, width: 1600, height: 685 }).warnings.map((w) => w.code)).toEqual([
      'below_recommended',
    ])
  })

  it('accepts SVG only where the standard allows it, without dimension checks', () => {
    expect(validateMediaUpload('category_icon', { mimeType: 'image/svg+xml', bytes: 2048 }).ok).toBe(true)
    expect(validateMediaUpload('book_cover', { mimeType: 'image/svg+xml', bytes: 2048 }).ok).toBe(false)
  })

  it('requires readable dimensions when a minimum applies', () => {
    expect(validateMediaUpload('user_avatar', { mimeType: 'image/png', bytes: 2048 }).errors.map((e) => e.code)).toEqual(['dimensions_unknown'])
  })

  it('detects EPUB and M4A from the extension when the browser sends no type', () => {
    expect(validateMediaUpload('book_epub', { mimeType: '', filename: 'Book.EPUB', bytes: MB }).ok).toBe(true)
    expect(detectFormat('application/octet-stream', 'chapter.m4a')?.id).toBe('m4a')
    expect(validateMediaUpload('audio_chapter', { mimeType: 'audio/ogg', filename: 'a.ogg', bytes: MB }).ok).toBe(false)
  })
})

describe('variants and responsive images', () => {
  const key = processedImageKey('cover', 'abc', 'JPG', new Date('2026-09-17T00:00:00Z'))

  it('derives variant keys from the original key', () => {
    expect(key).toBe('cover/2026-09/abc/original.jpg')
    expect(isProcessedImageKey(key)).toBe(true)
    expect(variantKey(key, 'sm')).toBe('cover/2026-09/abc/sm.webp')
    expect(variantKey(key, 'og')).toBe('cover/2026-09/abc/og.jpg')
    expect(allVariantKeys(key)).toHaveLength(6)
    expect(variantKey('cover/legacy/photo.jpg', 'sm')).toBeNull()
  })

  it('builds a srcset for processed keys and passes legacy keys through', () => {
    const urlFor = (k: string) => `https://cdn.test/${k}`
    const image = responsiveImage(key, urlFor)!
    expect(image.src).toBe('https://cdn.test/cover/2026-09/abc/md.webp')
    expect(image.srcset).toBe(
      'https://cdn.test/cover/2026-09/abc/xs.webp 150w, https://cdn.test/cover/2026-09/abc/sm.webp 300w, https://cdn.test/cover/2026-09/abc/md.webp 600w, https://cdn.test/cover/2026-09/abc/lg.webp 1200w',
    )
    expect(responsiveImage('https://old.example/a.jpg', (k) => k)).toEqual({
      src: 'https://old.example/a.jpg',
      srcset: null,
      original: 'https://old.example/a.jpg',
      variants: {},
    })
    expect(responsiveImage(null, urlFor)).toBeNull()
  })

  it('picks the smallest variant that covers a rendered width', () => {
    expect(variantForWidth(64)).toBe('xs')
    expect(variantForWidth(150)).toBe('sm')
    expect(variantForWidth(160)).toBe('md')
    expect(variantForWidth(320)).toBe('lg')
    expect(variantForWidth(2000)).toBe('lg')
  })
})

describe('UI helpers', () => {
  it('describe a standard and build its accept attribute', () => {
    expect(describeStandard('book_cover')).toBe('2:3 · 1600×2400 recommended · min 800×1200 · JPG, PNG, WebP, AVIF · max 10 MB')
    expect(acceptForAssetType('book_epub')).toBe('application/epub+zip,.epub')
  })
})
