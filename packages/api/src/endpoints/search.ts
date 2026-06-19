import type { ApiResponse, Book, Article, Author } from '../types.js'
import { getClient } from '../client.js'

export interface SearchResults {
  books?: Book[]
  articles?: Article[]
  authors?: Author[]
}

export const search = {
  search: (query: string, params?: Record<string, unknown>) =>
    getClient().get<ApiResponse<SearchResults>>('search', { params: { q: query, ...params } }),
}
