import { getClient } from '../client.js'

export const authors = {
  // Flutter: { page:'0' }
  fetchAuthors: (params?: Record<string, unknown>) =>
    getClient().post<any>('fetchauthors', params ?? {}),

  // Flutter: { author_id }
  getAuthorData: (id: string | number) =>
    getClient().post<any>('get_author_data', { author_id: id }),

  // Alias kept for store compatibility
  getAuthor: (id: string | number) =>
    getClient().post<any>('get_author_data', { author_id: id }),

  followUnfollow: (authorId: string | number, email?: string) =>
    getClient().post<any>('followunfollow', { author_id: authorId, ...(email ? { email } : {}) }),
}
