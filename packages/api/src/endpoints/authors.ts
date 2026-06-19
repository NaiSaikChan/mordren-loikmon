import type { ApiResponse, Author } from '../types.js'
import { getClient } from '../client.js'

export const authors = {
  fetchAuthors: (params?: Record<string, unknown>) =>
    getClient().get<ApiResponse<{ authors: Author[] }>>('fetchauthors', { params }),

  getAuthor: (authorId: string | number) =>
    getClient().get<ApiResponse<{ author: Author }>>('getauthor', {
      params: { author_id: authorId },
    }),

  getAuthorData: (authorId: string | number) =>
    getClient().get<ApiResponse<{ author: Author }>>('get_author_data', {
      params: { author_id: authorId },
    }),

  followUnfollow: (authorId: string | number) =>
    getClient().post<ApiResponse<{ is_following: boolean }>>('follow_unfollow_author', {
      author_id: authorId,
    }),

  fetchAuthorCategories: () =>
    getClient().get<ApiResponse<{ categories: unknown[] }>>('fetchauthorcategories'),

  fetchAuthorInbox: () =>
    getClient().get<ApiResponse<{ messages: unknown[] }>>('fetch_author_inbox'),

  artistDashboard: (params?: Record<string, unknown>) =>
    getClient().get<ApiResponse<unknown>>('artistdashboard', { params }),

  artistFilterDashboard: (params: Record<string, unknown>) =>
    getClient().get<ApiResponse<unknown>>('artistfilterdashboard', { params }),

  editArtistApp: (data: Record<string, unknown>) =>
    getClient().post<ApiResponse<Author>>('editArtistApp', data),
}
