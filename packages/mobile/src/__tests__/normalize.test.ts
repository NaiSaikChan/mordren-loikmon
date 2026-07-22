import {
  parseBooks,
  parseArticles,
  parseAuthors,
  parseBookDetail,
  parseTotal,
  isFree,
} from '@/lib/normalize'

describe('parseBooks', () => {
  it('handles a bare array', () => {
    expect(parseBooks([{ id: 1, title: 'A' }])).toHaveLength(1)
  })
  it('handles { books: [...] }', () => {
    expect(parseBooks({ books: [{ id: 1, title: 'A' }] })).toHaveLength(1)
  })
  it('handles nested { data: { books } }', () => {
    expect(parseBooks({ data: { books: [{ id: 1, title: 'A' }] } })).toHaveLength(1)
  })
  it('returns [] for unexpected shapes', () => {
    expect(parseBooks(null)).toEqual([])
    expect(parseBooks({ foo: 'bar' })).toEqual([])
  })
})

describe('parseArticles / parseAuthors', () => {
  it('parses articles from wrapper', () => {
    expect(parseArticles({ articles: [{ id: 1, title: 'x' }] })).toHaveLength(1)
  })
  it('parses authors from wrapper', () => {
    expect(parseAuthors({ authors: [{ id: 1, name: 'x' }] })).toHaveLength(1)
  })
})

describe('parseBookDetail', () => {
  it('reads book from top-level or data', () => {
    expect(parseBookDetail({ book: { id: 1, title: 'A' } })?.id).toBe(1)
    expect(parseBookDetail({ data: { book: { id: 2, title: 'B' } } })?.id).toBe(2)
    expect(parseBookDetail({})).toBeNull()
  })
})

describe('parseTotal', () => {
  it('coerces total/count fields to number', () => {
    expect(parseTotal({ total: '42' })).toBe(42)
    expect(parseTotal({ count: 7 })).toBe(7)
    expect(parseTotal({})).toBe(0)
  })
})

describe('isFree', () => {
  it('treats missing/zero price as free', () => {
    expect(isFree({})).toBe(true)
    expect(isFree({ price: 0 })).toBe(true)
    expect(isFree({ amount: '0' })).toBe(true)
    expect(isFree({ is_free: true, amount: 100 })).toBe(true)
  })
  it('treats a positive price as paid', () => {
    expect(isFree({ amount: 100 })).toBe(false)
    expect(isFree({ price: '50' })).toBe(false)
  })
})
