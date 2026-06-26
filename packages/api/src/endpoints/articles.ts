import type { ApiResponse, Article } from '../types.js'
import { getClient } from '../client.js'

export const articles = {
  fetchArticles: (params?: Record<string, unknown>) =>
    getClient().post<ApiResponse<{ articles: Article[] }>>('fetcharticles', params ?? {}),

  // Flutter uses 'articleid' key, not 'id'
  getArticle: (id: string | number) =>
    getClient().post<ApiResponse<{ article: Article }>>('getarticle', { articleid: id }),

  likeArticle: (id: string | number) =>
    getClient().post<ApiResponse<null>>('likearticle', { id }),

  purchaseArticle: (id: string | number, paymentData: Record<string, unknown>) =>
    getClient().post<ApiResponse<null>>('purchasearticle', { article_id: id, ...paymentData }),
}
