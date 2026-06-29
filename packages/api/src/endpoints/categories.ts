import { getClient } from '../client.js'

export const categories = {
  fetchCategories: () =>
    getClient().post<any>('fetchcategories', {}),

  // Flutter: { author, type:'book', page:0 }
  fetchAuthorCategories: (authorId: string | number, type = 'book', page = 0) =>
    getClient().post<any>('fetchauthorcategories', { author: authorId, type, page }),

  // Books filtered by category: cat + optional sub, page
  fetchBooksByCategory: (cat: string | number, sub?: string | number, page = 0) =>
    getClient().post<any>('fetchbooks', { cat, ...(sub ? { sub } : {}), page: String(page) }),
}
