import { defineStore } from 'pinia'
import { ref } from 'vue'
import { purchases as purchasesApi } from '@loikmon/api'
import { useAuthStore } from './auth'

export const usePurchasesStore = defineStore('purchases', () => {
  const books = ref<any[]>([])
  const articles = ref<any[]>([])
  const coinBalance = ref(0)
  const coinPackages = ref<any[]>([])
  const loading = ref(false)

  async function fetchAll() {
    const auth = useAuthStore()
    if (!auth.user?.email) return
    const email = auth.user.email as string
    loading.value = true
    try {
      const [booksRes, articlesRes, coinsRes] = await Promise.all([
        purchasesApi.fetchPurchasedBooks(email),
        purchasesApi.fetchPurchasedArticles(email),
        purchasesApi.getUserCoins(email),
      ])
      books.value    = (booksRes.data as any).books ?? []
      articles.value = (articlesRes.data as any).articles ?? []
      const raw      = (coinsRes.data as any).coins
      coinBalance.value = raw ? parseInt(raw) : 0
    } finally { loading.value = false }
  }

  async function fetchCoinPackages() {
    const res = await purchasesApi.fetchCoinPackages()
    coinPackages.value = (res.data as any).coins ?? []
  }

  async function redeemCoupon(code: string, bookId: string | number) {
    const auth = useAuthStore()
    if (!auth.user?.email) throw new Error('Not logged in')
    const res = await purchasesApi.redeemCoupon(auth.user.email as string, code, bookId)
    return res.data as any
  }

  const buyLoading = ref(false)
  const buyError   = ref<string | null>(null)

  async function buyCoins(
    packageId: string,
    packageName: string,
    coinAmount: string,
    file: File,
  ) {
    const auth = useAuthStore()
    if (!auth.user?.email) throw new Error('Not logged in')
    buyLoading.value = true
    buyError.value   = null
    try {
      const res  = await purchasesApi.proofOfPayment(
        auth.user.email as string,
        packageId,
        packageName,
        coinAmount,
        file,
      )
      const body = res.data as any
      if (body?.status !== 'ok') throw new Error(body?.msg ?? 'Payment submission failed')
      return body
    } catch (e: any) {
      buyError.value = e.message ?? 'Unknown error'
      throw e
    } finally {
      buyLoading.value = false
    }
  }

  return { books, articles, coinBalance, coinPackages, loading, fetchAll, fetchCoinPackages, redeemCoupon, buyLoading, buyError, buyCoins }
})
