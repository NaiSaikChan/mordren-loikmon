import { getClient } from '../client.js'

export const purchases = {
  // { email }  → { books:[ids], articles:[ids] }
  fetchUserPurchases: (email: string) =>
    getClient().post<any>('fetchuserpurchases', { email }),

  // { email }  → { books:[...] }
  fetchPurchasedBooks: (email: string) =>
    getClient().post<any>('fetchuserpurchasedbooks', { email }),

  // { email }  → { articles:[...] }
  fetchPurchasedArticles: (email: string) =>
    getClient().post<any>('fetchuserpurchasedarticles', { email }),

  // { email }  → { coins:'150' }
  getUserCoins: (email: string) =>
    getClient().post<any>('getusercoins', { email }),

  // GET  → { coins:[...] }
  fetchCoinPackages: () =>
    getClient().get<any>('fetchcoins'),

  // { email, bookid, amount }
  purchaseBook: (email: string, bookId: string | number, amount: number) =>
    getClient().post<any>('purchasebook', { email, bookid: bookId, amount }),

  // { email, articleid, amount }
  purchaseArticle: (email: string, articleId: string | number, amount: number) =>
    getClient().post<any>('purchasearticle', { email, articleid: articleId, amount }),

  // { email, book(mediaId), amount }
  purchaseMedia: (email: string, mediaId: string | number, amount: number) =>
    getClient().post<any>('purchase_media', { email, book: mediaId, amount }),

  // { email, code, book_id }
  redeemCoupon: (email: string, code: string, bookId: string | number) =>
    getClient().post<any>('subscribeBookCoupon', { email, code, book_id: bookId }),
}
