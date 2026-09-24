import { getClient } from '../client.js'
import type { BooksResponse } from '../types.js'

export const media = {
  /** Books that have audio chapters (audiobooks). */
  fetchAudioBooks: (page = 1, limit = 20) =>
    getClient().get<BooksResponse>('books', { params: { has_audio: true, page, limit, sort: 'latest' } }),
}
