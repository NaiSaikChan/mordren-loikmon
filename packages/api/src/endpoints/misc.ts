import type { ApiResponse } from '../types.js'
import { getClient } from '../client.js'

export const misc = {
  fetchCollections: (params?: Record<string, unknown>) =>
    getClient().post<ApiResponse<{ collections: any[] }>>('fetchcollections', params ?? {}),

  getCollection: (id: string | number) =>
    getClient().post<ApiResponse<{ collection: any }>>('getcollection', { id }),

  fetchLeagues: (params?: Record<string, unknown>) =>
    getClient().post<ApiResponse<{ leagues: any[] }>>('fetchleagues', params ?? {}),

  fetchNotifications: (params?: Record<string, unknown>) =>
    getClient().post<ApiResponse<{ notifications: any[] }>>('fetchnotifications', params ?? {}),

  fetchFaqs: (params?: Record<string, unknown>) =>
    getClient().post<ApiResponse<{ faqs: any[] }>>('fetchfaqs', params ?? {}),

  discover: (params?: Record<string, unknown>) =>
    getClient().post<ApiResponse<any>>('discover', params ?? {}),

  overview: (params?: Record<string, unknown>) =>
    getClient().post<ApiResponse<any>>('overview', params ?? {}),
}
