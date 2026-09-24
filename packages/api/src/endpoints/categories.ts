import { getClient } from '../client.js'
import type { Article, Book, Category, Id } from '../types.js'

type CategoryDetailResponse = {
  status: 'ok'
  category: Category
  books: Book[]
  articles: Article[]
  books_total: number
  articles_total: number
}

export const categories = {
  /** Categories usable for `type` ('book' | 'article'); omit to get all. */
  fetchCategories: (type?: 'book' | 'article') =>
    getClient().get<{ status: 'ok'; categories: Category[] }>('categories', { params: type ? { type } : undefined }),

  /** Category with its books and articles (paginated together). */
  getCategory: (id: Id | string, params: { page?: number; limit?: number } = {}) =>
    getClient().get<CategoryDetailResponse>(`categories/${id}`, { params }),
}
