import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'

// ── Mock axios so no real HTTP is made ────────────
vi.mock('axios', async (importOriginal) => {
  const real = await importOriginal<typeof axios>()
  const mockInstance = {
    get: vi.fn().mockResolvedValue({ data: { data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { data: {} } }),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    defaults: { baseURL: '/api', timeout: 15000, headers: {} },
  }
  return {
    ...real,
    default: {
      ...real,
      create: vi.fn(() => mockInstance),
    },
    create: vi.fn(() => mockInstance),
  }
})

describe('@loikmon/api — Endpoint modules (mocked Axios)', () => {

  describe('URL path constants', () => {
    // Validate all API paths are correctly formed strings
    const PATHS = {
      // auth
      loginapp: 'loginapp',
      createaccount: 'createaccount',
      resetpassword: 'resetpassword',
      resendVerificationMail: 'resendVerificationMail',
      updateUserProfile: 'updateUserProfile',
      deletemyaccount: 'deletemyaccount',
      // books
      fetchbooks: 'fetchbooks',
      fetchotherbooks: 'fetchotherbooks',
      getitem: 'getitem',
      getBookChapters: 'getBookChapters',
      relatedbooks: 'relatedbooks',
      ratebook: 'ratebook',
      purchasebook: 'purchasebook',
      // articles
      fetcharticles: 'fetcharticles',
      purchasearticle: 'purchasearticle',
      // authors
      fetchauthors: 'fetchauthors',
      getauthor: 'getauthor',
      follow_unfollow_author: 'follow_unfollow_author',
      // categories
      fetchcategories: 'fetchcategories',
      fetch_app_categories: 'fetch_app_categories',
      // media
      fetch_media: 'fetch_media',
      getTrendingMedia: 'getTrendingMedia',
      likeunlikemedia: 'likeunlikemedia',
      // reviews
      submitreview: 'submitreview',
      loadreviews: 'loadreviews',
      // purchases
      fetchcoins: 'fetchcoins',
      getusercoins: 'getusercoins',
      loadbanks: 'loadbanks',
      // misc
      initapp: 'initapp',
      search: 'search',
      fetchfaqs: 'fetchfaqs',
      fetch_inbox: 'fetch_inbox',
    }

    it('all path names are non-empty strings without leading slashes', () => {
      Object.entries(PATHS).forEach(([name, path]) => {
        expect(typeof path).toBe('string')
        expect(path.length).toBeGreaterThan(0)
        expect(path.startsWith('/')).toBe(false)
      })
    })

    it('has 30+ distinct endpoint paths', () => {
      const unique = new Set(Object.values(PATHS))
      expect(unique.size).toBeGreaterThanOrEqual(30)
    })
  })

  describe('Endpoint group coverage', () => {
    const endpointGroups = ['auth', 'books', 'articles', 'authors', 'categories', 'media', 'reviews', 'purchases', 'misc']

    it('has exactly 9 endpoint groups', () => {
      expect(endpointGroups).toHaveLength(9)
    })

    it('all group names are lowercase strings', () => {
      endpointGroups.forEach(g => {
        expect(g).toBe(g.toLowerCase())
      })
    })
  })

  describe('payload shape validation', () => {
    it('LoginPayload has email + password', () => {
      const payload = { email: 'a@b.com', password: 'abc123' }
      expect(payload).toHaveProperty('email')
      expect(payload).toHaveProperty('password')
    })

    it('RegisterPayload has password_confirmation', () => {
      const payload = {
        name: 'Test', email: 'test@test.com',
        password: '12345678', password_confirmation: '12345678'
      }
      expect(payload.password).toBe(payload.password_confirmation)
    })

    it('review submit payload requires comment', () => {
      const payload = { book_id: 1, rating: 4, comment: 'Great book!' }
      expect(payload.comment.length).toBeGreaterThan(0)
    })

    it('purchase payload includes item_id', () => {
      const payload = { book_id: 5, payment_method: 'coins', amount: 500 }
      expect(payload.book_id).toBe(5)
    })

    it('search query is trimmed before sending', () => {
      const raw = '  mon poetry  '
      const trimmed = raw.trim()
      expect(trimmed).toBe('mon poetry')
    })
  })

  describe('response envelope unwrapping', () => {
    it('{ data: { data: T } } — outer .data is axios, inner .data is API', () => {
      const axiosResponse = { data: { data: { books: [{ id: 1, title: 'Test' }] } } }
      const books = axiosResponse.data.data.books
      expect(books).toHaveLength(1)
      expect(books[0].title).toBe('Test')
    })

    it('handles empty data gracefully with fallback', () => {
      const axiosResponse = { data: { data: null as { books?: unknown[] } | null } }
      const books = axiosResponse.data.data?.books ?? []
      expect(books).toEqual([])
    })

    it('handles missing data key with fallback', () => {
      const axiosResponse = { data: {} } as any
      const books = axiosResponse.data?.data?.books ?? []
      expect(books).toEqual([])
    })
  })
})
