import type { ApiResponse, Purchase, Coin, Bank } from '../types.js'
import { getClient } from '../client.js'

export const purchases = {
  getCoins: () =>
    getClient().get<ApiResponse<{ coins: Coin[] }>>('/purchases/fetchcoins'),

  getUserCoins: () =>
    getClient().get<ApiResponse<{ balance: number }>>('/purchases/getusercoins'),

  loadCoins: () =>
    getClient().get<ApiResponse<{ coins: Coin[] }>>('/purchases/loadcoins'),

  fetchUserPurchases: () =>
    getClient().get<ApiResponse<{ purchases: Purchase[] }>>('/purchases/fetchuserpurchases'),

  fetchUserPurchasedBooks: () =>
    getClient().get<ApiResponse<{ books: unknown[] }>>('/purchases/fetchuserpurchasedbooks'),

  fetchUserPurchasedArticles: () =>
    getClient().get<ApiResponse<{ articles: unknown[] }>>('/purchases/fetchuserpurchasedarticles'),

  fetchUserPendingPurchases: () =>
    getClient().get<ApiResponse<{ purchases: Purchase[] }>>('/purchases/fetchuserpendingpurchases'),

  fetchUserPurchasesNew: () =>
    getClient().get<ApiResponse<{ purchases: Purchase[] }>>('/purchases/fetch_user_purchases'),

  fetchUserAlbumPurchases: () =>
    getClient().get<ApiResponse<{ purchases: Purchase[] }>>('/purchases/fetch_purchases_album'),

  loadBanks: () =>
    getClient().get<ApiResponse<{ banks: Bank[] }>>('/purchases/loadbanks'),

  proofOfPayment: (data: FormData | Record<string, unknown>) =>
    getClient().post<ApiResponse<null>>('/purchases/proofofpayment', data),

  sendPaymentToServer: (data: Record<string, unknown>) =>
    getClient().post<ApiResponse<null>>('/purchases/record_payment', data),

  subscribeCoupon: (code: string) =>
    getClient().post<ApiResponse<null>>('/purchases/subscribeCoupon', { code }),

  approveBook: (purchaseId: string | number) =>
    getClient().post<ApiResponse<null>>('/purchases/approvebook', { purchase_id: purchaseId }),

  deleteProofRequest: (id: string | number) =>
    getClient().post<ApiResponse<null>>('/purchases/deleteproofrequest', { id }),

  pendingBankPayments: () =>
    getClient().get<ApiResponse<{ payments: unknown[] }>>('/purchases/pendingBankPaymentsApp'),

  approveBankPayments: (id: string | number) =>
    getClient().post<ApiResponse<null>>('/purchases/approveBankPaymentsApp', { id }),

  deleteBankPayments: (id: string | number) =>
    getClient().post<ApiResponse<null>>('/purchases/deleteBankPaymentsApp', { id }),
}
