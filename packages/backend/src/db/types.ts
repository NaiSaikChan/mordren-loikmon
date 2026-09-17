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
export type UserRole = 'user' | 'admin' | 'manager' | 'author' | (string & {})

/** Editorial workflow state of a book or article. `is_published` stays in sync with it. */
export type WorkflowStatus = 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived'
export type RoleScope = 'all' | 'own'
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected'
export type ReviewStatus = 'published' | 'pending' | 'hidden'
export type ReportReason = 'spam' | 'abuse' | 'spoiler' | 'off_topic' | 'other'
export type ReportStatus = 'open' | 'dismissed' | 'actioned'
export type CouponScope = 'global' | 'subscription' | 'book' | 'article'
export type DiscountType = 'percent' | 'fixed'
export type CouponStatus = 'draft' | 'active' | 'paused' | 'expired' | 'archived'
export type RedemptionItemType = ItemType | 'subscription' | 'order'
export type TicketCategory = 'bug' | 'content' | 'billing' | 'account' | 'suggestion' | 'other'
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed'
export type PolicyKind = 'terms' | 'privacy' | 'refund' | 'content' | 'custom'
export type PolicyVersionStatus = 'draft' | 'published' | 'archived'
export type MediaCategory = 'image' | 'document' | 'audio'
export type SliderAudience = 'all' | 'guests' | 'members' | 'subscribers' | 'non_subscribers'

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
  cover_key: string | null
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
  verification_status: Generated<VerificationStatus>
  verified_at: Date | null
  verified_by: string | null
  verification_note: string | null
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
  status: Generated<WorkflowStatus>
  submitted_at: Date | null
  reviewed_by: string | null
  review_note: string | null
  created_by: string | null
  updated_by: string | null
  revision: Generated<number>
  legacy_id: string | null
  created_at: CreatedAt
  updated_at: UpdatedAt
  /** Explicit social card; generated from the cover when null. */
  og_image_key: string | null
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
  status: Generated<WorkflowStatus>
  submitted_at: Date | null
  reviewed_by: string | null
  review_note: string | null
  created_by: string | null
  updated_by: string | null
  revision: Generated<number>
  published_at: Date | null
  legacy_id: string | null
  created_at: CreatedAt
  updated_at: UpdatedAt
  /** Explicit social card; generated from the cover when null. */
  og_image_key: string | null
}

export interface CollectionsTable {
  id: Generated<number>
  title: string
  description: string | null
  thumbnail_key: string | null
  display_order: Generated<number>
  is_published: Generated<boolean>
  is_featured: Generated<boolean>
  slug: string | null
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
  /** 4:5 banner for phones; falls back to image_key when null. */
  mobile_image_key: string | null
  link: string | null
  display_order: Generated<number>
  is_active: Generated<boolean>
  starts_at: Date | null
  ends_at: Date | null
  audience: Generated<SliderAudience>
  placement: Generated<string>
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
  status: Generated<ReviewStatus>
  moderated_by: string | null
  moderated_at: Date | null
  moderation_note: string | null
  report_count: Generated<number>
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
  image_key: string | null
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

// ── CMS module ───────────────────────────────────────────────────────────────

/** Better Auth owns this table; typed read-only for analytics (active users). */
export interface SessionsTable {
  id: string
  user_id: string
  expires_at: Date
  ip_address: string | null
  user_agent: string | null
  created_at: Date
  updated_at: Date
}

export interface RolesTable {
  id: Generated<number>
  role_key: string
  name: string
  description: string | null
  scope: Generated<RoleScope>
  rank: Generated<number>
  is_system: Generated<boolean>
  created_at: CreatedAt
  updated_at: UpdatedAt
}

export interface RolePermissionsTable {
  role_id: number
  permission: string
}

export interface UserRolesTable {
  user_id: string
  role_id: number
  granted_by: string | null
  created_at: CreatedAt
}

export interface AuditLogsTable {
  id: Generated<number>
  actor_id: string | null
  actor_email: string | null
  actor_role: string | null
  action: string
  entity_type: string
  entity_id: string | null
  summary: string | null
  before_data: Json<unknown> | null
  after_data: Json<unknown> | null
  ip: string | null
  user_agent: string | null
  request_id: string | null
  created_at: CreatedAt
}

export interface ContentVersionsTable {
  id: Generated<number>
  entity_type: ItemType
  entity_id: number
  version: number
  snapshot: Json<Record<string, unknown>>
  change_note: string | null
  created_by: string | null
  created_at: CreatedAt
}

export interface TagsTable {
  id: Generated<number>
  slug: string
  name: string
  created_at: CreatedAt
}

export interface ContentTagsTable {
  tag_id: number
  item_type: ItemType
  item_id: number
}

export interface ReviewReportsTable {
  id: Generated<number>
  review_id: number
  reporter_id: string | null
  reason: ReportReason
  note: string | null
  status: Generated<ReportStatus>
  resolved_by: string | null
  resolved_at: Date | null
  created_at: CreatedAt
}

export interface CouponsTable {
  id: Generated<number>
  code: string
  name: string
  description: string | null
  banner_key: string | null
  created_by_user_id: string | null
  /** Owning author; NULL for platform-wide campaigns. */
  author_id: number | null
  scope: CouponScope
  book_id: number | null
  article_id: number | null
  plan_code: string | null
  campaign_type: Generated<string>
  discount_type: DiscountType
  /** Percent: 1-100. Fixed: minor currency units. */
  discount_value: number
  max_discount_cents: number | null
  min_order_cents: number | null
  currency: Generated<string>
  usage_limit: number | null
  usage_limit_per_user: number | null
  used_count: Generated<number>
  starts_at: Generated<Date>
  ends_at: Date | null
  status: Generated<CouponStatus>
  created_at: CreatedAt
  updated_at: UpdatedAt
}

export interface CouponRedemptionsTable {
  id: Generated<number>
  coupon_id: number
  user_id: string | null
  item_type: Generated<RedemptionItemType>
  item_id: number | null
  discount_cents: Generated<number>
  gross_cents: Generated<number>
  currency: Generated<string>
  source: Generated<string>
  metadata: Json<Record<string, unknown> | null> | null
  created_at: CreatedAt
}

export interface FeedbackTicketsTable {
  id: Generated<number>
  reference: string
  user_id: string | null
  email: string | null
  name: string | null
  subject: string
  category: Generated<TicketCategory>
  priority: Generated<TicketPriority>
  status: Generated<TicketStatus>
  assigned_to: string | null
  resolution_note: string | null
  first_response_at: Date | null
  resolved_at: Date | null
  created_at: CreatedAt
  updated_at: UpdatedAt
}

export interface FeedbackMessagesTable {
  id: Generated<number>
  ticket_id: number
  author_user_id: string | null
  body: string
  is_internal: Generated<boolean>
  created_at: CreatedAt
}

export interface PoliciesTable {
  id: Generated<number>
  slug: string
  title: string
  kind: Generated<PolicyKind>
  thumbnail_key: string | null
  published_version: number | null
  created_at: CreatedAt
  updated_at: UpdatedAt
}

export interface PolicyVersionsTable {
  id: Generated<number>
  policy_id: number
  version: number
  title: string
  body: string
  summary: string | null
  status: Generated<PolicyVersionStatus>
  effective_at: Date | null
  published_at: Date | null
  created_by: string | null
  created_at: CreatedAt
  updated_at: UpdatedAt
}

export interface SettingsTable {
  setting_key: string
  group_key: Generated<string>
  value: Json<unknown>
  is_public: Generated<boolean>
  updated_by: string | null
  updated_at: UpdatedAt
}

export interface MediaFoldersTable {
  id: Generated<number>
  parent_id: number | null
  name: string
  created_by: string | null
  created_at: CreatedAt
  updated_at: UpdatedAt
}

export interface MediaVariantRecord {
  key: string
  width: number
  height: number
  bytes: number
}

export interface MediaAssetsTable {
  id: Generated<number>
  storage_key: string
  storage_kind: string
  /** A MediaAssetType from @loikmon/media-standards. */
  asset_type: string
  category: MediaCategory
  folder_id: number | null
  original_name: string
  title: string | null
  alt_text: string | null
  mime_type: string
  format: string
  size_bytes: number
  width: number | null
  height: number | null
  has_alpha: Generated<boolean>
  dominant_color: string | null
  checksum: string
  variants: Json<Record<string, MediaVariantRecord>> | null
  total_bytes: number
  uploaded_by: string | null
  created_at: CreatedAt
  updated_at: UpdatedAt
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
  sessions: SessionsTable
  roles: RolesTable
  role_permissions: RolePermissionsTable
  user_roles: UserRolesTable
  audit_logs: AuditLogsTable
  content_versions: ContentVersionsTable
  tags: TagsTable
  content_tags: ContentTagsTable
  review_reports: ReviewReportsTable
  coupons: CouponsTable
  coupon_redemptions: CouponRedemptionsTable
  feedback_tickets: FeedbackTicketsTable
  feedback_messages: FeedbackMessagesTable
  policies: PoliciesTable
  policy_versions: PolicyVersionsTable
  settings: SettingsTable
  media_folders: MediaFoldersTable
  media_assets: MediaAssetsTable
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
export type Role = Selectable<RolesTable>
export type Coupon = Selectable<CouponsTable>
export type NewCoupon = Insertable<CouponsTable>
export type CouponUpdate = Updateable<CouponsTable>
export type CouponRedemption = Selectable<CouponRedemptionsTable>
export type FeedbackTicket = Selectable<FeedbackTicketsTable>
export type FeedbackMessage = Selectable<FeedbackMessagesTable>
export type Policy = Selectable<PoliciesTable>
export type PolicyVersion = Selectable<PolicyVersionsTable>
export type Setting = Selectable<SettingsTable>
export type AuditLog = Selectable<AuditLogsTable>
export type Review = Selectable<ReviewsTable>
export type MediaAsset = Selectable<MediaAssetsTable>
export type MediaFolder = Selectable<MediaFoldersTable>
