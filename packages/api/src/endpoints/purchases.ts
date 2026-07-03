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

  /**
   * Upload bank-transfer proof of payment.
   * Sends as multipart/form-data (NOT text/plain) — server requires a file upload.
   * The client interceptor wraps {data:...} for text/plain only; here we bypass that
   * by passing a FormData directly with explicit Content-Type header.
   * Fields: email, packageid, package (name), amount (coin count as string), file
   */
  proofOfPayment: (
    email: string,
    packageId: string,
    packageName: string,
    coinAmount: string,
    file: File,
  ) => {
    const form = new FormData()
    form.append('email',     email)
    form.append('packageid', packageId)
    form.append('package',   packageName)
    form.append('amount',    coinAmount)
    form.append('file',      file)
    // Pass FormData directly — Axios will set multipart/form-data + boundary automatically
    // Do NOT wrap in {data:...} — the interceptor skips FormData instances
    return getClient().post<any>('proofofpayment', form)
  },
}
