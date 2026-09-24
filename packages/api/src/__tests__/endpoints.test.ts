import { beforeEach, describe, expect, it, vi } from 'vitest'

const http = { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }
vi.mock('../client.js', () => ({ getClient: () => http }))

import { articles } from '../endpoints/articles.js'
import { auth } from '../endpoints/auth.js'
import { authors } from '../endpoints/authors.js'
import { books } from '../endpoints/books.js'
import { categories } from '../endpoints/categories.js'
import { library } from '../endpoints/library.js'
import { media } from '../endpoints/media.js'
import { misc } from '../endpoints/misc.js'
import { reviews } from '../endpoints/reviews.js'
import { search } from '../endpoints/search.js'
import { formatPlanPrice, isLocked, storeSkus, subscriptions } from '../endpoints/subscriptions.js'
import type { Plan } from '../types.js'

beforeEach(() => {
  for (const fn of Object.values(http)) {
    fn.mockReset()
    fn.mockResolvedValue({ data: { status: 'ok' } })
  }
})

describe('auth', () => {
  it('uses the v1 auth routes and never sends the email as identity', async () => {
    await auth.login({ email: 'a@b.c', password: 'secret123' })
    expect(http.post).toHaveBeenCalledWith('auth/login', { email: 'a@b.c', password: 'secret123' })
    await auth.register({ email: 'a@b.c', password: 'secret123', firstname: 'Nai' })
    expect(http.post).toHaveBeenCalledWith('auth/register', { email: 'a@b.c', password: 'secret123', firstname: 'Nai' })
    await auth.me()
    expect(http.get).toHaveBeenCalledWith('auth/me')
    await auth.updateProfile({ phone: '099' })
    expect(http.patch).toHaveBeenCalledWith('auth/me', { phone: '099' })
    await auth.forgotPassword('a@b.c')
    expect(http.post).toHaveBeenCalledWith('auth/password/forgot', { email: 'a@b.c' })
    await auth.confirmPasswordReset('tok', 'new-password')
    expect(http.post).toHaveBeenCalledWith('auth/password/reset', { token: 'tok', new_password: 'new-password' })
    await auth.deleteAccount('pw')
    expect(http.delete).toHaveBeenCalledWith('auth/me', { data: { password: 'pw' } })
    await auth.logout()
    expect(http.post).toHaveBeenCalledWith('auth/logout')
  })
})

describe('catalogue', () => {
  it('lists and fetches books, files, chapters and progress', async () => {
    await books.fetchBooks({ page: 2, category: 5, sort: 'popular' })
    expect(http.get).toHaveBeenCalledWith('books', { params: { page: 2, category: 5, sort: 'popular' } })
    await books.getBook(7)
    expect(http.get).toHaveBeenCalledWith('books/7')
    await books.getFileUrl(7, 'epub')
    expect(http.get).toHaveBeenCalledWith('books/7/file', { params: { format: 'epub' } })
    await books.getChapters(7)
    expect(http.get).toHaveBeenCalledWith('books/7/chapters')
    await books.updateTotalViews(7)
    expect(http.post).toHaveBeenCalledWith('books/7/views')
    await books.saveProgress(7, { format: 'pdf', location: '12', progress: 30 })
    expect(http.put).toHaveBeenCalledWith('books/7/progress', { format: 'pdf', location: '12', progress: 30 })
  })

  it('covers articles, authors, categories, search, library, reviews and misc', async () => {
    await articles.fetchArticles({ category: 3 })
    expect(http.get).toHaveBeenCalledWith('articles', { params: { category: 3 } })
    await articles.getArticle(9)
    expect(http.get).toHaveBeenCalledWith('articles/9')
    await authors.followUnfollow(4, false)
    expect(http.put).toHaveBeenCalledWith('authors/4/follow')
    await authors.followUnfollow(4, true)
    expect(http.delete).toHaveBeenCalledWith('authors/4/follow')
    await categories.fetchCategories('article')
    expect(http.get).toHaveBeenCalledWith('categories', { params: { type: 'article' } })
    await search.search('ဇာတ်', { type: 'book' })
    expect(http.get).toHaveBeenCalledWith('search', { params: { q: 'ဇာတ်', type: 'book', page: 1, limit: 20 } })
    await library.add('book', 7)
    expect(http.put).toHaveBeenCalledWith('library/book/7')
    await reviews.submitReview({ item_type: 'article', item_id: 9, rating: 5, content: 'ကောန်' })
    expect(http.post).toHaveBeenCalledWith('reviews', { item_type: 'article', item_id: 9, rating: 5, content: 'ကောန်' })
    await reviews.loadReviews('book', 7)
    expect(http.get).toHaveBeenCalledWith('reviews', { params: { item_type: 'book', item_id: 7, page: 1, limit: 20 } })
    await misc.home()
    expect(http.get).toHaveBeenCalledWith('home')
    await media.fetchAudioBooks()
    expect(http.get).toHaveBeenCalledWith('books', { params: { has_audio: true, page: 1, limit: 20, sort: 'latest' } })
  })
})

describe('subscriptions', () => {
  it('verifies store purchases with the proof expected by the backend', async () => {
    await subscriptions.verifyApplePurchase('eyJ.jws.sig')
    expect(http.post).toHaveBeenCalledWith('subscriptions/verify', { platform: 'ios', transaction_jws: 'eyJ.jws.sig' })
    await subscriptions.verifyGooglePurchase('loikmon_premium', 'play-token')
    expect(http.post).toHaveBeenCalledWith('subscriptions/verify', { platform: 'android', product_id: 'loikmon_premium', purchase_token: 'play-token' })
    await subscriptions.restore([{ platform: 'ios', transaction_jws: 'a.b.c' }])
    expect(http.post).toHaveBeenCalledWith('subscriptions/restore', { purchases: [{ platform: 'ios', transaction_jws: 'a.b.c' }] })
    await subscriptions.getStatus()
    expect(http.get).toHaveBeenCalledWith('subscriptions/me')
  })

  const plan = (code: string, apple: string, cents: number): Plan => ({
    code,
    name: code,
    description: null,
    price_cents: cents,
    price: (cents / 100).toFixed(2),
    currency: 'USD',
    period_months: 1,
    monthly_price_cents: cents,
    savings_percent: 0,
    apple_product_id: apple,
    google_product_id: 'loikmon_premium',
    google_base_plan_id: code,
  })

  it('derives store SKUs, lock state and fallback prices', () => {
    const plans = [plan('monthly', 'org.loikmon.mobile.premium.monthly', 400), plan('yearly', 'org.loikmon.mobile.premium.yearly', 4500)]
    expect(storeSkus(plans, 'ios')).toEqual(['org.loikmon.mobile.premium.monthly', 'org.loikmon.mobile.premium.yearly'])
    expect(storeSkus(plans, 'android')).toEqual(['loikmon_premium'])
    expect(isLocked({ is_free: false }, null)).toBe(true)
    expect(isLocked({ is_free: true }, null)).toBe(false)
    expect(isLocked({ is_free: false }, { active: true, source: 'subscription', expires_at: null, subscription: null })).toBe(false)
    expect(formatPlanPrice(plans[1]!)).toBe('$45.00')
  })
})
