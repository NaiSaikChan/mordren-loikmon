import { getClient } from '../client.js'

export const media = {
  // Leagues = music categories
  fetchLeagues: () =>
    getClient().post<any>('fetchleagues', {}),

  // Fetch books filtered by type (used for media/audio books)
  fetchMediaBooks: (page = 0, email?: string) =>
    getClient().post<any>('fetchbooks', {
      type: 'audio', page: String(page), ...(email ? { email } : {}),
    }),

  // Fetch other books (used in various media screens)
  fetchOtherBooks: (page = 0, email?: string) =>
    getClient().post<any>('fetchotherbooks', {
      page: String(page), ...(email ? { email } : {}),
    }),
}
