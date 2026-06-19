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
// Books
// ─────────────────────────────────────────────────
export interface Book {
  id: string | number
  title: string
  cover?: string
  cover_url?: string
  author?: string
  author_id?: string | number
  description?: string
  price?: number
  currency?: string
  is_free?: boolean
  is_purchased?: boolean
  category_id?: string | number
  category?: Category
  pages?: number
  file_url?: string
  epub_url?: string
  views?: number
  rating?: number
  ratings_count?: number
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
// Articles
// ─────────────────────────────────────────────────
export interface Article {
  id: string | number
  title: string
  content?: string
  thumbnail?: string
  thumbnail_url?: string
  author?: string
  author_id?: string | number
  category_id?: string | number
  category?: Category
  is_free?: boolean
  is_purchased?: boolean
  price?: number
  views?: number
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
  artist?: Author
  album_id?: string | number
  album?: Album
  genre?: string
  mood?: string
  is_free?: boolean
  is_purchased?: boolean
  price?: number
  views?: number
  likes?: number
  is_liked?: boolean
  created_at?: string
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
// Reviews & Comments
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

// ─────────────────────────────────────────────────
// Purchases
// ─────────────────────────────────────────────────
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

export interface Coin {
  id: string | number
  amount: number
  price: number
  currency?: string
}

export interface Bank {
  id: string | number
  name: string
  account_number?: string
  account_name?: string
  logo?: string
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
  media?: MediaItem[]
}

export interface AppInitData {
  featured_books?: Book[]
  trending?: MediaItem[]
  categories?: Category[]
  banners?: string[]
  app_name?: string
  app_version?: string
}

export interface Country {
  id: string | number
  name: string
  code?: string
  flag?: string
}
