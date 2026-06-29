import type { ApiResponse, Book, BookChapter } from '../types.js'
import { getClient } from '../client.js'

export const books = {
  // page=0-indexed; optional: email, id(author), type, cat, sub
  fetchBooks: (params?: Record<string, unknown>) =>
    getClient().post<any>('fetchbooks', params ?? {}),

  fetchOtherBooks: (params?: Record<string, unknown>) =>
    getClient().post<any>('fetchotherbooks', params ?? {}),

  // Flutter: { type:'book', id }
  getItem: (id: string | number) =>
    getClient().post<any>('getitem', { type: 'book', id }),

  // Flutter: { bookid }
  getChapters: (bookId: string | number) =>
    getClient().post<any>('getBookChapters', { bookid: bookId }),

  // Flutter: { bookid, email? }
  relatedBooks: (bookId: string | number, email?: string) =>
    getClient().post<any>('relatedbooks', { bookid: bookId, ...(email ? { email } : {}) }),

  // Flutter: { bookid, rate, email? }
  rateBook: (bookId: string | number, rate: number, email?: string) =>
    getClient().post<any>('ratebook', { bookid: bookId, rate: String(rate), ...(email ? { email } : {}) }),

  // Flutter: { bookid }
  updateTotalViews: (bookId: string | number) =>
    getClient().post<any>('update_total_views', { bookid: bookId }),

  // Flutter: { email, bookid, amount }
  purchaseBook: (email: string, bookId: string | number, amount: number) =>
    getClient().post<any>('purchasebook', { email, bookid: bookId, amount }),

  // Flutter: { email, code, book_id }
  redeemCoupon: (email: string, code: string, bookId: string | number) =>
    getClient().post<any>('subscribeBookCoupon', { email, code, book_id: bookId }),
}
