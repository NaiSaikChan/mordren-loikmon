import { useCallback, useEffect, useState } from 'react'
import { purchases as purchasesApi } from '@loikmon/api'
import type { Book, Article } from '@loikmon/api'
import { parseBooks, parseArticles } from '@/lib/normalize'
import { useAuth } from '@/context/AuthContext'

export interface CoinPackage {
  id: string | number
  name?: string
  coins?: number | string
  amount?: number | string
  price?: number | string
  [key: string]: unknown
}

/** Purchased books/articles + coin balance + available coin packages. */
export function usePurchases() {
  const { user, refreshUser } = useAuth()
  const email = user?.email
  const [books, setBooks] = useState<Book[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [coins, setCoins] = useState<number>(Number(user?.coins ?? 0))
  const [packages, setPackages] = useState<CoinPackage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const packagesRes = await purchasesApi.fetchCoinPackages().catch(() => ({ data: {} }))
      const pkgBody = packagesRes.data as Record<string, unknown>
      setPackages(
        (pkgBody.coins as CoinPackage[]) ??
          (pkgBody.packages as CoinPackage[]) ??
          (Array.isArray(pkgBody) ? (pkgBody as CoinPackage[]) : []),
      )

      if (!email) return
      const [purchasedBooks, purchasedArticles, coinRes] = await Promise.all([
        purchasesApi.fetchPurchasedBooks(email).catch(() => ({ data: {} })),
        purchasesApi.fetchPurchasedArticles(email).catch(() => ({ data: {} })),
        purchasesApi.getUserCoins(email).catch(() => ({ data: {} })),
      ])
      setBooks(parseBooks(purchasedBooks.data))
      setArticles(parseArticles(purchasedArticles.data))
      const coinBody = coinRes.data as Record<string, unknown>
      const nextCoins = Number(coinBody.coins ?? user?.coins ?? 0)
      setCoins(nextCoins)
      if (user && nextCoins !== Number(user.coins ?? 0)) {
        void refreshUser({ ...user, coins: nextCoins })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load purchases')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email])

  useEffect(() => {
    load()
  }, [load])

  return { books, articles, coins, packages, loading, error, reload: load }
}
