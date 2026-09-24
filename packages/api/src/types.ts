/**
 * Response types of the Loikmon backend (`/api/v1`).
 *
 * Content objects keep the field names the apps already rendered from the
 * legacy API (`thumbnail`, `authorname`, `categoryname`, `views`, `rating`,
 * `articledate`, ...). File URLs are never embedded in them: request them with
 * `books.getFileUrl()` / `books.getChapters()` / `articles.getArticle()`.
 */

import type { ResponsiveImage } from '@loikmon/media-standards'

export type Id = number

export interface Pagination {
  page: number
  limit: number
  total: number
  total_pages: number
  has_more: boolean
}

export interface ApiErrorBody {
  status: 'error'
  code: string
  message: string
  details?: unknown
  request_id?: string
}

export type AccessReason = 'free' | 'subscription' | 'grant' | 'admin' | 'login_required' | 'subscription_required'

export interface AccessInfo {
  granted: boolean
  reason: AccessReason
}

// ── Users & subscriptions ──────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  name: string
  firstname: string
  lastname: string
  phone: string | null
  role: 'user' | 'admin' | string
  is_admin: boolean
  email_verified: boolean
  thumbnail: string | null
  avatar: string | null
  /** Responsive renditions of `thumbnail`; `srcset` is null for legacy keys. */
  avatar_image?: ResponsiveImage | null
  created_at: string | null
}

export type SubscriptionPlatform = 'app_store' | 'google_play' | 'manual'
export type SubscriptionStatus = 'active' | 'canceled' | 'grace_period' | 'billing_retry' | 'paused' | 'pending' | 'expired' | 'revoked'

export interface Entitlement {
  /** True when the user may open every book and article. */
  active: boolean
  source: 'subscription' | 'grant' | 'admin' | null
  expires_at: string | null
  subscription: {
    id: string
    plan_code: string | null
    platform: SubscriptionPlatform
    status: SubscriptionStatus
    auto_renew: boolean
    expires_at: string | null
    in_grace_period: boolean
    environment: string
    product_id: string | null
  } | null
}

export interface Plan {
  code: 'monthly' | 'quarterly' | 'semiannual' | 'yearly' | string
  name: string
  description: string | null
  price_cents: number
  /** Decimal string, e.g. "4.00". Store prices shown in the apps come from the store (localised). */
  price: string
  currency: string
  period_months: number
  monthly_price_cents: number
  savings_percent: number
  apple_product_id: string | null
  google_product_id: string | null
  google_base_plan_id: string | null
}

export interface PlansResponse {
  status: 'ok'
  plans: Plan[]
  platforms: { ios: boolean; android: boolean; web: boolean }
}

export interface SubscriptionRecord {
  id: string
  plan_code: string | null
  platform: SubscriptionPlatform
  product_id: string | null
  status: SubscriptionStatus
  auto_renew: boolean
  environment: string
  started_at: string | null
  expires_at: string | null
  updated_at: string
}

export interface SubscriptionStatusResponse {
  status: 'ok'
  entitlement: Entitlement
  /** Pass as appAccountToken (iOS) / obfuscatedAccountId (Android) when purchasing. */
  account_token: string
  subscriptions: SubscriptionRecord[]
  manage_urls: { app_store: string; google_play: string }
}

export interface VerifyResponse {
  status: 'ok'
  entitlement: Entitlement
  subscription: Pick<SubscriptionRecord, 'id' | 'plan_code' | 'platform' | 'status' | 'expires_at' | 'auto_renew'>
}

export type PurchaseProof =
  | { platform: 'ios'; transaction_jws: string }
  | { platform: 'android'; product_id: string; purchase_token: string }

export interface RestoreResponse {
  status: 'ok'
  entitlement: Entitlement
  results: Array<{ ok: boolean; code?: string; message?: string; subscription_id?: string }>
}

export interface AuthResponse {
  status: 'ok'
  /** Bearer token; null when email verification is required before signing in. */
  token: string | null
  user: User
  entitlement: Entitlement
  requires_email_verification?: boolean
}

export interface MeResponse {
  status: 'ok'
  user: User
  entitlement: Entitlement
}

// ── Catalogue ──────────────────────────────────────────────────────────────

export interface Book {
  id: Id
  title: string
  description: string
  author_id: Id | null
  authorname: string
  category: Id | null
  categoryname: string
  subcategory: Id | null
  subcategoryname: string
  thumbnail: string | null
  coverphoto: string | null
  cover_url: string | null
  /** Responsive renditions of the cover (2:3); fall back to `thumbnail` / `cover_url`. */
  cover_image?: ResponsiveImage | null
  og_image_url?: string | null
  pages: number | null
  publisher: string | null
  published_at: string | null
  language: string
  is_free: boolean
  is_recommended: boolean
  is_top: boolean
  views: number
  rating: number
  rating_count: number
  formats: Array<'pdf' | 'epub'>
  has_pdf: boolean
  has_epub: boolean
  has_audio: boolean
  audio_chapters_count: number
  audio_duration_seconds: number
  created_at: string | null
  updated_at: string | null
  date: string | null
}

export interface BookDetail extends Book {
  access: AccessInfo
  in_library: boolean
}

export interface BookChapter {
  id: Id
  book_id: Id
  chapter_number: number
  title: string
  chapter_title: string
  duration_seconds: number | null
  duration: number | null
  is_preview: boolean
  /** Locked chapters have no audio_url. */
  locked: boolean
  audio_url: string | null
  /** When the signed audio_url stops working; fetch the chapters again after it. */
  audio_expires_at?: string | null
}

/** @deprecated use BookChapter */
export type BookAudioChapter = BookChapter

export interface BookFileResponse {
  status: 'ok'
  format: 'pdf' | 'epub'
  /** Short-lived signed URL. Request a new one when it expires. */
  url: string
  expires_at: string
}

export interface ChaptersResponse {
  status: 'ok'
  book_id: Id
  access: AccessInfo
  chapters: BookChapter[]
}

export interface Article {
  id: Id
  title: string
  excerpt: string
  description: string
  author_id: Id | null
  authorname: string
  category: Id | null
  categoryname: string
  subcategory: Id | null
  thumbnail: string | null
  thumbnail_url: string | null
  /** Responsive renditions of the cover (16:9); fall back to `thumbnail_url` / `thumbnail`. */
  thumbnail_image?: ResponsiveImage | null
  og_image_url?: string | null
  has_audio: boolean
  is_free: boolean
  views: number
  rating: number
  rating_count: number
  published_at: string | null
  articledate: string | null
  date: string | null
  created_at: string | null
  updated_at: string | null
}

export interface ArticleDetail extends Article {
  /** HTML body; null when locked. */
  content: string | null
  locked: boolean
  /** Signed audio URL; null when there is no audio or it is locked. */
  audio_url: string | null
  audio_expires_at?: string | null
  access: AccessInfo
  in_library: boolean
}

export interface Author {
  id: Id
  name: string
  bio: string
  description: string
  thumbnail: string | null
  avatar_url: string | null
  /** Responsive renditions of the avatar (1:1, shown as a circle). */
  avatar_image?: ResponsiveImage | null
  website: string | null
  facebook: string | null
  youtube: string | null
  instagram: string | null
  verified: boolean
  books_count: number
  bookscount: number
  articles_count: number
  articlescount: number
  followers_count: number
  is_following: boolean
  created_at: string | null
  joined_date: string | null
}

export interface Category {
  id: Id
  type: 'book' | 'article' | 'all'
  name: string
  parent_id: Id | null
  thumbnail: string | null
  /** Responsive renditions of the icon (1:1). */
  thumbnail_image?: ResponsiveImage | null
  /** Category cover (16:9) URL, when one was uploaded. */
  cover?: string | null
  cover_image?: ResponsiveImage | null
  display_order: number
  books_count: number
  bookscount: number
  articles_count: number
  articlescount: number
}

export interface Review {
  id: Id
  user_id: string
  username: string
  author_name: string
  avatar: string | null
  rating: number
  content: string
  comment: string
  created_at: string
  updated_at: string
}

export interface Collection {
  id: Id
  title: string
  name: string
  description: string | null
  thumbnail: string | null
  /** Responsive renditions of the cover (3:1). */
  cover_image?: ResponsiveImage | null
  og_image_url?: string | null
  items_count?: number
  books?: Book[]
  articles?: Article[]
}

export interface Slider {
  id: Id
  name: string | null
  title: string | null
  link: string | null
  thumbnail: string | null
  /** Desktop artwork (21:9). */
  image?: ResponsiveImage | null
  /** Mobile artwork URL; the server falls back to the desktop artwork. */
  mobile_thumbnail?: string | null
  /** Mobile artwork (4:5); the server falls back to the desktop artwork. */
  mobile_image?: ResponsiveImage | null
}

export interface FaqItem {
  id: Id
  question: string
  answer: string
}

export interface InboxMessage {
  id: Id
  type: string
  title: string
  message: string | null
  data: Record<string, unknown> | null
  created_at: string
}

export interface ReadingProgress {
  format: 'pdf' | 'epub' | 'audio'
  location: string | null
  progress: number
  updated_at: string
}

export interface HomeResponse {
  status: 'ok'
  sliders: Slider[]
  latest_books: Book[]
  popular_books: Book[]
  recommended_books: Book[]
  audio_books: Book[]
  books: Book[]
  articles: Article[]
  authors: Author[]
}

export interface BooksResponse {
  status: 'ok'
  books: Book[]
  total: number
  pagination: Pagination
}

export interface ArticlesResponse {
  status: 'ok'
  articles: Article[]
  total: number
  pagination: Pagination
}

export interface AuthorsResponse {
  status: 'ok'
  authors: Author[]
  total: number
  pagination: Pagination
}

export interface SearchResults {
  status: 'ok'
  query: string
  books: Book[]
  articles: Article[]
  authors: Author[]
  totals: { books: number; articles: number; authors: number }
}

export interface ReviewsResponse {
  status: 'ok'
  reviews: Review[]
  user_review: Review | null
  summary: { average: number; count: number }
  pagination: Pagination
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
  name?: string
  firstname?: string
  lastname?: string
  phone?: string
}

export type ItemType = 'book' | 'article'
