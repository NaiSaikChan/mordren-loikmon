import { getClient } from '../client.js'
import type { Id, ItemType, Review, ReviewsResponse } from '../types.js'

export const reviews = {
  /** Reviews for a book or article, plus the viewer's own review and the rating summary. */
  loadReviews: (itemType: ItemType, itemId: Id | string, page = 1, limit = 20) =>
    getClient().get<ReviewsResponse>('reviews', { params: { item_type: itemType, item_id: itemId, page, limit } }),

  /** Creates the viewer's review, or updates it when one already exists. Plain text (no base64). */
  submitReview: (data: { item_type: ItemType; item_id: Id; rating: number; content?: string | null }) =>
    getClient().post<{ status: 'ok'; review: Pick<Review, 'id' | 'rating' | 'content' | 'username' | 'created_at'> }>('reviews', {
      ...data,
      item_id: Number(data.item_id),
      content: data.content ?? null,
    }),

  deleteReview: (id: Id | string) => getClient().delete<{ status: 'ok' }>(`reviews/${id}`),
}
