import type { ApiResponse, FaqItem, InboxMessage, Collection, SearchResult, AppInitData, Country } from '../types.js'
import { getClient } from '../client.js'

export const misc = {
  initApp: () =>
    getClient().get<ApiResponse<AppInitData>>('/misc/initapp'),

  overview: () =>
    getClient().get<ApiResponse<unknown>>('/misc/overview'),

  search: (query: string, params?: Record<string, unknown>) =>
    getClient().get<ApiResponse<SearchResult>>('/misc/search', { params: { q: query, ...params } }),

  fetchFaqs: () =>
    getClient().get<ApiResponse<{ faqs: FaqItem[] }>>('/misc/fetchfaqs'),

  fetchContactUs: () =>
    getClient().get<ApiResponse<unknown>>('/misc/fetchcontactus'),

  loadCountries: () =>
    getClient().get<ApiResponse<{ countries: Country[] }>>('/misc/loadcountries'),

  fetchInbox: () =>
    getClient().get<ApiResponse<{ messages: InboxMessage[] }>>('/misc/fetch_inbox'),

  fetchCollections: () =>
    getClient().get<ApiResponse<{ collections: Collection[] }>>('/misc/fetch_collections'),

  fetchSingleCollection: (id: string | number) =>
    getClient().get<ApiResponse<{ collection: Collection }>>('/misc/fetchSingleCollection', {
      params: { id },
    }),

  fetchLeagues: () =>
    getClient().get<ApiResponse<unknown>>('/misc/fetchleagues'),

  deeplink: (path: string) =>
    getClient().get<ApiResponse<unknown>>('/misc/deeplink', { params: { path } }),

  getTerms: () =>
    getClient().get<ApiResponse<{ content: string }>>('/misc/terms'),

  getPrivacy: () =>
    getClient().get<ApiResponse<{ content: string }>>('/misc/privacy'),

  getAboutUs: () =>
    getClient().get<ApiResponse<{ content: string }>>('/misc/aboutus'),

  getDonate: () =>
    getClient().get<ApiResponse<{ content: string }>>('/misc/donate'),
}
