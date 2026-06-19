import { describe, it, expect } from 'vitest'
import type {
  User, Book, Article, Author, Category,
  MediaItem, Album, Review, Reply,
  Purchase, Coin, Bank, FaqItem,
  InboxMessage, Collection, SearchResult,
  AppInitData, Country, ApiResponse,
  LoginPayload, RegisterPayload, AuthResult,
} from '../types.js'

// ── Type-guard helpers (pure runtime checks) ──────────────────────────────────
function isString(v: unknown): v is string { return typeof v === 'string' }
function isNumber(v: unknown): v is number { return typeof v === 'number' }
function isBoolean(v: unknown): v is boolean { return typeof v === 'boolean' }

describe('@loikmon/api — Types', () => {

  describe('ApiResponse wrapper', () => {
    it('wraps generic data correctly', () => {
      const r: ApiResponse<{ books: Book[] }> = { data: { books: [] } }
      expect(r.data.books).toBeInstanceOf(Array)
    })
    it('accepts optional message and status fields', () => {
      const r: ApiResponse<null> = { data: null, message: 'ok', status: 200 }
      expect(r.message).toBe('ok')
      expect(r.status).toBe(200)
    })
  })

  describe('User', () => {
    it('requires id, name, email', () => {
      const user: User = { id: 1, name: 'Chan', email: 'chan@test.com' }
      expect(isString(user.name) || isNumber(user.id)).toBe(true)
      expect(user.email).toContain('@')
    })
    it('accepts optional fields', () => {
      const user: User = { id: '42', name: 'Test', email: 'test@mail.com',
        avatar: '/img.png', coins: 100, phone: '09012345678',
        country: 'MM', email_verified: true, created_at: '2024-01-01' }
      expect(user.coins).toBe(100)
      expect(user.email_verified).toBe(true)
    })
  })

  describe('Book', () => {
    it('requires at minimum id and title', () => {
      const book: Book = { id: 1, title: 'ကျောက်တလင်း' }
      expect(isString(book.title)).toBe(true)
    })
    it('accepts all optional fields', () => {
      const book: Book = {
        id: '99', title: 'Test Book', cover: '/cover.jpg', cover_url: '/cover.jpg',
        author: 'Author A', author_id: 1, description: 'Desc',
        price: 500, currency: 'MMK', is_free: false, is_purchased: false,
        category_id: 3, pages: 200, file_url: '/file.pdf', epub_url: '/file.epub',
        views: 1000, rating: 4.5, ratings_count: 50, created_at: '2024-01-01'
      }
      expect(book.is_free).toBe(false)
      expect(book.rating).toBe(4.5)
    })
  })

  describe('Article', () => {
    it('requires id and title', () => {
      const article: Article = { id: 1, title: 'Mon News' }
      expect(article.title).toBe('Mon News')
    })
  })

  describe('Author', () => {
    it('requires id and name', () => {
      const author: Author = { id: 1, name: 'Nai Test' }
      expect(isString(author.name)).toBe(true)
    })
    it('tracks follow state', () => {
      const author: Author = { id: 2, name: 'Test', is_following: true, followers_count: 42 }
      expect(author.is_following).toBe(true)
    })
  })

  describe('Category', () => {
    it('requires id and name', () => {
      const cat: Category = { id: 1, name: 'Fiction' }
      expect(cat.name).toBe('Fiction')
    })
    it('accepts book/article/media type', () => {
      const catBook: Category = { id: 2, name: 'Poetry', type: 'book' }
      const catMedia: Category = { id: 3, name: 'Music', type: 'media' }
      expect(catBook.type).toBe('book')
      expect(catMedia.type).toBe('media')
    })
  })

  describe('MediaItem', () => {
    it('tracks like state', () => {
      const m: MediaItem = { id: 1, title: 'Song A', is_liked: false }
      expect(m.is_liked).toBe(false)
    })
  })

  describe('Purchase', () => {
    it('enforces allowed statuses', () => {
      const pending: Purchase = { id: 1, user_id: 1, item_id: 1, item_type: 'book', amount: 500, status: 'pending' }
      const approved: Purchase = { ...pending, status: 'approved' }
      const rejected: Purchase = { ...pending, status: 'rejected' }
      expect(['pending', 'approved', 'rejected']).toContain(pending.status)
      expect(['pending', 'approved', 'rejected']).toContain(approved.status)
      expect(['pending', 'approved', 'rejected']).toContain(rejected.status)
    })
    it('enforces allowed item_types', () => {
      const types: Purchase['item_type'][] = ['book', 'article', 'media', 'album']
      types.forEach(t => expect(['book','article','media','album']).toContain(t))
    })
  })

  describe('LoginPayload / RegisterPayload', () => {
    it('LoginPayload requires email and password', () => {
      const payload: LoginPayload = { email: 'user@test.com', password: 'secret' }
      expect(payload.email).toBeTruthy()
      expect(payload.password).toBeTruthy()
    })
    it('RegisterPayload requires name, email, password, password_confirmation', () => {
      const payload: RegisterPayload = {
        name: 'Chan', email: 'chan@test.com',
        password: '12345678', password_confirmation: '12345678'
      }
      expect(payload.name).toBe('Chan')
      expect(payload.password).toBe(payload.password_confirmation)
    })
  })

  describe('SearchResult', () => {
    it('all fields are optional arrays', () => {
      const empty: SearchResult = {}
      const withBooks: SearchResult = { books: [{ id: 1, title: 'B' }] }
      expect(empty.books).toBeUndefined()
      expect(withBooks.books).toHaveLength(1)
    })
  })

  describe('FaqItem', () => {
    it('requires id, question, and answer', () => {
      const faq: FaqItem = { id: 1, question: 'What is Loikmon?', answer: 'A Mon digital library.' }
      expect(faq.question).toBeTruthy()
      expect(faq.answer).toBeTruthy()
    })
  })

  describe('Country', () => {
    it('requires id and name', () => {
      const c: Country = { id: 1, name: 'Myanmar', code: 'MM' }
      expect(c.code).toBe('MM')
    })
  })

  describe('Collection', () => {
    it('can contain books array', () => {
      const col: Collection = { id: 1, title: 'Top 10', items: [], items_count: 0 }
      expect(col.items).toBeInstanceOf(Array)
    })
  })
})
