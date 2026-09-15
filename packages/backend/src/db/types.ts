import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely'

/**
 * Kysely table typings. Tables owned by Better Auth (users, sessions,
 * accounts, verifications) are typed only with the columns this app reads.
 *
 * Conventions: snake_case columns, UTC `datetime(3)` timestamps, booleans are
 * TINYINT(1) cast to JS booleans by the pool's typeCast.
 */

type CreatedAt = ColumnType<Date, Date | undefined, never>
type UpdatedAt = ColumnType<Date, Date | undefined, Date | undefined>
type Json<T> = ColumnType<T, string, string>

export type ItemType = 'book' | 'article'
export type Platform = 'app_store' | 'google_play' | 'manual'
export type StoreEnvironment = 'production' | 'sandbox'
export type SubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'grace_period'
  | 'billing_retry'
  | 'paused'
  | 'pending'
  | 'expired'
  | 'revoked'
export type UserRole = 'user' | 'admin'

export interface UsersTable {
  id: string
  name: string
  email: string
  email_verified: boolean
  image: string | null
  firstname: string | null
  lastname: string | null
  phone: string | null
  role: string | null
  created_at: Date
  updated_at: Date
}

export type CategoryType = ItemType | 'all'

export interface CategoriesTable {
  id: Generated<number>
  parent_id: number | null
  type: Generated<CategoryType>
  name: string
  thumbnail_key: string | null
  display_order: Generated<number>
  legacy_id: string | null
  created_at: CreatedAt
  updated_at: UpdatedAt
}

export interface AuthorsTable {
  id: Generated<number>
  user_id: string | null
  name: string
  bio: string | null
  avatar_key: string | null
  website: string | null
  facebook: string | null
  youtube: string | null
  instagram: string | null
  is_verified: Generated<boolean>
  legacy_id: string | null
  created_at: CreatedAt
  updated_at: UpdatedAt
}

export interface AuthorFollowsTable {
  user_id: string
  author_id: number
  created_at: CreatedAt
}

export interface BooksTable {
  id: Generated<number>
  author_id: number | null
  category_id: number | null
  subcategory_id: number | null
  title: string
  description: string | null
  language: Generated<string>
  pages: number | null
  publisher: string | null
  published_at: Date | null
  cover_key: string | null
  pdf_key: string | null
  epub_key: string | null
  is_free: Generated<boolean>
  is_published: Generated<boolean>
  is_recommended: Generated<boolean>
  is_top: Generated<boolean>
  view_count: Generated<number>
  rating_avg: Generated<number>
  rating_count: Generated<number>
  legacy_id: string | null
  created_at: CreatedAt
  updated_at: UpdatedAt
}

export interface BookAudioChaptersTable {
  id: Generated<number>
  book_id: number
  chapter_number: number
  title: string
  audio_key: string
  duration_seconds: number | null
  is_preview: Generated<boolean>
  created_at: CreatedAt
  updated_at: UpdatedAt
}

export interface ArticlesTable {
  id: Generated<number>
  author_id: number | null
  category_id: number | null
  subcategory_id: number | null
  title: string
  excerpt: string | null
  content: string
  thumbnail_key: string | null
  audio_key: string | null
  is_free: Generated<boolean>
  is_published: Generated<boolean>
  view_count: Generated<number>
  rating_avg: Generated<number>
  rating_count: Generated<number>
  published_at: Date | null
  legacy_id: string | null
  created_at: CreatedAt
  updated_at: UpdatedAt
}

export interface CollectionsTable {
  id: Generated<number>
  title: string
  description: string | null
  thumbnail_key: string | null
  display_order: Generated<number>
  is_published: Generated<boolean>
  created_at: CreatedAt
  updated_at: UpdatedAt
}

export interface CollectionItemsTable {
  collection_id: number
  item_type: ItemType
  item_id: number
  position: Generated<number>
}

export interface SlidersTable {
  id: Generated<number>
  title: string | null
  image_key: string
  link: string | null
  display_order: Generated<number>
  is_active: Generated<boolean>
  created_at: CreatedAt
  updated_at: UpdatedAt
}

export interface FaqsTable {
  id: Generated<number>
  question: string
  answer: string
  display_order: Generated<number>
  is_published: Generated<boolean>
  created_at: CreatedAt
  updated_at: UpdatedAt
}

export interface NotificationsTable {
  id: Generated<number>
  /** NULL = broadcast to every user. */
  user_id: string | null
  type: string
  title: string
  message: string | null
  data: Json<Record<string, unknown> | null> | null
  created_at: CreatedAt
}

export interface ReviewsTable {
  id: Generated<number>
  user_id: string
  item_type: ItemType
  item_id: number
  rating: number
  content: string | null
  created_at: CreatedAt
  updated_at: UpdatedAt
}

export interface LibraryItemsTable {
  user_id: string
  item_type: ItemType
  item_id: number
  created_at: CreatedAt
}

export interface ReadingProgressTable {
  user_id: string
  book_id: number
  format: 'pdf' | 'epub' | 'audio'
  location: string | null
  progress: number
  updated_at: UpdatedAt
}

export interface SubscriptionPlansTable {
  code: string
  name: string
  description: string | null
  price_cents: number
  currency: string
  period_months: number
  apple_product_id: string | null
  google_product_id: string | null
  google_base_plan_id: string | null
  display_order: Generated<number>
  is_active: Generated<boolean>
  created_at: CreatedAt
  updated_at: UpdatedAt
}

export interface SubscriptionsTable {
  id: string
  user_id: string
  plan_code: string | null
  platform: Platform
  /** Apple originalTransactionId, Google purchaseToken, or a manual reference. */
  store_subscription_id: string
  product_id: string | null
  status: SubscriptionStatus
  auto_renew: boolean
  environment: StoreEnvironment
  started_at: Date | null
  expires_at: Date | null
  grace_expires_at: Date | null
  canceled_at: Date | null
  revoked_at: Date | null
  latest_transaction_id: string | null
  linked_purchase_token: string | null
  last_verified_at: Date | null
  raw_data: Json<unknown> | null
  created_at: CreatedAt
  updated_at: UpdatedAt
}

export interface SubscriptionEventsTable {
  id: Generated<number>
  platform: Platform
  event_id: string
  event_type: string
  event_subtype: string | null
  subscription_id: string | null
  user_id: string | null
  outcome: 'processed' | 'ignored' | 'failed'
  error: string | null
  payload: Json<unknown> | null
  created_at: CreatedAt
}

export interface EntitlementGrantsTable {
  id: Generated<number>
  user_id: string
  reason: string
  starts_at: Date
  expires_at: Date | null
  granted_by: string | null
  revoked_at: Date | null
  created_at: CreatedAt
}

export interface Database {
  users: UsersTable
  categories: CategoriesTable
  authors: AuthorsTable
  author_follows: AuthorFollowsTable
  books: BooksTable
  book_audio_chapters: BookAudioChaptersTable
  articles: ArticlesTable
  collections: CollectionsTable
  collection_items: CollectionItemsTable
  sliders: SlidersTable
  faqs: FaqsTable
  notifications: NotificationsTable
  reviews: ReviewsTable
  library_items: LibraryItemsTable
  reading_progress: ReadingProgressTable
  subscription_plans: SubscriptionPlansTable
  subscriptions: SubscriptionsTable
  subscription_events: SubscriptionEventsTable
  entitlement_grants: EntitlementGrantsTable
}

export type Book = Selectable<BooksTable>
export type NewBook = Insertable<BooksTable>
export type BookUpdate = Updateable<BooksTable>
export type Article = Selectable<ArticlesTable>
export type Author = Selectable<AuthorsTable>
export type Category = Selectable<CategoriesTable>
export type AudioChapter = Selectable<BookAudioChaptersTable>
export type SubscriptionPlan = Selectable<SubscriptionPlansTable>
export type Subscription = Selectable<SubscriptionsTable>
export type EntitlementGrant = Selectable<EntitlementGrantsTable>
export type User = Selectable<UsersTable>
