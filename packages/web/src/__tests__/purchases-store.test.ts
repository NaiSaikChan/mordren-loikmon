/**
 * Purchases store — unit tests
 * All external API calls are mocked via vi.mock so no real HTTP is made.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ── Mock @loikmon/api purchases module ────────────────────────────────────────
const mockFetchPurchasedBooks    = vi.fn()
const mockFetchPurchasedArticles = vi.fn()
const mockGetUserCoins           = vi.fn()
const mockFetchCoinPackages      = vi.fn()
const mockRedeemCoupon           = vi.fn()
const mockProofOfPayment         = vi.fn()

vi.mock('@loikmon/api', () => ({
  purchases: {
    fetchPurchasedBooks:    (...args: unknown[]) => mockFetchPurchasedBooks(...args),
    fetchPurchasedArticles: (...args: unknown[]) => mockFetchPurchasedArticles(...args),
    getUserCoins:           (...args: unknown[]) => mockGetUserCoins(...args),
    fetchCoinPackages:      (...args: unknown[]) => mockFetchCoinPackages(...args),
    redeemCoupon:           (...args: unknown[]) => mockRedeemCoupon(...args),
    proofOfPayment:         (...args: unknown[]) => mockProofOfPayment(...args),
  },
  auth: {
    login:         vi.fn(),
    register:      vi.fn(),
    updateProfile: vi.fn(),
  },
}))

import { usePurchasesStore } from '../stores/purchases'
import { useAuthStore }     from '../stores/auth'

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeFile(name = 'receipt.jpg'): File {
  return new File(['data'], name, { type: 'image/jpeg' })
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    email: 'user@test.com',
    name: 'Test User',
    avatar: '',
    coins: 0,
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('purchases store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  // ── Initial state ──────────────────────────────────────────────────────────
  describe('initial state', () => {
    it('books starts as empty array', () => {
      const store = usePurchasesStore()
      expect(store.books).toEqual([])
    })

    it('articles starts as empty array', () => {
      const store = usePurchasesStore()
      expect(store.articles).toEqual([])
    })

    it('loading starts false', () => {
      const store = usePurchasesStore()
      expect(store.loading).toBe(false)
    })

    it('coinBalance starts 0', () => {
      const store = usePurchasesStore()
      expect(store.coinBalance).toBe(0)
    })

    it('buyLoading starts false', () => {
      const store = usePurchasesStore()
      expect(store.buyLoading).toBe(false)
    })

    it('buyError starts null', () => {
      const store = usePurchasesStore()
      expect(store.buyError).toBeNull()
    })

    it('coinPackages starts as empty array', () => {
      const store = usePurchasesStore()
      expect(store.coinPackages).toEqual([])
    })
  })

  // ── fetchAll() ─────────────────────────────────────────────────────────────
  describe('fetchAll()', () => {
    it('does nothing when user is not logged in', async () => {
      const store = usePurchasesStore()
      await store.fetchAll()
      expect(mockFetchPurchasedBooks).not.toHaveBeenCalled()
    })

    it('populates books on successful fetch', async () => {
      const auth = useAuthStore()
      auth.user = makeUser() as any
      mockFetchPurchasedBooks.mockResolvedValueOnce({ data: { books: [{ id: '1', title: 'Book A' }] } })
      mockFetchPurchasedArticles.mockResolvedValueOnce({ data: { articles: [] } })
      mockGetUserCoins.mockResolvedValueOnce({ data: { coins: '50' } })

      const store = usePurchasesStore()
      await store.fetchAll()
      expect(store.books).toHaveLength(1)
      expect(store.books[0].title).toBe('Book A')
    })

    it('sets coinBalance from getUserCoins response', async () => {
      const auth = useAuthStore()
      auth.user = makeUser() as any
      mockFetchPurchasedBooks.mockResolvedValueOnce({ data: { books: [] } })
      mockFetchPurchasedArticles.mockResolvedValueOnce({ data: { articles: [] } })
      mockGetUserCoins.mockResolvedValueOnce({ data: { coins: '200' } })

      const store = usePurchasesStore()
      await store.fetchAll()
      expect(store.coinBalance).toBe(200)
    })

    it('sets loading to false after fetch', async () => {
      const auth = useAuthStore()
      auth.user = makeUser() as any
      mockFetchPurchasedBooks.mockResolvedValueOnce({ data: { books: [] } })
      mockFetchPurchasedArticles.mockResolvedValueOnce({ data: { articles: [] } })
      mockGetUserCoins.mockResolvedValueOnce({ data: { coins: '0' } })

      const store = usePurchasesStore()
      await store.fetchAll()
      expect(store.loading).toBe(false)
    })
  })

  // ── fetchCoinPackages() ────────────────────────────────────────────────────
  describe('fetchCoinPackages()', () => {
    it('populates coinPackages from response', async () => {
      mockFetchCoinPackages.mockResolvedValueOnce({
        data: { coins: [{ id: '1', name: 'Starter', amount: '100' }] },
      })
      const store = usePurchasesStore()
      await store.fetchCoinPackages()
      expect(store.coinPackages).toHaveLength(1)
      expect(store.coinPackages[0].name).toBe('Starter')
    })

    it('sets coinPackages to [] when coins is missing', async () => {
      mockFetchCoinPackages.mockResolvedValueOnce({ data: {} })
      const store = usePurchasesStore()
      await store.fetchCoinPackages()
      expect(store.coinPackages).toEqual([])
    })
  })

  // ── redeemCoupon() ────────────────────────────────────────────────────────
  describe('redeemCoupon()', () => {
    it('throws when not logged in', async () => {
      const store = usePurchasesStore()
      await expect(store.redeemCoupon('CODE123', '42')).rejects.toThrow('Not logged in')
    })

    it('calls purchasesApi.redeemCoupon with correct args', async () => {
      const auth = useAuthStore()
      auth.user = makeUser({ email: 'redeemer@test.com' }) as any
      mockRedeemCoupon.mockResolvedValueOnce({ data: { status: 'ok' } })

      const store = usePurchasesStore()
      await store.redeemCoupon('VOUCHER', '99')
      expect(mockRedeemCoupon).toHaveBeenCalledWith('redeemer@test.com', 'VOUCHER', '99')
    })
  })

  // ── buyCoins() ─────────────────────────────────────────────────────────────
  describe('buyCoins', () => {
    it('throws if user is not logged in', async () => {
      const auth = useAuthStore()
      auth.user = null

      const store = usePurchasesStore()
      await expect(
        store.buyCoins('pkg-1', 'Starter Pack', '100', makeFile())
      ).rejects.toThrow('Not logged in')
    })

    it('sets buyLoading to true while pending, false after resolution', async () => {
      const auth = useAuthStore()
      auth.user = makeUser() as any

      let resolvePayment!: (val: unknown) => void
      const pendingPromise = new Promise(resolve => { resolvePayment = resolve })
      mockProofOfPayment.mockReturnValueOnce(pendingPromise)

      const store = usePurchasesStore()

      const buyPromise = store.buyCoins('pkg-1', 'Starter Pack', '100', makeFile())

      // buyLoading should be true while the API call is in-flight
      expect(store.buyLoading).toBe(true)

      // Resolve the API call
      resolvePayment({ data: { status: 'ok' } })
      await buyPromise

      // buyLoading should be false after completion
      expect(store.buyLoading).toBe(false)
    })

    it('sets buyLoading to false even on API failure', async () => {
      const auth = useAuthStore()
      auth.user = makeUser() as any
      mockProofOfPayment.mockRejectedValueOnce(new Error('Network error'))

      const store = usePurchasesStore()
      await store.buyCoins('pkg-1', 'Starter Pack', '100', makeFile()).catch(() => {})

      expect(store.buyLoading).toBe(false)
    })

    it('sets buyError on API failure', async () => {
      const auth = useAuthStore()
      auth.user = makeUser() as any
      mockProofOfPayment.mockRejectedValueOnce(new Error('Server error'))

      const store = usePurchasesStore()
      await store.buyCoins('pkg-1', 'Starter Pack', '100', makeFile()).catch(() => {})

      expect(store.buyError).toBe('Server error')
    })

    it('sets buyError when server returns status !== ok', async () => {
      const auth = useAuthStore()
      auth.user = makeUser() as any
      mockProofOfPayment.mockResolvedValueOnce({
        data: { status: 'error', msg: 'Invalid package' },
      })

      const store = usePurchasesStore()
      await store.buyCoins('pkg-1', 'Starter Pack', '100', makeFile()).catch(() => {})

      expect(store.buyError).toBe('Invalid package')
    })

    it('resolves and does not set buyError on success', async () => {
      const auth = useAuthStore()
      auth.user = makeUser({ email: 'buyer@test.com' }) as any
      mockProofOfPayment.mockResolvedValueOnce({ data: { status: 'ok' } })

      const store = usePurchasesStore()
      await store.buyCoins('pkg-gold', 'Gold Pack', '500', makeFile())

      expect(store.buyError).toBeNull()
      expect(store.buyLoading).toBe(false)
    })

    it('calls proofOfPayment with correct arguments', async () => {
      const auth = useAuthStore()
      auth.user = makeUser({ email: 'buyer@test.com' }) as any
      mockProofOfPayment.mockResolvedValueOnce({ data: { status: 'ok' } })

      const file = makeFile('proof.png')
      const store = usePurchasesStore()
      await store.buyCoins('pkg-gold', 'Gold Pack', '500', file)

      expect(mockProofOfPayment).toHaveBeenCalledWith(
        'buyer@test.com',
        'pkg-gold',
        'Gold Pack',
        '500',
        file,
      )
    })

    it('returns the API body on success', async () => {
      const auth = useAuthStore()
      auth.user = makeUser() as any
      mockProofOfPayment.mockResolvedValueOnce({ data: { status: 'ok', message: 'Received' } })

      const store = usePurchasesStore()
      const result = await store.buyCoins('pkg-1', 'Starter Pack', '100', makeFile())

      expect(result).toMatchObject({ status: 'ok' })
    })

    it('clears buyError at the start of each call', async () => {
      const auth = useAuthStore()
      auth.user = makeUser() as any

      // First call fails
      mockProofOfPayment.mockRejectedValueOnce(new Error('First failure'))
      const store = usePurchasesStore()
      await store.buyCoins('pkg-1', 'Starter Pack', '100', makeFile()).catch(() => {})
      expect(store.buyError).toBe('First failure')

      // Second call succeeds — buyError must be cleared
      mockProofOfPayment.mockResolvedValueOnce({ data: { status: 'ok' } })
      await store.buyCoins('pkg-1', 'Starter Pack', '100', makeFile())
      expect(store.buyError).toBeNull()
    })
  })
})
