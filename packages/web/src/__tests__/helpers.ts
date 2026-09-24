/**
 * Shared helpers for component tests: Pinia + memory router + English i18n,
 * and fixtures shaped like the `/api/v1` responses.
 */
import { defineComponent, h, type Component } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { ApiError } from '@loikmon/api'
import type { Article, ArticleDetail, Book, BookDetail, Entitlement, Plan, User } from '@loikmon/api'
import en from '@/i18n/locales/en.json'

const Blank = defineComponent({ render: () => h('div') })

export function createTestI18n() {
  return createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { en } as Record<string, any> })
}

export async function createTestRouter(path = '/', extra: RouteRecordRaw[] = []) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      ...extra,
      { path: '/', name: 'home', component: Blank },
      { path: '/auth', name: 'auth', component: Blank },
      { path: '/subscription', name: 'subscription', component: Blank },
      { path: '/books/:id', name: 'book-detail', component: Blank },
      { path: '/books/:id/read', name: 'book-reader', component: Blank },
      { path: '/articles/:id', name: 'article-detail', component: Blank },
      { path: '/authors/:id', name: 'author-detail', component: Blank },
      { path: '/:pathMatch(.*)*', name: 'not-found', component: Blank },
    ],
  })
  await router.push(path)
  await router.isReady()
  return router
}

export async function mountWithApp(
  component: Component,
  options: { props?: Record<string, unknown>; path?: string; pinia?: Pinia } = {},
) {
  const pinia = options.pinia ?? createPinia()
  setActivePinia(pinia)
  const router = await createTestRouter(options.path ?? '/')
  const wrapper = mount(component as any, {
    props: options.props,
    global: { plugins: [pinia, router, createTestI18n()] },
  })
  await flushPromises()
  return { wrapper, router, pinia }
}

export const apiError = (status: number, code: string, message = code) => new ApiError(message, status, code)

export const response = <T>(data: T) => Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config: {} as any })

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'reader@loikmon.org',
    name: 'Nai Mon',
    firstname: 'Nai',
    lastname: 'Mon',
    phone: null,
    role: 'user',
    is_admin: false,
    email_verified: true,
    thumbnail: null,
    avatar: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export const inactiveEntitlement: Entitlement = { active: false, source: null, expires_at: null, subscription: null }

export function activeEntitlement(overrides: Partial<NonNullable<Entitlement['subscription']>> = {}): Entitlement {
  const subscription = {
    id: 'sub-1',
    plan_code: 'monthly',
    platform: 'google_play' as const,
    status: 'active' as const,
    auto_renew: true,
    expires_at: '2026-10-15T12:00:00.000Z',
    in_grace_period: false,
    environment: 'production',
    product_id: 'loikmon_premium',
    ...overrides,
  }
  return { active: true, source: 'subscription', expires_at: subscription.expires_at, subscription }
}

export function makeBook(overrides: Partial<BookDetail> = {}): BookDetail {
  return {
    id: 7,
    title: 'Mon Chronicles',
    description: 'A history of the Mon people.',
    author_id: 3,
    authorname: 'Author A',
    category: 2,
    categoryname: 'History',
    subcategory: null,
    subcategoryname: '',
    thumbnail: 'https://cdn.loikmon.org/covers/7.jpg',
    coverphoto: null,
    cover_url: null,
    pages: 120,
    publisher: null,
    published_at: null,
    language: 'mnw',
    is_free: false,
    is_recommended: false,
    is_top: false,
    views: 10,
    rating: 4.5,
    rating_count: 2,
    formats: ['epub', 'pdf'],
    has_pdf: true,
    has_epub: true,
    has_audio: false,
    audio_chapters_count: 0,
    audio_duration_seconds: 0,
    created_at: null,
    updated_at: null,
    date: null,
    access: { granted: true, reason: 'subscription' },
    in_library: false,
    ...overrides,
  }
}

export function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 11,
    title: 'Mon New Year',
    excerpt: 'The Mon new year is celebrated…',
    description: 'The Mon new year is celebrated…',
    author_id: 3,
    authorname: 'Author A',
    category: 4,
    categoryname: 'Culture',
    subcategory: null,
    thumbnail: null,
    thumbnail_url: null,
    has_audio: false,
    is_free: false,
    views: 0,
    rating: 0,
    rating_count: 0,
    published_at: '2026-04-13T00:00:00.000Z',
    articledate: '2026-04-13T00:00:00.000Z',
    date: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  }
}

export function makeArticleDetail(overrides: Partial<ArticleDetail> = {}): ArticleDetail {
  return {
    ...makeArticle(),
    content: '<p>Full body</p>',
    locked: false,
    audio_url: null,
    access: { granted: true, reason: 'subscription' },
    in_library: false,
    ...overrides,
  }
}

export function makePlans(): Plan[] {
  const plan = (code: string, name: string, cents: number, months: number, savings: number): Plan => ({
    code,
    name,
    description: null,
    price_cents: cents,
    price: (cents / 100).toFixed(2),
    currency: 'USD',
    period_months: months,
    monthly_price_cents: Math.round(cents / months),
    savings_percent: savings,
    apple_product_id: null,
    google_product_id: null,
    google_base_plan_id: null,
  })
  return [
    plan('yearly', 'Yearly', 4500, 12, 6),
    plan('monthly', 'Monthly', 400, 1, 0),
    plan('quarterly', '3 Months', 1000, 3, 17),
    plan('semiannual', '6 Months', 2000, 6, 17),
  ]
}

export function makeBookList(items: Book[]) {
  return { status: 'ok' as const, books: items, total: items.length, pagination: { page: 1, limit: 20, total: items.length, total_pages: 1, has_more: false } }
}
