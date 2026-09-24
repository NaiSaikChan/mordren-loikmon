import type { Article, Book, Category, Pagination } from '@loikmon/api'
import { appendUnique } from './normalize'

/** Pages are 1-based on the backend. */
export const FIRST_PAGE = 1

export interface PageState<T> {
  items: T[]
  /** Last page loaded (0 = nothing loaded yet). */
  page: number
  hasMore: boolean
}

export function initialPageState<T>(): PageState<T> {
  return { items: [], page: 0, hasMore: true }
}

/**
 * Merge a fetched page into the list state.
 * Page 1 replaces the list (initial load / pull-to-refresh); later pages append
 * without duplicates. `has_more` from the backend decides whether to keep paging.
 */
export function applyPage<T extends { id: unknown }>(
  state: PageState<T>,
  page: number,
  items: T[],
  pagination: Pick<Pagination, 'has_more'> | null | undefined,
): PageState<T> {
  const merged = page <= FIRST_PAGE ? items : appendUnique(state.items, items)
  return {
    items: merged,
    page,
    // Endpoints without a pagination block return everything at once.
    hasMore: Boolean(pagination?.has_more),
  }
}

/** The page to request next, or null when the list is complete. */
export function nextPage(state: PageState<unknown>): number | null {
  if (state.page === 0) return FIRST_PAGE
  return state.hasMore ? state.page + 1 : null
}

// ── Category detail (books + articles paginated together) ───────────────

export interface CategoryPageState {
  category: Category | null
  books: Book[]
  articles: Article[]
  booksTotal: number
  articlesTotal: number
  page: number
}

export const emptyCategoryState: CategoryPageState = {
  category: null,
  books: [],
  articles: [],
  booksTotal: 0,
  articlesTotal: 0,
  page: 0,
}

/** Merge one `categories.getCategory` page (books and articles are paginated together). */
export function applyCategoryPage(
  prev: CategoryPageState,
  page: number,
  data: { category: Category; books: Book[]; articles: Article[]; books_total: number; articles_total: number },
): CategoryPageState {
  const first = page <= 1
  return {
    category: data.category,
    books: first ? data.books : appendUnique(prev.books, data.books),
    articles: first ? data.articles : appendUnique(prev.articles, data.articles),
    booksTotal: data.books_total,
    articlesTotal: data.articles_total,
    page,
  }
}

export function categoryHasMore(state: CategoryPageState): boolean {
  return state.page > 0 && (state.books.length < state.booksTotal || state.articles.length < state.articlesTotal)
}
