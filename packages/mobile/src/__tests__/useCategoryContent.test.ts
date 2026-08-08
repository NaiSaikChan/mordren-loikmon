/**
 * Tests for the categoryFilter utilities and useCategoryContent API contract.
 * Uses pure-function tests (no react-test-renderer) to match the project's
 * existing test style.
 */
import { matchesCategory, deduplicateById } from '@/lib/categoryFilter'
import { parseBooks, parseArticles } from '@/lib/normalize'

const mockFetchBooks = jest.fn()
const mockFetchArticles = jest.fn()

jest.mock('@loikmon/api', () => ({
  books: { fetchBooks: (...args: unknown[]) => mockFetchBooks(...args) },
  articles: { fetchArticles: (...args: unknown[]) => mockFetchArticles(...args) },
}))

const book = (id: number, category: string) => ({ id, title: `Book ${id}`, category })
const article = (id: number, category: string) => ({ id, title: `Article ${id}`, category })

// ── matchesCategory ───────────────────────────────────────────────────────
describe('matchesCategory', () => {
  it('matches when category string equals targetId', () => {
    expect(matchesCategory({ category: '29' }, '29')).toBe(true)
  })
  it('coerces numeric category to string', () => {
    expect(matchesCategory({ category: 29 }, '29')).toBe(true)
  })
  it('rejects different categories', () => {
    expect(matchesCategory({ category: '38' }, '29')).toBe(false)
  })
  it('rejects items with no category field', () => {
    expect(matchesCategory({}, '29')).toBe(false)
    expect(matchesCategory({ category: undefined }, '29')).toBe(false)
  })
})

// ── deduplicateById ───────────────────────────────────────────────────────
describe('deduplicateById', () => {
  it('keeps first occurrence of each id', () => {
    const result = deduplicateById([book(1, '29'), book(1, '29'), book(2, '29')])
    expect(result).toHaveLength(2)
    expect(result.map((b) => b.id)).toEqual([1, 2])
  })
  it('handles empty array', () => {
    expect(deduplicateById([])).toEqual([])
  })
  it('treats string and numeric ids as equal', () => {
    expect(deduplicateById([{ id: '5', title: 'A' }, { id: 5, title: 'B' }])).toHaveLength(1)
  })
})

// ── Combined filtering pipeline (mirrors useCategoryContent logic) ────────
describe('category content filtering pipeline', () => {
  beforeEach(() => jest.clearAllMocks())

  it('filters and deduplicates books from multiple API pages', async () => {
    mockFetchBooks
      .mockResolvedValueOnce({ data: { books: [book(1, '29'), book(2, '33')] } })
      .mockResolvedValueOnce({ data: { books: [book(1, '29'), book(3, '29')] } }) // book 1 is a dupe
      .mockResolvedValueOnce({ data: { books: [] } })

    const pages = await Promise.all(
      [0, 1, 2].map((p) =>
        mockFetchBooks({ category: '29', page: String(p) }).then((r: any) => parseBooks(r.data)),
      ),
    )
    const filtered = pages.flat().filter((b) => matchesCategory(b as any, '29'))
    const result = deduplicateById(filtered)

    expect(result).toHaveLength(2)
    expect(result.map((b) => b.id)).toEqual([1, 3])
  })

  it('filters articles to the requested category', async () => {
    mockFetchArticles.mockResolvedValue({
      data: { articles: [article(10, '29'), article(11, '38')] },
    })
    const res = await mockFetchArticles({ category: '29', page: '0' })
    const filtered = parseArticles(res.data).filter((a) => matchesCategory(a as any, '29'))
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe(10)
  })

  it('returns empty when nothing matches the category', async () => {
    mockFetchBooks.mockResolvedValue({ data: { books: [book(1, '38')] } })
    const res = await mockFetchBooks({ category: '29', page: '0' })
    const filtered = parseBooks(res.data).filter((b) => matchesCategory(b as any, '29'))
    expect(filtered).toHaveLength(0)
  })

  it('tolerates a failed API page while collecting the rest', async () => {
    mockFetchBooks
      .mockResolvedValueOnce({ data: { books: [book(1, '29')] } })
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ data: { books: [book(2, '29')] } })

    const settled = await Promise.allSettled(
      [0, 1, 2].map((p) =>
        mockFetchBooks({ category: '29', page: String(p) }).then((r: any) => parseBooks(r.data)),
      ),
    )
    const all = settled
      .filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled')
      .flatMap((r) => r.value)
    const result = deduplicateById(all.filter((b) => matchesCategory(b as any, '29')))
    expect(result).toHaveLength(2)
  })
})
