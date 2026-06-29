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

  return { books, articles, coinBalance, coinPackages, loading, fetchAll, fetchCoinPackages, redeemCoupon }
})
