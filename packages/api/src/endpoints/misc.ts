import { getClient } from '../client.js'
import type { Collection, FaqItem, HomeResponse, Id, InboxMessage, Pagination } from '../types.js'

export const misc = {
  /** Home screen: sliders, latest/popular/recommended/audio books, articles, authors. */
  home: () => getClient().get<HomeResponse>('home'),

  fetchCollections: (page = 1, limit = 20) =>
    getClient().get<{ status: 'ok'; collections: Collection[]; total: number; pagination: Pagination }>('collections', { params: { page, limit } }),

  fetchSingleCollection: (id: Id | string) => getClient().get<{ status: 'ok'; collection: Collection }>(`collections/${id}`),

  fetchFaqs: () => getClient().get<{ status: 'ok'; faqs: FaqItem[] }>('faqs'),

  /** Broadcast announcements plus messages for the signed-in user. */
  fetchInbox: () => getClient().get<{ status: 'ok'; notifications: InboxMessage[] }>('notifications'),
}
