import type { ApiResponse, Book, Article, Author } from '../types.js'
import { getClient } from '../client.js'

export interface SearchResults {
  books?: Book[]
  articles?: Article[]
  authors?: Author[]
}

export const search = {
  // Flutter sends: { query, type (0=books,1=articles), offset }
  // Response key is 'search', not 'data'
  search: (query: string, type = 0, offset = 0) =>
    getClient().post<any>('search', { query, type, offset }),
}
