import type { ApiResponse, Review, Reply } from '../types.js'
import { getClient } from '../client.js'

export const reviews = {
  submitReview: (data: { book_id?: string | number; article_id?: string | number; rating?: number; comment: string }) =>
    getClient().post<ApiResponse<Review>>('/reviews/submitreview', data),

  editReview: (reviewId: string | number, data: Partial<Review>) =>
    getClient().post<ApiResponse<Review>>('/reviews/editreview', { review_id: reviewId, ...data }),

  deleteReview: (reviewId: string | number) =>
    getClient().post<ApiResponse<null>>('/reviews/deletereview', { review_id: reviewId }),

  loadReviews: (params: { book_id?: string | number; article_id?: string | number }) =>
    getClient().get<ApiResponse<{ reviews: Review[] }>>('/reviews/loadreviews', { params }),

  loadRecentReviews: (params?: Record<string, unknown>) =>
    getClient().get<ApiResponse<{ reviews: Review[] }>>('/reviews/loadrecentreviews', { params }),

  loadUserReview: (params: { book_id?: string | number; article_id?: string | number }) =>
    getClient().get<ApiResponse<{ review: Review | null }>>('/reviews/loaduserreview', { params }),

  replyComment: (reviewId: string | number, content: string) =>
    getClient().post<ApiResponse<Reply>>('/reviews/replycomment', {
      review_id: reviewId,
      content,
    }),

  editReply: (replyId: string | number, content: string) =>
    getClient().post<ApiResponse<Reply>>('/reviews/editreply', { reply_id: replyId, content }),

  deleteReply: (replyId: string | number) =>
    getClient().post<ApiResponse<null>>('/reviews/deletereply', { reply_id: replyId }),

  loadReplies: (reviewId: string | number) =>
    getClient().get<ApiResponse<{ replies: Reply[] }>>('/reviews/loadreplies', {
      params: { review_id: reviewId },
    }),

  reportComment: (reviewId: string | number, reason: string) =>
    getClient().post<ApiResponse<null>>('/reviews/reportcomment', {
      review_id: reviewId,
      reason,
    }),
}
