import type { ApiResponse } from '../types.js'
import { getClient } from '../client.js'

export interface Author {
  id: string | number
  name: string
  bio?: string
  avatar?: string
  avatar_url?: string
  books_count?: number
  is_following?: boolean
}

export const authors = {
  fetchAuthors: (params?: Record<string, unknown>) =>
    getClient().post<ApiResponse<{ authors: Author[] }>>('fetchauthors', params ?? {}),

  getAuthor: (id: string | number) =>
    getClient().post<ApiResponse<{ author: Author }>>('getauthor', { id }),

  fetchAuthorBooks: (authorId: string | number) =>
    getClient().post<ApiResponse<{ books: any[] }>>('fetchauthorbooks', { author_id: authorId }),

  followUnfollow: (id: string | number) =>
    getClient().post<ApiResponse<{ is_following: boolean }>>('followunfollow', { author_id: id }),
}
