import type { ApiResponse, Article } from '../types.js'
import { getClient } from '../client.js'

export const articles = {
  // page=0-indexed; optional: email, id(author), type, cat
  fetchArticles: (params?: Record<string, unknown>) =>
    getClient().post<any>('fetcharticles', params ?? {}),

  // Flutter: { articleid }
  getArticle: (id: string | number) =>
    getClient().post<any>('getarticle', { articleid: id }),

  // Flutter: { articleid }
  updateArticleTotalViews: (id: string | number) =>
    getClient().post<any>('update_article_total_views', { articleid: id }),

  // Flutter: { email, articleid, amount }
  purchaseArticle: (email: string, id: string | number, amount: number) =>
    getClient().post<any>('purchasearticle', { email, articleid: id, amount }),
}
