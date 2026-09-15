import { appendUnique, firstParam, hasMorePages, listOf, stripHtml, uniqueById } from '@/lib/normalize'

describe('listOf', () => {
  it('returns arrays unchanged and [] otherwise', () => {
    expect(listOf([1, 2])).toEqual([1, 2])
    expect(listOf(null)).toEqual([])
    expect(listOf(undefined)).toEqual([])
  })
})

describe('uniqueById / appendUnique', () => {
  it('keeps the first occurrence of each id', () => {
    expect(uniqueById([{ id: 1, v: 'a' }, { id: 1, v: 'b' }, { id: 2, v: 'c' }]).map((x) => x.v)).toEqual(['a', 'c'])
  })

  it('treats string and numeric ids as equal', () => {
    expect(uniqueById([{ id: '5' }, { id: 5 }])).toHaveLength(1)
  })

  it('appends a page without duplicating items that shifted between pages', () => {
    expect(appendUnique([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }]).map((x) => x.id)).toEqual([1, 2, 3])
  })
})

describe('hasMorePages', () => {
  it('reads pagination.has_more', () => {
    expect(hasMorePages({ has_more: true })).toBe(true)
    expect(hasMorePages({ has_more: false })).toBe(false)
    expect(hasMorePages(undefined)).toBe(false)
  })
})

describe('firstParam', () => {
  it('normalises expo-router params', () => {
    expect(firstParam('12')).toBe('12')
    expect(firstParam(['7', '8'])).toBe('7')
    expect(firstParam('')).toBeUndefined()
    expect(firstParam(undefined)).toBeUndefined()
  })
})

describe('stripHtml', () => {
  it('removes scripts, styles and tags, keeping paragraph breaks', () => {
    expect(stripHtml('<style>p{}</style><p>Hello&nbsp;<b>Mon</b></p><script>alert(1)</script><p>World</p>')).toBe('Hello Mon\nWorld')
  })

  it('handles null', () => {
    expect(stripHtml(null)).toBe('')
  })
})
