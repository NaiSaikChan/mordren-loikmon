import { fixUrl, pickCover } from '@/lib/url'

describe('fixUrl', () => {
  it('returns empty string for nullish input', () => {
    expect(fixUrl(undefined)).toBe('')
    expect(fixUrl(null)).toBe('')
    expect(fixUrl('')).toBe('')
  })

  it('leaves absolute https URLs intact (aside from encoding)', () => {
    expect(fixUrl('https://loikmon.org/uploads/cover.jpg')).toBe(
      'https://loikmon.org/uploads/cover.jpg',
    )
  })

  it('prepends the origin for relative URLs', () => {
    expect(fixUrl('/uploads/cover.jpg')).toBe('https://loikmon.org/uploads/cover.jpg')
    expect(fixUrl('uploads/cover.jpg')).toBe('https://loikmon.org/uploads/cover.jpg')
  })

  it('converts backslashes to forward slashes', () => {
    expect(fixUrl('https:\\/\\/loikmon.org\\/a.jpg')).toBe('https://loikmon.org/a.jpg')
  })

  it('encodes regular spaces', () => {
    expect(fixUrl('https://loikmon.org/My Book.pdf')).toBe(
      'https://loikmon.org/My%20Book.pdf',
    )
  })

  it('encodes the narrow no-break space (U+202F)', () => {
    expect(fixUrl('https://loikmon.org/Screenshot\u202f2024.jpg')).toBe(
      'https://loikmon.org/Screenshot%E2%80%AF2024.jpg',
    )
  })
})

describe('pickCover', () => {
  it('prefers thumbnail then coverphoto then cover_url then cover', () => {
    expect(pickCover({ thumbnail: 'a.jpg', cover: 'b.jpg' })).toBe(
      'https://loikmon.org/a.jpg',
    )
    expect(pickCover({ coverphoto: 'c.jpg' })).toBe('https://loikmon.org/c.jpg')
    expect(pickCover({})).toBe('')
  })
})
