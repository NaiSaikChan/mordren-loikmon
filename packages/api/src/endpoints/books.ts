import type { ApiResponse, Book, BookChapter } from '../types.js'
import { getClient } from '../client.js'

export const books = {
  fetchBooks: (params?: Record<string, unknown>) =>
    getClient().get<ApiResponse<{ books: Book[] }>>('/books/fetchbooks', { params }),

  fetchOtherBooks: (params?: Record<string, unknown>) =>
    getClient().get<ApiResponse<{ books: Book[] }>>('/books/fetchotherbooks', { params }),

  getItem: (id: string | number) =>
    getClient().get<ApiResponse<{ book: Book }>>('/books/getitem', { params: { id } }),

  getChapters: (bookId: string | number) =>
    getClient().get<ApiResponse<{ chapters: BookChapter[] }>>('/books/getBookChapters', {
      params: { book_id: bookId },
    }),

  rateBook: (bookId: string | number, rating: number) =>
    getClient().post<ApiResponse<null>>('/books/ratebook', { book_id: bookId, rating }),

  relatedBooks: (bookId: string | number) =>
    getClient().get<ApiResponse<{ books: Book[] }>>('/books/relatedbooks', {
      params: { book_id: bookId },
    }),

  relatedMagazines: (bookId: string | number) =>
    getClient().get<ApiResponse<{ magazines: Book[] }>>('/books/relatedmagazines', {
      params: { book_id: bookId },
    }),

  getBookViewsRates: (bookId: string | number) =>
    getClient().get<ApiResponse<{ views: number; rating: number }>>('/books/getbookviewsrates', {
      params: { book_id: bookId },
    }),

  updateTotalViews: (bookId: string | number) =>
    getClient().post<ApiResponse<null>>('/books/update_total_views', { book_id: bookId }),

  purchaseBook: (bookId: string | number, paymentData: Record<string, unknown>) =>
    getClient().post<ApiResponse<Purchase>>('/books/purchasebook', {
      book_id: bookId,
      ...paymentData,
    }),

  reportBook: (bookId: string | number, reason: string) =>
    getClient().post<ApiResponse<null>>('/books/reportbook', { book_id: bookId, reason }),

  redeemBookCoupon: (code: string, bookId: string | number) =>
    getClient().post<ApiResponse<null>>('/books/subscribeBookCoupon', {
      code,
      book_id: bookId,
    }),
}

// Avoid circular import — declare locally
interface Purchase { id: string | number; status: string }
