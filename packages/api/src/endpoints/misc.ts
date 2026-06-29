import { getClient } from '../client.js'

export const misc = {
  // Dashboard: { email, lastseeninbox:0 }
  initApp: (email?: string) =>
    getClient().post<any>('initapp', { email: email ?? '', lastseeninbox: 0 }),

  overview: (email?: string) =>
    getClient().post<any>('overview', { email: email ?? '', lastseeninbox: 0 }),

  // Collections — correct endpoint names from API doc
  fetchCollections: (page = 0) =>
    getClient().post<any>('fetch_collections', { page: String(page) }),

  fetchSingleCollection: (collectionId: string | number) =>
    getClient().post<any>('fetchSingleCollection', { collection_id: collectionId }),

  fetchLeagues: () =>
    getClient().post<any>('fetchleagues', {}),

  // FAQs — GET per API doc
  fetchFaqs: () =>
    getClient().get<any>('fetchfaqs'),

  // Countries — GET per API doc
  loadCountries: () =>
    getClient().get<any>('loadcountries'),

  // Banks — POST { country }
  loadBanks: (countryId: string | number) =>
    getClient().post<any>('loadbanks', { country: countryId }),

  // Inbox/Notifications — POST { email, lastseeninbox }
  fetchInbox: (email?: string, lastSeen = 0) =>
    getClient().post<any>('initapp', { email: email ?? '', lastseeninbox: lastSeen }),
}
