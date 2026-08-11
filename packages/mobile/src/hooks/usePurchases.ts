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
  const [couponLoading, setCouponLoading] = useState(false)
  const [buyLoading, setBuyLoading] = useState(false)
  const [buyError, setBuyError] = useState<string | null>(null)

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

  const redeemCoinCoupon = useCallback(
    async (code: string): Promise<{ status: string; message?: string; msg?: string }> => {
      if (!email) throw new Error('Not logged in')
      setCouponLoading(true)
      try {
        const res = await purchasesApi.redeemCoinCoupon(email, code)
        const body = res.data as Record<string, unknown>
        if (body.status === 'ok') await load()
        return body as { status: string; message?: string; msg?: string }
      } finally {
        setCouponLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [email],
  )

  const redeemBookCoupon = useCallback(
    async (
      bookId: string | number,
      code: string,
    ): Promise<{ status: string; message?: string; msg?: string }> => {
      if (!email) throw new Error('Not logged in')
      setCouponLoading(true)
      try {
        const res = await purchasesApi.redeemCoupon(email, code, bookId)
        return res.data as { status: string; message?: string; msg?: string }
      } finally {
        setCouponLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [email],
  )

  const loadCountries = useCallback(async (): Promise<any[]> => {
    const res = await purchasesApi.loadCountries()
    return (res.data as Record<string, unknown>).countries as any[] ?? []
  }, [])

  const loadBanks = useCallback(async (countryId: number): Promise<any[]> => {
    const res = await purchasesApi.loadBanks(countryId)
    return (res.data as Record<string, unknown>).banks as any[] ?? []
  }, [])

  const buyCoins = useCallback(
    async (
      packageId: string,
      packageName: string,
      coinAmount: string,
      file: { uri: string; name: string; type: string },
      coupon?: string,
      bankId?: string,
    ): Promise<void> => {
      if (!email) throw new Error('Not logged in')
      setBuyLoading(true)
      setBuyError(null)
      try {
        const res = await purchasesApi.proofOfPayment(
          email,
          packageId,
          packageName,
          coinAmount,
          file as unknown as File,
          coupon,
          bankId,
        )
        const body = res.data as Record<string, unknown>
        if (body.status !== 'ok') throw new Error((body.msg ?? body.message ?? 'Payment submission failed') as string)
      } catch (e) {
        setBuyError(e instanceof Error ? e.message : 'Unknown error')
        throw e
      } finally {
        setBuyLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [email],
  )

  return { books, articles, coins, packages, loading, error, couponLoading, reload: load, redeemCoinCoupon, redeemBookCoupon, loadCountries, loadBanks, buyCoins, buyLoading, buyError }
}
