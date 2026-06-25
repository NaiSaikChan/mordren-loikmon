import type { ApiResponse } from '../types.js'
import { getClient } from '../client.js'

export const purchases = {
  fetchUserPurchases: (params?: Record<string, unknown>) =>
    getClient().post<ApiResponse<{ purchases: any[] }>>('fetchuserpurchases', params ?? {}),

  fetchUserPurchasedBooks: (params?: Record<string, unknown>) =>
    getClient().post<ApiResponse<{ books: any[] }>>('fetchuserpurchasedbooks', params ?? {}),

  fetchUserPurchasedArticles: (params?: Record<string, unknown>) =>
    getClient().post<ApiResponse<{ articles: any[] }>>('fetchuserpurchasedarticles', params ?? {}),
}
