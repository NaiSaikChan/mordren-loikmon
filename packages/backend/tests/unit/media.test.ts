import { IMAGE_STANDARDS, isMediaAssetType } from '@loikmon/media-standards'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { AppError } from '../../src/lib/errors.js'
import { assertSafeSvg, generateVariants, inspectImage } from '../../src/media/imageProcessor.js'
import { MEDIA_REFERENCES } from '../../src/media/references.js'
import { CHECKSUM_MAX_LENGTH, contentChecksum, keyChecksum } from '../../src/services/media.js'
import { looksLikeSvg, sniffFormat } from '../../src/media/sniff.js'
import { ASSET_CONTENT_TYPES, ASSET_VISIBILITY } from '../../src/storage/storage.js'

const solid = (width: number, height: number, format: 'jpeg' | 'png' | 'webp' = 'jpeg', alpha = false) =>
  sharp({ create: { width, height, channels: alpha ? 4 : 3, background: alpha ? { r: 20, g: 120, b: 200, alpha: 0.5 } : { r: 200, g: 40, b: 40 } } })
    .toFormat(format)
    .toBuffer()

describe('image processor', () => {
  it('reads format, dimensions, alpha and dominant colour from the bytes', async () => {
    const info = await inspectImage(await solid(800, 1200, 'png', true))
    expect(info).toMatchObject({ format: 'png', width: 800, height: 1200, hasAlpha: true })
    expect(info.dominantColor).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('rejects bytes that are not an image', async () => {
    await expect(inspectImage(Buffer.from('%PDF-1.7 not an image'))).rejects.toBeInstanceOf(AppError)
  })

  it('generates cropped WebP sizes without upscaling, plus the full-size WebP and the Open Graph card', async () => {
    const source = await solid(900, 1200) // 3:4 — not the 2:3 a book cover wants
    const info = await inspectImage(source)
    const variants = await generateVariants(source, info, IMAGE_STANDARDS.book_cover)
    const byName = Object.fromEntries(variants.map((v) => [v.name, v]))

    expect(Object.keys(byName)).toEqual(['xs', 'sm', 'md', 'lg', 'webp', 'og'])
    expect([byName.xs!.width, byName.xs!.height]).toEqual([150, 225])
    expect([byName.sm!.width, byName.sm!.height]).toEqual([300, 450])
    expect([byName.md!.width, byName.md!.height]).toEqual([600, 900])
    // lg would be 1200 wide; the source is only 900, so it stays 900 (still 2:3).
    expect([byName.lg!.width, byName.lg!.height]).toEqual([900, 1350])
    expect([byName.webp!.width, byName.webp!.height]).toEqual([900, 1200])
    expect([byName.og!.width, byName.og!.height, byName.og!.contentType]).toEqual([1200, 630, 'image/jpeg'])
    for (const name of ['xs', 'sm', 'md', 'lg', 'webp'] as const) {
      expect((await sharp(byName[name]!.buffer).metadata()).format).toBe('webp')
    }
  })

  it('letterboxes category icons instead of cropping them, keeping transparency', async () => {
    const source = await solid(256, 128, 'png', true)
    const info = await inspectImage(source)
    const variants = await generateVariants(source, info, IMAGE_STANDARDS.category_icon)
    const xs = variants.find((v) => v.name === 'xs')!
    const meta = await sharp(xs.buffer).metadata()
    expect([meta.width, meta.height, meta.hasAlpha]).toEqual([150, 150, true])
    expect(variants.some((v) => v.name === 'og')).toBe(false)
  })

  it('rasterises safe SVG icons and refuses scriptable ones', async () => {
    const svg = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><circle cx="128" cy="128" r="100" fill="#4f46e5"/></svg>')
    expect(looksLikeSvg(svg)).toBe(true)
    expect(() => assertSafeSvg(svg)).not.toThrow()
    const info = await inspectImage(svg)
    expect(info.format).toBe('svg')
    const variants = await generateVariants(svg, info, IMAGE_STANDARDS.category_icon)
    expect(variants.find((v) => v.name === 'md')).toMatchObject({ width: 600, height: 600 })

    for (const evil of [
      '<svg><script>alert(1)</script></svg>',
      '<svg onload="alert(1)"></svg>',
      '<svg><a href="javascript:alert(1)"><text>x</text></a></svg>',
      '<svg><foreignObject><iframe src="https://evil"/></foreignObject></svg>',
    ]) {
      expect(() => assertSafeSvg(Buffer.from(evil)), evil).toThrow(AppError)
    }
  })
})

describe('content sniffing', () => {
  it('identifies documents and audio by their magic bytes', () => {
    const pad = (b: Buffer) => Buffer.concat([b, Buffer.alloc(64)])
    expect(sniffFormat(pad(Buffer.from('%PDF-1.7\n')))).toBe('pdf')
    const epub = Buffer.alloc(64)
    epub.write('PK\x03\x04', 0, 'latin1')
    epub.write('mimetypeapplication/epub+zip', 30, 'latin1')
    expect(sniffFormat(epub)).toBe('epub')
    const zip = Buffer.alloc(64)
    zip.write('PK\x03\x04', 0, 'latin1')
    expect(sniffFormat(zip)).toBeNull()
    expect(sniffFormat(pad(Buffer.from('RIFF\x00\x00\x00\x00WAVEfmt ', 'latin1')))).toBe('wav')
    expect(sniffFormat(pad(Buffer.from('ID3\x04\x00', 'latin1')))).toBe('mp3')
    expect(sniffFormat(pad(Buffer.from('\x00\x00\x00\x20ftypM4A ', 'latin1')))).toBe('m4a')
    expect(sniffFormat(pad(Buffer.from([0xff, 0xf1, 0x50, 0x80])))).toBe('aac')
    expect(sniffFormat(pad(Buffer.from('<html>')))).toBeNull()
  })
})

describe('checksums', () => {
  it('fits the media_assets.checksum column, prefix included', () => {
    // char(64) held the digest but not the `sha256:` prefix, so every upload
    // failed with "Data too long for column 'checksum'" (fixed in 0005).
    const content = contentChecksum(Buffer.from('any file'))
    const byKey = keyChecksum('audio/2026-09/a-very-long-object-key/original.mp3')
    expect(content).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(byKey).toMatch(/^key:[0-9a-f]{64}$/)
    for (const value of [content, byKey]) expect(value.length).toBeLessThanOrEqual(CHECKSUM_MAX_LENGTH)
  })

  it('deduplicates by content, not by name', () => {
    expect(contentChecksum(Buffer.from('same bytes'))).toBe(contentChecksum(Buffer.from('same bytes')))
    expect(contentChecksum(Buffer.from('a'))).not.toBe(contentChecksum(Buffer.from('b')))
  })
})

describe('media configuration wiring', () => {
  it('registers every file column once, with real asset types', () => {
    const ids = MEDIA_REFERENCES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const ref of MEDIA_REFERENCES) {
      expect(ref.assetTypes.length, ref.id).toBeGreaterThan(0)
      for (const type of ref.assetTypes) expect(isMediaAssetType(type), `${ref.id}: ${type}`).toBe(true)
    }
  })

  it('derives storage visibility and content types from the shared standards', () => {
    expect(ASSET_VISIBILITY.cover).toBe('public')
    expect(ASSET_VISIBILITY.audio).toBe('private')
    expect(ASSET_CONTENT_TYPES.cover).toEqual(expect.arrayContaining(['image/jpeg', 'image/png', 'image/webp', 'image/avif']))
    expect(ASSET_CONTENT_TYPES.category).toContain('image/svg+xml')
    expect(ASSET_CONTENT_TYPES.cover).not.toContain('image/svg+xml')
    expect(ASSET_CONTENT_TYPES.audio).toEqual(expect.arrayContaining(['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav']))
  })
})
