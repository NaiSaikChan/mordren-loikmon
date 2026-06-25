import type { ApiResponse, Book, Article } from '../types.js'
import { getClient } from '../client.js'
import type { Author } from './authors.js'

export interface SearchResults {
  books?: Book[]
  articles?: Article[]
  authors?: Author[]
}

export const search = {
  search: (query: string, params?: Record<string, unknown>) =>
    getClient().post<ApiResponse<SearchResults>>('search', { keyword: query, ...params }),
}
