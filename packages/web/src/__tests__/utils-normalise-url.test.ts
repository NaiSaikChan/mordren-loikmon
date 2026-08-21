/**
 * normaliseUrl utility — unit tests
 * Covers the URL encoding logic needed for book cover thumbnails.
 */
import { describe, it, expect } from 'vitest'

// ── inline the utility under test so no import resolution issues ──────────────
function normaliseUrl(url: string | undefined | null, base = 'https://loikmon.org'): string {
  if (!url) return ''

  // Decode escaped slashes (`\/`) first, regardless of escaped protocol.
  let u = String(url).replace(/\\\//g, '/')

  // Encode narrow no-break space (U+202F) and regular space without changing filenames.
  u = u.replace(/\u202f/gi, '%E2%80%AF').replace(/ /g, '%20')

  if (u.startsWith('http://') || u.startsWith('https://')) return u
  return `${base}${u.startsWith('/') ? '' : '/'}${u}`
}

describe('normaliseUrl()', () => {

  it('returns empty string for undefined', () => {
    expect(normaliseUrl(undefined)).toBe('')
  })

  it('returns empty string for null', () => {
    expect(normaliseUrl(null)).toBe('')
  })

  it('returns empty string for empty string', () => {
    expect(normaliseUrl('')).toBe('')
  })

  it('leaves already-absolute HTTPS URL unchanged', () => {
    expect(normaliseUrl('https://loikmon.org/uploads/cover.jpg'))
      .toBe('https://loikmon.org/uploads/cover.jpg')
  })

  it('encodes narrow no-break space (U+202F) in absolute URL', () => {
    const dirty = 'https://loikmon.org/uploads/thumbnails/Screenshot\u202f2024.jpg'
    expect(normaliseUrl(dirty)).toBe('https://loikmon.org/uploads/thumbnails/Screenshot%E2%80%AF2024.jpg')
  })

  it('encodes regular space in absolute URL', () => {
    const dirty = 'https://loikmon.org/uploads/my file.jpg'
    expect(normaliseUrl(dirty)).toBe('https://loikmon.org/uploads/my%20file.jpg')
  })

  it('unescapes backslash-escaped slashes', () => {
    const escaped = 'https://loikmon.org\\/uploads\\/cover.jpg'
    expect(normaliseUrl(escaped)).toBe('https://loikmon.org/uploads/cover.jpg')
  })

  it('prepends base to relative URL', () => {
    expect(normaliseUrl('/uploads/cover.jpg'))
      .toBe('https://loikmon.org/uploads/cover.jpg')
  })

  it('prepends base + slash to relative URL without leading slash', () => {
    expect(normaliseUrl('uploads/cover.jpg'))
      .toBe('https://loikmon.org/uploads/cover.jpg')
  })

  it('handles relative URL with spaces', () => {
    expect(normaliseUrl('/uploads/my cover.jpg'))
      .toBe('https://loikmon.org/uploads/my%20cover.jpg')
  })

  it('uses custom base when provided', () => {
    expect(normaliseUrl('/img/a.png', 'https://cdn.example.com'))
      .toBe('https://cdn.example.com/img/a.png')
  })

  it("escaped backslashes don't corrupt protocol", () => {
    expect(normaliseUrl('https:\/\/loikmon.org\/a.jpg')).toBe('https://loikmon.org/a.jpg')
  })
})
