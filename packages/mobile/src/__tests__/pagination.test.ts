import type { Article, Book, Category } from '@loikmon/api'
import {
  FIRST_PAGE,
  applyCategoryPage,
  applyPage,
  categoryHasMore,
  emptyCategoryState,
  initialPageState,
  nextPage,
} from '@/lib/pagination'

const item = (id: number) => ({ id })

describe('applyPage / nextPage (1-based pagination)', () => {
  it('starts at page 1', () => {
    expect(FIRST_PAGE).toBe(1)
    expect(nextPage(initialPageState())).toBe(1)
  })

  it('page 1 replaces, later pages append without duplicates', () => {
    let state = applyPage(initialPageState<{ id: number }>(), 1, [item(1), item(2)], { has_more: true })
    expect(nextPage(state)).toBe(2)
    state = applyPage(state, 2, [item(2), item(3)], { has_more: false })
    expect(state.items.map((x) => x.id)).toEqual([1, 2, 3])
    expect(nextPage(state)).toBeNull()

    const refreshed = applyPage(state, 1, [item(9)], { has_more: true })
    expect(refreshed.items.map((x) => x.id)).toEqual([9])
  })

  it('stops when the endpoint has no pagination block', () => {
    expect(applyPage(initialPageState<{ id: number }>(), 1, [item(1)], undefined).hasMore).toBe(false)
  })
})

describe('applyCategoryPage (server-side category filtering)', () => {
  const category = { id: 29, name: 'ဇာတ်' } as Category
  const books = (ids: number[]) => ids.map((id) => ({ id }) as Book)
  const articles = (ids: number[]) => ids.map((id) => ({ id }) as Article)

  it('merges books and articles pages and tracks totals', () => {
    let state = applyCategoryPage(emptyCategoryState, 1, {
      category,
      books: books([1, 2]),
      articles: articles([10]),
      books_total: 3,
      articles_total: 1,
    })
    expect(categoryHasMore(state)).toBe(true)

    state = applyCategoryPage(state, 2, { category, books: books([2, 3]), articles: [], books_total: 3, articles_total: 1 })
    expect(state.books.map((b) => b.id)).toEqual([1, 2, 3])
    expect(state.articles.map((a) => a.id)).toEqual([10])
    expect(state.page).toBe(2)
    expect(categoryHasMore(state)).toBe(false)
  })

  it('has nothing more before the first page loads', () => {
    expect(categoryHasMore(emptyCategoryState)).toBe(false)
  })
})
