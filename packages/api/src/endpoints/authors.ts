import type { ApiResponse, Author } from '../types.js'
import { getClient } from '../client.js'

export const authors = {
  fetchAuthors: (params?: Record<string, unknown>) =>
    getClient().get<ApiResponse<{ authors: Author[] }>>('/authors/fetchauthors', { params }),

  getAuthor: (authorId: string | number) =>
    getClient().get<ApiResponse<{ author: Author }>>('/authors/getauthor', {
      params: { author_id: authorId },
    }),

  getAuthorData: (authorId: string | number) =>
    getClient().get<ApiResponse<{ author: Author }>>('/authors/get_author_data', {
      params: { author_id: authorId },
    }),

  followUnfollow: (authorId: string | number) =>
    getClient().post<ApiResponse<{ is_following: boolean }>>('/authors/follow_unfollow_author', {
      author_id: authorId,
    }),

  fetchAuthorCategories: () =>
    getClient().get<ApiResponse<{ categories: unknown[] }>>('/authors/fetchauthorcategories'),

  fetchAuthorInbox: () =>
    getClient().get<ApiResponse<{ messages: unknown[] }>>('/authors/fetch_author_inbox'),

  artistDashboard: (params?: Record<string, unknown>) =>
    getClient().get<ApiResponse<unknown>>('/authors/artistdashboard', { params }),

  artistFilterDashboard: (params: Record<string, unknown>) =>
    getClient().get<ApiResponse<unknown>>('/authors/artistfilterdashboard', { params }),

  editArtistApp: (data: Record<string, unknown>) =>
    getClient().post<ApiResponse<Author>>('/authors/editArtistApp', data),
}
