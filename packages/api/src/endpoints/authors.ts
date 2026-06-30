import { getClient } from '../client.js'

export const authors = {
  // Fetch all authors with proper body format
  fetchAuthors: (params?: Record<string, unknown>) =>
    getClient().post<any>('fetchauthors', {
      type: 'book',
      page: String(params?.page ?? '0'),
      query: String(params?.query ?? ''),
      email: String(params?.email ?? ''),
    }),

  // Flutter: { author }
  getAuthorData: (id: string | number, email?: string) =>
    getClient().post<any>('get_author_data', { author: id, email: email || ''}),

  // Alias kept for store compatibility
  getAuthor: (id: string | number, email?: string) =>
    getClient().post<any>('get_author_data', { author: id, email: email || ''}),

  followUnfollow: (authorId: string | number, email?: string) =>
    getClient().post<any>('followunfollow', { author: authorId, ...(email ? { email } : {}) }),
}
