export interface User {
  id: string | number
  name?: string           // computed from firstname+lastname
  firstname?: string
  lastname?: string
  username?: string
  email: string
  avatar?: string
  avatar_url?: string
  thumbnail?: string      // actual avatar field from server
  coins?: number | string
  phone?: string
  country?: string
  seller?: string | number
  author?: string | number
  isadminuser?: string | number
  email_verified?: boolean
  created_at?: string
  date?: string
  [key: string]: unknown
}

export interface Book {
  id: string | number
  title: string
  author?: string
  authorname?: string
  author_id?: string | number
  category?: string
  cat?: string
  sub?: string
  cover?: string
  cover_url?: string
  thumbnail?: string
  coverphoto?: string
  pdf?: string
  pdffile?: string
  epub?: string
  price?: number | string
  amount?: number | string
  is_free?: boolean
  rating?: number | string
  views?: number | string
  total_views?: number | string
  pages?: number | string
  pagecount?: number | string
  description?: string
  about?: string
  league?: string | number
  [key: string]: unknown
}

export interface BookChapter {
  id: string | number
  title: string
  content?: string
  pdf?: string
  [key: string]: unknown
}

export interface Article {
  id: string | number
  title: string
  author?: string
  category?: string
  categoryname?: string
  cat?: string
  thumbnail?: string
  thumbnail_url?: string
  content?: string
  description?: string
  body?: string
  price?: number | string
  amount?: number | string
  is_free?: boolean
  created_at?: string
  date?: string
  [key: string]: unknown
}

export interface Author {
  id: string | number
  name: string
  bio?: string
  avatar?: string
  thumbnail?: string
  avatar_url?: string
  books_count?: number | string
  followers_count?: number | string
  is_following?: boolean
  [key: string]: unknown
}

export interface Review {
  id: string | number
  content?: string
  comment?: string
  rating?: number
  author_name?: string
  username?: string
  created_at?: string
  [key: string]: unknown
}

export interface Reply {
  id: string | number
  content: string
  review_id: string | number
  author_name?: string
  [key: string]: unknown
}

export interface MediaItem {
  id: string | number
  title: string
  artist?: string
  audio_url?: string
  duration?: number
  thumbnail?: string
  cover?: string
  [key: string]: unknown
}

export interface SearchResults {
  books: Book[]
  articles: Article[]
  authors?: Author[]
}

export interface RawAuthResponse {
  status: string
  message?: string
  token?: string
  user?: Record<string, unknown>
  isadminuser?: string | number
  statuscode?: number
  devices?: unknown[]
  devices_in_use?: number
  device_limit?: number
}

export interface ApiResponse<T = unknown> {
  status?: string | number
  message?: string
  data: T
  [key: string]: unknown
}

export interface Category {
  id: string | number
  name: string
  type?: string
  [key: string]: unknown
}

export interface Album {
  id: string | number
  title: string
  artist?: string
  cover?: string
  thumbnail?: string
  tracks?: MediaItem[]
  [key: string]: unknown
}

export interface Purchase {
  id: string | number
  user_id?: string | number
  item_id?: string | number
  item_type?: 'book' | 'article' | 'media' | 'album'
  amount?: number | string
  status?: 'pending' | 'approved' | 'rejected'
  created_at?: string
  [key: string]: unknown
}

export interface Coin {
  id: string | number
  name: string
  amount?: number | string
  price?: number | string
  [key: string]: unknown
}

export interface Bank {
  id: string | number
  name: string
  account_number?: string
  account_name?: string
  [key: string]: unknown
}

export interface FaqItem {
  id: string | number
  question: string
  answer: string
  [key: string]: unknown
}

export interface InboxMessage {
  id: string | number
  title?: string
  message?: string
  body?: string
  read?: boolean
  created_at?: string
  [key: string]: unknown
}

export interface Collection {
  id: string | number
  title?: string
  name?: string
  items?: unknown[]
  items_count?: number
  [key: string]: unknown
}

export interface SearchResult {
  books?: Book[]
  articles?: Article[]
  authors?: Author[]
  [key: string]: unknown
}

export interface AppInitData {
  user?: User
  books?: Book[]
  articles?: Article[]
  inbox?: InboxMessage[]
  [key: string]: unknown
}

export interface Country {
  id: string | number
  name: string
  code?: string
  [key: string]: unknown
}

export interface AuthResult {
  status: string
  message?: string
  token?: string
  user?: User
  [key: string]: unknown
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
  name: string
  phone?: string
  password_confirmation?: string
  [key: string]: unknown
}
