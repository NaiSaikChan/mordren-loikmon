import type { ApiResponse, Article } from '../types.js'
import { getClient } from '../client.js'

export const articles = {
  fetchArticles: (params?: Record<string, unknown>) =>
    getClient().get<ApiResponse<{ articles: Article[] }>>('/articles/fetcharticles', { params }),

  purchaseArticle: (articleId: string | number, paymentData: Record<string, unknown>) =>
    getClient().post<ApiResponse<null>>('/articles/purchasearticle', {
      article_id: articleId,
      ...paymentData,
    }),

  updateArticleViews: (articleId: string | number) =>
    getClient().post<ApiResponse<null>>('/articles/update_article_total_views', {
      article_id: articleId,
    }),
}
