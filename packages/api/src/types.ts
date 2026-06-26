// ─────────────────────────────────────────────────
// Core API response wrapper
// ─────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  data: T
  message?: string
  status?: string | number
}

// ─────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────
export interface User {
  id: string | number
  name: string
  email: string
  avatar?: string
  coins?: number
  phone?: string
  country?: string
  email_verified?: boolean
  created_at?: string
}

export interface LoginPayload {
  email: string
  password: string
  device_token?: string
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
  password_confirmation: string
  phone?: string
  country_id?: string | number
}

export interface AuthResult {
  user: User
  token: string
}

// ─────────────────────────────────────────────────
// Books  — field names match loikmon.org exactly
// ─────────────────────────────────────────────────
export interface Book {
  id: string | number
  title: string
  // Cover image — server uses 'thumbnail' and 'coverphoto'
  thumbnail?: string
  coverphoto?: string
  cover?: string        // alias kept for compatibility
  cover_url?: string    // alias kept for compatibility
  // Author
  author?: string
  authorname?: string
  authorid?: string | number
  author_id?: string | number
  // Content URLs
  pdf?: string
  epub?: string
  pdfhttp?: string | number
  epubhttp?: string | number
  has_audio?: boolean | number
  audioduration?: string
  // Meta
  description?: string
  price?: number
  amount?: number
  currency?: string
  is_free?: boolean
  is_purchased?: boolean
  category_id?: string | number
  category?: string | Category
  categoryname?: string
  subcategory?: string | number
  pages?: string | number
  publisher?: string
  publishdate?: string
  views?: number
  rating?: string | number
  itmsales?: number
  created_at?: string
}

export interface BookChapter {
  id: string | number
  book_id: string | number
  title: string
  order: number
  content?: string
  file_url?: string
}

// ─────────────────────────────────────────────────
// Articles  — field names match loikmon.org exactly
// ─────────────────────────────────────────────────
export interface Article {
  id: string | number
  title: string
  content?: string
  description?: string
  thumbnail?: string
  thumbnail_url?: string
  thumbnail2?: string
  audio?: string
  author?: string
  authorname?: string
  authorid?: string | number
  author_id?: string | number
  category?: string | number
  categoryname?: string
  is_free?: boolean
  is_purchased?: boolean
  price?: number
  amount?: number
  views?: number
  rating?: string | number
  itmsales?: number
  date?: string
  articledate?: string
  created_at?: string
}

// ─────────────────────────────────────────────────
// Authors
// ─────────────────────────────────────────────────
export interface Author {
  id: string | number
  name: string
  avatar?: string
  avatar_url?: string
  bio?: string
  books_count?: number
  articles_count?: number
  followers_count?: number
  is_following?: boolean
  category_id?: string | number
}

// ─────────────────────────────────────────────────
// Categories
// ─────────────────────────────────────────────────
export interface Category {
  id: string | number
  name: string
  icon?: string
  image?: string
  parent_id?: string | number
  type?: 'book' | 'article' | 'media'
  items_count?: number
}

// ─────────────────────────────────────────────────
// Media / Audio
// ─────────────────────────────────────────────────
export interface MediaItem {
  id: string | number
  title: string
  thumbnail?: string
  thumbnail_url?: string
  file_url?: string
  duration?: number
  artist_id?: string | number
  album_id?: string | number
  is_free?: boolean
  is_purchased?: boolean
  price?: number
}

export interface Album {
  id: string | number
  title: string
  cover?: string
  cover_url?: string
  artist_id?: string | number
  tracks_count?: number
  price?: number
  is_purchased?: boolean
}

// ─────────────────────────────────────────────────
// Misc
// ─────────────────────────────────────────────────
export interface FaqItem {
  id: string | number
  question: string
  answer: string
}

export interface InboxMessage {
  id: string | number
  title: string
  body: string
  is_read?: boolean
  created_at?: string
}

export interface Collection {
  id: string | number
  title: string
  cover?: string
  items?: Book[]
  items_count?: number
}

export interface SearchResult {
  books?: Book[]
  articles?: Article[]
  authors?: Author[]
}

export interface Country {
  id: string | number
  name: string
  code?: string
  flag?: string
}

export interface Purchase {
  id: string | number
  user_id: string | number
  item_id: string | number
  item_type: 'book' | 'article' | 'media' | 'album'
  amount: number
  status: 'pending' | 'approved' | 'rejected'
  payment_method?: 'coins' | 'bank' | 'coupon'
  created_at?: string
}

// ─────────────────────────────────────────────────
// Reviews & Replies
// ─────────────────────────────────────────────────
export interface Review {
  id: string | number
  user_id: string | number
  user?: User
  book_id?: string | number
  article_id?: string | number
  rating?: number
  comment: string
  created_at?: string
  replies?: Reply[]
}

export interface Reply {
  id: string | number
  user_id: string | number
  user?: User
  review_id: string | number
  content: string
  created_at?: string
}

export type SearchResults = {
  books?: Book[]
  articles?: Article[]
  authors?: Author[]
}
