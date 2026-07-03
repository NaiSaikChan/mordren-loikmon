/**
 * Purchases endpoint — unit tests
 * Verifies exact payload shapes sent to the API, especially the multipart
 * proofOfPayment endpoint.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPost = vi.fn()
const mockGet  = vi.fn()

vi.mock('../client.js', () => ({
  getClient: () => ({ post: mockPost, get: mockGet }),
}))

import { purchases } from '../endpoints/purchases.js'

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeFile(name = 'receipt.jpg'): File {
  return new File(['binary-data'], name, { type: 'image/jpeg' })
}

describe('purchases endpoint', () => {
  beforeEach(() => {
    mockPost.mockResolvedValue({ data: {} })
    mockGet.mockResolvedValue({ data: {} })
    vi.clearAllMocks()
  })

  // ── fetchUserPurchases ─────────────────────────────────────────────────────
  describe('fetchUserPurchases()', () => {
    it('posts to fetchuserpurchases with email', async () => {
      await purchases.fetchUserPurchases('u@test.com')
      expect(mockPost).toHaveBeenCalledWith('fetchuserpurchases', { email: 'u@test.com' })
    })
  })

  // ── fetchPurchasedBooks ────────────────────────────────────────────────────
  describe('fetchPurchasedBooks()', () => {
    it('posts to fetchuserpurchasedbooks', async () => {
      await purchases.fetchPurchasedBooks('u@test.com')
      expect(mockPost).toHaveBeenCalledWith('fetchuserpurchasedbooks', { email: 'u@test.com' })
    })
  })

  // ── fetchPurchasedArticles ─────────────────────────────────────────────────
  describe('fetchPurchasedArticles()', () => {
    it('posts to fetchuserpurchasedarticles', async () => {
      await purchases.fetchPurchasedArticles('u@test.com')
      expect(mockPost).toHaveBeenCalledWith('fetchuserpurchasedarticles', { email: 'u@test.com' })
    })
  })

  // ── getUserCoins ──────────────────────────────────────────────────────────
  describe('getUserCoins()', () => {
    it('posts to getusercoins', async () => {
      await purchases.getUserCoins('u@test.com')
      expect(mockPost).toHaveBeenCalledWith('getusercoins', { email: 'u@test.com' })
    })
  })

  // ── fetchCoinPackages ─────────────────────────────────────────────────────
  describe('fetchCoinPackages()', () => {
    it('gets fetchcoins endpoint', async () => {
      await purchases.fetchCoinPackages()
      expect(mockGet).toHaveBeenCalledWith('fetchcoins')
    })
  })

  // ── purchaseBook ──────────────────────────────────────────────────────────
  describe('purchaseBook()', () => {
    it('posts to purchasebook with correct shape', async () => {
      await purchases.purchaseBook('u@test.com', 7, 150)
      expect(mockPost).toHaveBeenCalledWith('purchasebook', {
        email: 'u@test.com', bookid: 7, amount: 150,
      })
    })
  })

  // ── purchaseArticle ───────────────────────────────────────────────────────
  describe('purchaseArticle()', () => {
    it('posts to purchasearticle with correct shape', async () => {
      await purchases.purchaseArticle('u@test.com', 3, 50)
      expect(mockPost).toHaveBeenCalledWith('purchasearticle', {
        email: 'u@test.com', articleid: 3, amount: 50,
      })
    })
  })

  // ── purchaseMedia ─────────────────────────────────────────────────────────
  describe('purchaseMedia()', () => {
    it('posts to purchase_media with book field as mediaId', async () => {
      await purchases.purchaseMedia('u@test.com', 99, 200)
      expect(mockPost).toHaveBeenCalledWith('purchase_media', {
        email: 'u@test.com', book: 99, amount: 200,
      })
    })
  })

  // ── redeemCoupon ──────────────────────────────────────────────────────────
  describe('redeemCoupon()', () => {
    it('posts to subscribeBookCoupon with correct shape', async () => {
      await purchases.redeemCoupon('u@test.com', 'SAVE50', '12')
      expect(mockPost).toHaveBeenCalledWith('subscribeBookCoupon', {
        email: 'u@test.com', code: 'SAVE50', book_id: '12',
      })
    })
  })

  // ── proofOfPayment ────────────────────────────────────────────────────────
  describe('purchases.proofOfPayment', () => {
    it('posts to proofofpayment endpoint', async () => {
      const file = makeFile()
      await purchases.proofOfPayment('u@test.com', 'pkg-1', 'Starter', '100', file)
      expect(mockPost).toHaveBeenCalledWith('proofofpayment', expect.anything())
    })

    it('sends FormData (multipart) not a plain JSON object', async () => {
      const file = makeFile()
      await purchases.proofOfPayment('u@test.com', 'pkg-1', 'Starter', '100', file)
      const [, dataArg] = mockPost.mock.calls[0]
      expect(dataArg).toBeInstanceOf(FormData)
    })

    it('includes all required fields: email, packageid, package, amount, file', async () => {
      const file = makeFile('proof.jpg')
      await purchases.proofOfPayment('buyer@test.com', 'pkg-gold', 'Gold Pack', '500', file)

      const [, formData] = mockPost.mock.calls[0] as [string, FormData]
      expect(formData).toBeInstanceOf(FormData)

      expect(formData.get('email')).toBe('buyer@test.com')
      expect(formData.get('packageid')).toBe('pkg-gold')
      expect(formData.get('package')).toBe('Gold Pack')
      expect(formData.get('amount')).toBe('500')
      expect(formData.get('file')).toBe(file)
    })

    it('field "file" is the exact File object passed in', async () => {
      const file = makeFile('upload.png')
      await purchases.proofOfPayment('u@test.com', 'pkg-1', 'Starter', '100', file)

      const [, formData] = mockPost.mock.calls[0] as [string, FormData]
      const retrievedFile = formData.get('file')
      expect(retrievedFile).toBe(file)
    })

    it('does NOT wrap payload in a {data:...} envelope', async () => {
      const file = makeFile()
      await purchases.proofOfPayment('u@test.com', 'pkg-1', 'Starter', '100', file)

      const [, dataArg] = mockPost.mock.calls[0]
      // Should be FormData directly, not { data: FormData }
      expect(dataArg instanceof FormData).toBe(true)
      expect(typeof dataArg).not.toBe('string')
    })

    it('posts the correct endpoint path (proofofpayment — all lowercase)', async () => {
      const file = makeFile()
      await purchases.proofOfPayment('u@test.com', 'pkg-1', 'Starter', '100', file)

      const [endpoint] = mockPost.mock.calls[0]
      expect(endpoint).toBe('proofofpayment')
    })

    it('passes all six arguments in the correct field positions', async () => {
      const file = makeFile()
      await purchases.proofOfPayment('a@b.com', 'id-42', 'Premium', '1000', file)

      const [endpoint, formData] = mockPost.mock.calls[0] as [string, FormData]
      expect(endpoint).toBe('proofofpayment')
      expect(formData.get('email')).toBe('a@b.com')
      expect(formData.get('packageid')).toBe('id-42')
      expect(formData.get('package')).toBe('Premium')
      expect(formData.get('amount')).toBe('1000')
      expect(formData.get('file')).toBe(file)
    })
  })
})
