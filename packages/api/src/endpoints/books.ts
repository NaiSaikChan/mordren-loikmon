import type { ApiResponse, Book, BookChapter } from '../types.js'
import { getClient } from '../client.js'

export const books = {
  fetchBooks: (params?: Record<string, unknown>) =>
    getClient().get<ApiResponse<{ books: Book[] }>>('fetchbooks', { params }),

  fetchOtherBooks: (params?: Record<string, unknown>) =>
    getClient().get<ApiResponse<{ books: Book[] }>>('fetchotherbooks', { params }),

  getItem: (id: string | number) =>
    getClient().get<ApiResponse<{ book: Book }>>('getitem', { params: { id } }),

  getChapters: (bookId: string | number) =>
    getClient().get<ApiResponse<{ chapters: BookChapter[] }>>('getBookChapters', {
      params: { book_id: bookId },
    }),

  rateBook: (bookId: string | number, rating: number) =>
    getClient().post<ApiResponse<null>>('ratebook', { book_id: bookId, rating }),

  relatedBooks: (bookId: string | number) =>
    getClient().get<ApiResponse<{ books: Book[] }>>('relatedbooks', {
      params: { book_id: bookId },
    }),

  relatedMagazines: (bookId: string | number) =>
    getClient().get<ApiResponse<{ magazines: Book[] }>>('relatedmagazines', {
      params: { book_id: bookId },
    }),

  getBookViewsRates: (bookId: string | number) =>
    getClient().get<ApiResponse<{ views: number; rating: number }>>('getbookviewsrates', {
      params: { book_id: bookId },
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
    getClient().post<ApiResponse<null>>('subscribeBookCoupon', {
      code,
      book_id: bookId,
    }),
}
