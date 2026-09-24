import { getClient } from '../client.js'
import type { Book, BookDetail, BookFileResponse, BooksResponse, ChaptersResponse, Id, ReadingProgress } from '../types.js'

export interface BookQuery {
  page?: number
  limit?: number
  q?: string
  category?: Id
  subcategory?: Id
  author?: Id
  free?: boolean
  has_audio?: boolean
  recommended?: boolean
  top?: boolean
  sort?: 'latest' | 'popular' | 'rating' | 'title'
}

export const books = {
  /** Paginated list (1-based `page`). */
  fetchBooks: (params: BookQuery = {}) => getClient().get<BooksResponse>('books', { params }),

  getBook: (id: Id | string) => getClient().get<{ status: 'ok'; book: BookDetail }>(`books/${id}`),

  /** @deprecated alias of getBook */
  getItem: (id: Id | string) => getClient().get<{ status: 'ok'; book: BookDetail }>(`books/${id}`),

  /** Up to 12 books from the same author or category (not paginated). */
  relatedBooks: (id: Id | string) => getClient().get<{ status: 'ok'; books: Book[] }>(`books/${id}/related`),

  /**
   * Signed, short-lived URL of the PDF or EPUB. Rejects with
   * LOGIN_REQUIRED (401) or SUBSCRIPTION_REQUIRED (403) when the viewer has no access.
   */
  getFileUrl: (id: Id | string, format?: 'pdf' | 'epub') =>
    getClient().get<BookFileResponse>(`books/${id}/file`, { params: format ? { format } : undefined }),

  /** Audio chapters. Locked chapters come without `audio_url`. */
  getChapters: (id: Id | string) => getClient().get<ChaptersResponse>(`books/${id}/chapters`),

  /** @deprecated alias of getChapters */
  getAudioChapters: (id: Id | string) => getClient().get<ChaptersResponse>(`books/${id}/chapters`),

  updateTotalViews: (id: Id | string) => getClient().post<void>(`books/${id}/views`),

  getProgress: (id: Id | string) => getClient().get<{ status: 'ok'; progress: ReadingProgress[] }>(`books/${id}/progress`),

  saveProgress: (id: Id | string, progress: { format: 'pdf' | 'epub' | 'audio'; location: string | null; progress: number }) =>
    getClient().put<{ status: 'ok' }>(`books/${id}/progress`, progress),
}
