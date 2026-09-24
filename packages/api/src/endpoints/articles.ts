import { getClient } from '../client.js'
import type { ArticleDetail, ArticlesResponse, Id } from '../types.js'

export interface ArticleQuery {
  page?: number
  limit?: number
  q?: string
  category?: Id
  author?: Id
  free?: boolean
  sort?: 'latest' | 'popular'
}

export const articles = {
  /** Paginated list without article bodies. */
  fetchArticles: (params: ArticleQuery = {}) => getClient().get<ArticlesResponse>('articles', { params }),

  /** Article with `content` and `audio_url` when the viewer has access, otherwise `locked: true`. */
  getArticle: (id: Id | string) => getClient().get<{ status: 'ok'; article: ArticleDetail }>(`articles/${id}`),

  updateArticleTotalViews: (id: Id | string) => getClient().post<void>(`articles/${id}/views`),
}
