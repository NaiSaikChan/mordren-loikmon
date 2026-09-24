import { fixUrl, isSignedUrl, pickCover } from '@/lib/url'

describe('fixUrl', () => {
  it('returns empty string for nullish input', () => {
    expect(fixUrl(undefined)).toBe('')
    expect(fixUrl(null)).toBe('')
    expect(fixUrl('')).toBe('')
  })

  it('leaves absolute https URLs intact', () => {
    expect(fixUrl('https://loikmon.org/uploads/cover.jpg')).toBe('https://loikmon.org/uploads/cover.jpg')
  })

  it('prepends the origin for legacy relative URLs', () => {
    expect(fixUrl('/uploads/cover.jpg')).toBe('https://loikmon.org/uploads/cover.jpg')
    expect(fixUrl('uploads/cover.jpg')).toBe('https://loikmon.org/uploads/cover.jpg')
  })

  it('converts JSON-escaped slashes', () => {
    expect(fixUrl('https:\\/\\/loikmon.org\\/a.jpg')).toBe('https://loikmon.org/a.jpg')
  })

  it('encodes regular spaces', () => {
    expect(fixUrl('https://loikmon.org/My Book.pdf')).toBe('https://loikmon.org/My%20Book.pdf')
  })

  it('encodes the narrow no-break space (U+202F)', () => {
    expect(fixUrl('https://loikmon.org/Screenshot\u202f2024.jpg')).toBe('https://loikmon.org/Screenshot%E2%80%AF2024.jpg')
  })

  it('never re-encodes a signed MinIO/S3 URL', () => {
    const signed =
      'https://s3.loikmon.org/loikmon-private/books/2026-09/abc%20def.epub' +
      '?X-Amz-Algorithm=AWS4-HMAC-SHA256' +
      '&X-Amz-Credential=minio%2F20260915%2Fus-east-1%2Fs3%2Faws4_request' +
      '&X-Amz-Date=20260915T070000Z&X-Amz-Expires=900&X-Amz-SignedHeaders=host' +
      "&response-content-disposition=inline%3B%20filename%2A%3DUTF-8%27%27%E1%80%99%E1%80%94%E1%80%BA%2520book.epub" +
      '&X-Amz-Signature=5f0e3c1b2a4d6e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f'
    expect(fixUrl(signed)).toBe(signed)
    expect(isSignedUrl(signed)).toBe(true)
  })

  it('keeps signed audio URLs with local dev hosts intact', () => {
    const signed = 'http://10.0.2.2:9000/private/audio/ch1.mp3?X-Amz-Expires=3600&X-Amz-Signature=abc123'
    expect(fixUrl(signed)).toBe(signed)
  })

  it('does not prefix local file/content URIs', () => {
    expect(fixUrl('file:///data/user/0/org.loikmon.mobile/cache/epubs/book-1-epub.epub')).toBe(
      'file:///data/user/0/org.loikmon.mobile/cache/epubs/book-1-epub.epub',
    )
  })
})

describe('isSignedUrl', () => {
  it('is false for public URLs', () => {
    expect(isSignedUrl('https://s3.loikmon.org/public/covers/a.jpg')).toBe(false)
    expect(isSignedUrl(null)).toBe(false)
  })
})

describe('pickCover', () => {
  it('prefers thumbnail then cover_url then coverphoto', () => {
    expect(pickCover({ thumbnail: 'a.jpg', cover_url: 'b.jpg' })).toBe('https://loikmon.org/a.jpg')
    expect(pickCover({ thumbnail: null, cover_url: 'https://cdn.loikmon.org/c.jpg' })).toBe('https://cdn.loikmon.org/c.jpg')
    expect(pickCover({ coverphoto: 'd.jpg' })).toBe('https://loikmon.org/d.jpg')
    expect(pickCover({})).toBe('')
  })
})
