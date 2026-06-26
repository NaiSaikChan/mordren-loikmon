import type { ApiResponse, Book, BookChapter } from '../types.js'
import { getClient } from '../client.js'

export const books = {
  fetchBooks: (params?: Record<string, unknown>) =>
    getClient().post<ApiResponse<{ books: Book[] }>>('fetchbooks', params ?? {}),

  fetchOtherBooks: (params?: Record<string, unknown>) =>
    getClient().post<ApiResponse<{ books: Book[] }>>('fetchotherbooks', params ?? {}),

  // Flutter sends { type: "book", id }
  getItem: (id: string | number) =>
    getClient().post<ApiResponse<{ book: Book }>>('getitem', { type: 'book', id }),

  getChapters: (bookId: string | number) =>
    getClient().post<ApiResponse<{ chapters: BookChapter[] }>>('getBookChapters', {
      book_id: bookId,
    }),

  rateBook: (bookId: string | number, rating: number) =>
    getClient().post<ApiResponse<null>>('ratebook', { book_id: bookId, rating }),

  relatedBooks: (bookId: string | number) =>
    getClient().post<ApiResponse<{ books: Book[] }>>('relatedbooks', { book_id: bookId }),

  relatedMagazines: (bookId: string | number) =>
    getClient().post<ApiResponse<{ magazines: Book[] }>>('relatedmagazines', { book_id: bookId }),

  getBookViewsRates: (bookId: string | number) =>
    getClient().post<ApiResponse<{ views: number; rating: number }>>('getbookviewsrates', {
      book_id: bookId,
    }),

  updateTotalViews: (bookId: string | number) =>
    getClient().post<ApiResponse<null>>('update_total_views', { book_id: bookId }),

  purchaseBook: (bookId: string | number, paymentData: Record<string, unknown>) =>
    getClient().post<ApiResponse<{ id: string | number; status: string }>>('purchasebook', {
      book_id: bookId,
      ...paymentData,
    }),

  reportBook: (bookId: string | number, reason: string) =>
    getClient().post<ApiResponse<null>>('reportbook', { book_id: bookId, reason }),

  redeemBookCoupon: (code: string, bookId: string | number) =>
    getClient().post<ApiResponse<null>>('subscribeBookCoupon', { code, book_id: bookId }),
}
