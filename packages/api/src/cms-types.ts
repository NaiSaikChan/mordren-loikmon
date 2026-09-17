/**
 * Response types of the CMS API (`/api/v1/cms`).
 *
 * These mirror the database rows more closely than the storefront types in
 * `types.ts`: an editor needs the workflow state, the audit trail and the raw
 * storage keys, not the reader-facing projection.
 */

import type {
  DisplayShape,
  MediaAssetType,
  MediaCategory,
  MediaIssue,
  ResponsiveImage,
  StorageKind,
} from '@loikmon/media-standards'
import type { Id, ItemType, Pagination, Plan, SubscriptionPlatform, SubscriptionStatus } from './types.js'

export type Permission = string

export type WorkflowStatus = 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived'
export type RoleScope = 'all' | 'own'
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected'
export type ReviewStatus = 'published' | 'pending' | 'hidden'
export type ReportReason = 'spam' | 'abuse' | 'spoiler' | 'off_topic' | 'other'
export type ReportStatus = 'open' | 'dismissed' | 'actioned'
export type CouponScope = 'global' | 'subscription' | 'book' | 'article'
export type DiscountType = 'percent' | 'fixed'
export type CouponStatus = 'draft' | 'active' | 'paused' | 'expired' | 'archived'
export type TicketCategory = 'bug' | 'content' | 'billing' | 'account' | 'suggestion' | 'other'
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed'
export type PolicyKind = 'terms' | 'privacy' | 'refund' | 'content' | 'custom'
export type PolicyVersionStatus = 'draft' | 'published' | 'archived'
export type SliderAudience = 'all' | 'guests' | 'members' | 'subscribers' | 'non_subscribers'
/** Storage folder of an object key. Uploads are addressed by `MediaAssetType` (see @loikmon/media-standards). */
export type AssetKind = StorageKind
export type { MediaAssetType, MediaCategory, MediaIssue, ResponsiveImage }

export interface PermissionGroup {
  key: string
  label: string
  permissions: Permission[]
}

// ── Session ────────────────────────────────────────────────────────────────

export interface CmsSession {
  status: 'ok'
  /** False when the account holds no CMS permission at all. */
  can_access: boolean
  user: { id: string; email: string; primary_role: string }
  roles: Array<{ id: Id; role_key: string; name: string; scope: RoleScope }>
  scope: RoleScope
  permissions: Permission[]
  /** Author profiles this account owns; drives the `own` scope. */
  author_profiles: Array<{ id: Id; name: string }>
  permission_groups: PermissionGroup[]
}

// ── Roles & users ──────────────────────────────────────────────────────────

export interface CmsRole {
  id: Id
  role_key: string
  name: string
  description: string | null
  scope: RoleScope
  rank: number
  is_system: boolean
  permissions: Permission[]
  users_count: number
  created_at: string
  updated_at: string
}

export interface CmsUserRow {
  id: string
  email: string
  name: string
  role: string
  role_keys: string[]
  email_verified: boolean
  phone: string | null
  author_id: Id | null
  created_at: string
}

export interface CmsUserDetail {
  status: 'ok'
  user: {
    id: string
    email: string
    name: string
    firstname: string | null
    lastname: string | null
    phone: string | null
    role: string
    email_verified: boolean
    image: string | null
    created_at: string
  }
  roles: Array<{ id: Id; role_key: string; name: string; scope: RoleScope }>
  subscriptions: unknown[]
  grants: unknown[]
  entitlement: { active: boolean; source: string | null; expires_at: string | null }
  author_profile: { id: Id; name: string } | null
  recent_activity: AuditLogEntry[]
}

export interface BulkResult<T = Id> {
  status: 'ok'
  succeeded: T[]
  failed: Array<{ id: T; message: string }>
}

// ── Content ────────────────────────────────────────────────────────────────

export interface CmsBook {
  id: Id
  title: string
  description: string | null
  author_id: Id | null
  author_name: string | null
  category_id: Id | null
  category_name: string | null
  subcategory_id: Id | null
  language: string
  pages: number | null
  publisher: string | null
  published_at: string | null
  cover_key: string | null
  pdf_key: string | null
  epub_key: string | null
  /** Explicit social card; the cover's generated card is used when null. */
  og_image_key: string | null
  is_free: boolean
  is_published: boolean
  is_recommended: boolean
  is_top: boolean
  status: WorkflowStatus
  revision: number
  view_count: number
  rating_avg: number
  rating_count: number
  audio_chapters_count?: number
  review_note: string | null
  created_at: string
  updated_at: string
}

export interface CmsBookDetail extends CmsBook {
  chapters: CmsChapter[]
  tags: string[]
  versions: ContentVersionSummary[]
}

export interface CmsChapter {
  id: Id
  book_id: Id
  chapter_number: number
  title: string
  audio_key: string
  duration_seconds: number | null
  is_preview: boolean
  created_at: string
  updated_at: string
}

export interface CmsArticle {
  id: Id
  title: string
  excerpt: string | null
  author_id: Id | null
  author_name: string | null
  category_id: Id | null
  category_name: string | null
  subcategory_id: Id | null
  thumbnail_key: string | null
  audio_key: string | null
  og_image_key: string | null
  is_free: boolean
  is_published: boolean
  status: WorkflowStatus
  revision: number
  view_count: number
  rating_avg: number
  rating_count: number
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface CmsArticleDetail extends CmsArticle {
  content: string
  review_note: string | null
  tags: string[]
  versions: ContentVersionSummary[]
}

export interface ContentVersionSummary {
  id: Id
  version: number
  change_note: string | null
  created_by: string | null
  created_at: string
}

export interface ContentVersion extends ContentVersionSummary {
  entity_type: ItemType
  entity_id: Id
  snapshot: Record<string, unknown>
}

export interface CmsTag {
  id: Id
  slug: string
  name: string
  usage_count: number
}

// ── Taxonomy ───────────────────────────────────────────────────────────────

export interface CmsAuthor {
  id: Id
  user_id: string | null
  user_email?: string | null
  name: string
  bio: string | null
  avatar_key: string | null
  website: string | null
  facebook: string | null
  youtube: string | null
  instagram: string | null
  is_verified: boolean
  verification_status: VerificationStatus
  verified_at: string | null
  verification_note: string | null
  books_count?: number
  articles_count?: number
  followers_count?: number
  created_at: string
  updated_at: string
}

export interface CmsAuthorDetail extends CmsAuthor {
  books: Array<{ id: Id; title: string; status: WorkflowStatus; view_count: number; rating_avg: number; rating_count: number }>
  articles: Array<{ id: Id; title: string; status: WorkflowStatus; view_count: number; rating_avg: number }>
  stats: { books: number; articles: number; book_views: number; article_views: number }
}

export interface CategoryNode {
  id: Id
  parent_id: Id | null
  type: ItemType | 'all'
  name: string
  thumbnail_key: string | null
  cover_key: string | null
  display_order: number
  books_count: number
  articles_count: number
  children: CategoryNode[]
}

export interface CmsCollection {
  id: Id
  title: string
  description: string | null
  thumbnail_key: string | null
  display_order: number
  is_published: boolean
  is_featured: boolean
  slug: string | null
  items_count?: number
  items?: Array<{ item_type: ItemType; item_id: Id; position: number; title: string }>
  created_at: string
  updated_at: string
}

export interface CmsSlider {
  id: Id
  title: string | null
  image_key: string
  image_url: string
  /** 4:5 phone artwork; the storefront falls back to `image_key`. */
  mobile_image_key: string | null
  mobile_image_url: string | null
  link: string | null
  display_order: number
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  audience: SliderAudience
  placement: string
  created_at: string
  updated_at: string
}

// ── Coupons ────────────────────────────────────────────────────────────────

export interface CmsCoupon {
  id: Id
  code: string
  name: string
  description: string | null
  banner_key: string | null
  created_by_user_id: string | null
  author_id: Id | null
  author_name?: string | null
  scope: CouponScope
  book_id: Id | null
  book_title?: string | null
  article_id: Id | null
  article_title?: string | null
  plan_code: string | null
  campaign_type: string
  discount_type: DiscountType
  discount_value: number
  max_discount_cents: number | null
  min_order_cents: number | null
  currency: string
  usage_limit: number | null
  usage_limit_per_user: number | null
  used_count: number
  discount_cents_total?: number
  starts_at: string
  ends_at: string | null
  status: CouponStatus
  created_at: string
  updated_at: string
}

export interface CmsCouponDetail extends CmsCoupon {
  redemptions: Array<{
    id: Id
    user_id: string | null
    user_email: string | null
    item_type: string
    item_id: Id | null
    discount_cents: number
    gross_cents: number
    currency: string
    created_at: string
  }>
}

export interface CouponPerformance {
  coupon_id: Id
  redemptions: number
  unique_users: number
  discount_cents: number
  gross_cents: number
  net_cents: number
  redemption_rate: number | null
  last_redeemed_at: string | null
  daily: Array<{ date: string; redemptions: number; discount_cents: number }>
}

export interface CouponSummary {
  coupons: number
  active: number
  redemptions: number
  discount_cents: number
  gross_cents: number
  top: Array<{ id: Id; code: string; name: string; redemptions: number; discount_cents: number }>
  daily: Array<{ date: string; redemptions: number; discount_cents: number }>
}

export interface CouponInputPayload {
  code?: string
  name: string
  description?: string | null
  banner_key?: string | null
  scope: CouponScope
  book_id?: Id | null
  article_id?: Id | null
  plan_code?: string | null
  campaign_type?: string
  discount_type: DiscountType
  discount_value: number
  max_discount_cents?: number | null
  min_order_cents?: number | null
  currency?: string
  usage_limit?: number | null
  usage_limit_per_user?: number | null
  starts_at?: string | null
  ends_at?: string | null
  status?: CouponStatus
}

// ── Community ──────────────────────────────────────────────────────────────

export interface CmsReview {
  id: Id
  user_id: string
  user_name: string | null
  user_email: string | null
  item_type: ItemType
  item_id: Id
  book_title?: string | null
  article_title?: string | null
  rating: number
  content: string | null
  status: ReviewStatus
  report_count: number
  moderation_note: string | null
  moderated_at: string | null
  created_at: string
  updated_at: string
}

export interface ReviewMetrics {
  total: number
  average_rating: number
  pending: number
  hidden: number
  reported: number
  open_reports: number
  distribution: Array<{ rating: number; count: number }>
  daily: Array<{ date: string; count: number }>
}

export interface CmsReviewReport {
  id: Id
  review_id: Id
  reporter_id: string | null
  reporter_email: string | null
  reason: ReportReason
  note: string | null
  status: ReportStatus
  review_content: string | null
  review_rating: number | null
  review_status: ReviewStatus | null
  created_at: string
}

export interface CmsTicket {
  id: Id
  reference: string
  user_id: string | null
  email: string | null
  name: string | null
  subject: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  assigned_to: string | null
  assignee_name?: string | null
  messages_count?: number
  resolution_note: string | null
  first_response_at: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface CmsTicketDetail extends CmsTicket {
  messages: Array<{
    id: Id
    body: string
    is_internal: boolean
    author_user_id: string | null
    author_name: string | null
    author_email: string | null
    created_at: string
  }>
}

export interface FeedbackMetrics {
  by_status: Partial<Record<TicketStatus, number>>
  open: number
  by_category: Array<{ category: TicketCategory; count: number }>
  avg_resolution_minutes: number
  avg_first_response_minutes: number
  daily: Array<{ date: string; count: number }>
}

// ── Policies & settings ────────────────────────────────────────────────────

export interface CmsPolicySummary {
  id: Id
  slug: string
  title: string
  kind: PolicyKind
  thumbnail_key: string | null
  published_version: number | null
  versions_count: number
  draft_version: number | null
  created_at: string
  updated_at: string
}

export interface CmsPolicyVersion {
  id: Id
  policy_id: Id
  version: number
  title: string
  body: string
  summary: string | null
  status: PolicyVersionStatus
  effective_at: string | null
  published_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CmsPolicyDetail extends CmsPolicySummary {
  versions: Array<Omit<CmsPolicyVersion, 'body' | 'policy_id'>>
  current: CmsPolicyVersion | null
  draft: CmsPolicyVersion | null
}

export interface PublicPolicy {
  slug: string
  kind: PolicyKind
  title: string
  summary: string | null
  body: string
  version: number
  effective_at: string | null
  published_at: string | null
}

/** A membership plan as the CMS edits it, with its 16:9 artwork. */
export type CmsPlan = Plan & { image_key: string | null; image: ResponsiveImage | null }

// ── Media library ──────────────────────────────────────────────────────────

export interface MediaVariant {
  key: string
  width: number
  height: number
  bytes: number
  url: string | null
}

export interface MediaAsset {
  id: Id
  key: string
  asset_type: MediaAssetType
  asset_type_label: string
  category: MediaCategory
  storage_kind: StorageKind
  visibility: 'public' | 'private'
  folder_id: Id | null
  original_name: string
  title: string | null
  alt_text: string | null
  mime_type: string
  format: string
  size_bytes: number
  /** Original plus every generated variant. */
  total_bytes: number
  width: number | null
  height: number | null
  has_alpha: boolean
  /** Placeholder colour while the image loads. */
  dominant_color: string | null
  display: DisplayShape | null
  /** Public URL of the original; null for private files (use `cms.media.signedUrl`). */
  url: string | null
  image: ResponsiveImage | null
  variants: Partial<Record<string, MediaVariant>>
  uploaded_by: string | null
  usage_count?: number
  created_at: string
  updated_at: string
}

export interface MediaUsage {
  /** Registry id, e.g. `book.cover`. */
  reference: string
  label: string
  entity_type: string
  entity_id: string
  entity_label: string | null
}

export interface MediaAssetDetail extends MediaAsset {
  usage_count: number
  usages: MediaUsage[]
}

export interface MediaFolder {
  id: Id
  parent_id: Id | null
  name: string
  asset_count: number
  created_at: string
  updated_at: string
}

export interface MediaStats {
  assets: number
  total_bytes: number
  original_bytes: number
  by_category: Partial<Record<MediaCategory, { count: number; bytes: number }>>
  unused: { count: number; bytes: number }
}

export type ResolvedMedia =
  | { key: string; registered: true; asset: MediaAsset }
  | { key: string; registered: false; url: string | null; image: ResponsiveImage | null }

export interface MediaUploadResponse {
  status: 'ok'
  key: string
  public_url: string | null
  asset: MediaAsset | null
  warnings: MediaIssue[]
  /** An identical file of the same type already existed and was reused. */
  reused: boolean
}

export interface MediaListQuery {
  page?: number
  limit?: number
  q?: string
  category?: MediaCategory
  asset_type?: MediaAssetType
  /** Folder id, or `root` for unfiled assets; omit for all folders. */
  folder?: Id | 'root'
  usage?: 'used' | 'unused'
  sort?: 'latest' | 'oldest' | 'name' | 'largest'
}

export interface MediaBulkUploadResult {
  name: string
  ok: boolean
  asset?: MediaAsset | null
  warnings?: MediaIssue[]
  reused?: boolean
  error?: { code: string; message: string; details?: unknown }
}

export interface CmsSetting {
  key: string
  group: string
  value: unknown
  is_public: boolean
  updated_at: string | null
}

// ── Analytics & audit ──────────────────────────────────────────────────────

export interface TimeSeriesPoint {
  date: string
  value: number
}

export interface AdminOverview {
  range: { from: string; to: string }
  revenue: { estimated_cents: number; currency: string; new_subscriptions: number; series: TimeSeriesPoint[] }
  users: { total: number; new_in_range: number; active_in_range: number; verified: number; series: TimeSeriesPoint[] }
  subscriptions: {
    active: number
    in_grace: number
    canceled: number
    expired: number
    by_plan: Array<{ plan_code: string; count: number }>
  }
  content: {
    books: Record<string, number>
    articles: Record<string, number>
    authors: number
    categories: number
    collections: number
    total_views: number
  }
  top_books: Array<{ id: Id; title: string; views: number; rating: number }>
  top_articles: Array<{ id: Id; title: string; views: number; rating: number }>
}

export interface AuthorOverview {
  range: { from: string; to: string }
  totals: {
    books: number
    articles: number
    views: number
    downloads: number
    listens: number
    followers: number
    average_rating: number
  }
  top_books: Array<{ id: Id; title: string; views: number; rating: number; rating_count: number }>
  top_articles: Array<{ id: Id; title: string; views: number; rating: number }>
  reading_progress: Array<{ format: string; readers: number }>
}

export interface EngagementStats {
  by_format: Array<{ format: string; readers: number; sessions: number }>
  library_saves: Array<{ item_type: ItemType; count: number }>
  new_follows: number
  reviews_series: TimeSeriesPoint[]
}

export interface AuthorPerformanceRow {
  id: Id
  name: string
  books: number
  articles: number
  views: number
  followers: number
  new_in_range: number
}

/** `scope: 'own'` is returned to an author who has no platform analytics. */
export type DashboardResponse =
  | { status: 'ok'; scope: 'own'; author: AuthorOverview }
  | {
      status: 'ok'
      scope: 'platform'
      overview: AdminOverview
      engagement: EngagementStats
      authors: AuthorPerformanceRow[]
      coupons: CouponSummary | null
      reviews: ReviewMetrics | null
      feedback: FeedbackMetrics | null
    }

export interface AuditLogEntry {
  id: Id
  actor_id: string | null
  actor_email: string | null
  actor_role: string | null
  action: string
  entity_type: string
  entity_id: string | null
  summary: string | null
  before_data: unknown
  after_data: unknown
  ip: string | null
  user_agent: string | null
  request_id: string | null
  created_at: string
}

export interface CmsSubscriptionRow {
  id: string
  user_id: string
  user_email: string | null
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

// ── Envelope helpers ───────────────────────────────────────────────────────

export type Ok = { status: 'ok' }
export type Paged<K extends string, T> = { status: 'ok'; pagination: Pagination } & { [P in K]: T[] }

export interface PresignedUpload {
  key: string
  url: string
  method: 'PUT'
  headers: Record<string, string>
  expires_at: string
}
