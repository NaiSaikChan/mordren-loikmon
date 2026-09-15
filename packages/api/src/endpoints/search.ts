import { getClient } from '../client.js'
import type { SearchResults } from '../types.js'

export const search = {
  search: (q: string, options: { type?: 'all' | 'book' | 'article' | 'author'; page?: number; limit?: number } = {}) =>
    getClient().get<SearchResults>('search', { params: { q, type: options.type ?? 'all', page: options.page ?? 1, limit: options.limit ?? 20 } }),
}
