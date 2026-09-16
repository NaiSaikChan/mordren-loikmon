import { getClient } from '../client.js'
import type {
  AdminOverview,
  AssetKind,
  AuditLogEntry,
  AuthorPerformanceRow,
  BulkResult,
  CategoryNode,
  CmsArticle,
  CmsArticleDetail,
  CmsAuthor,
  CmsAuthorDetail,
  CmsBook,
  CmsBookDetail,
  CmsChapter,
  CmsCollection,
  CmsCoupon,
  CmsCouponDetail,
  CmsPolicyDetail,
  CmsPolicySummary,
  CmsReview,
  CmsReviewReport,
  CmsRole,
  CmsSession,
  CmsSetting,
  CmsSlider,
  CmsSubscriptionRow,
  CmsTag,
  CmsTicket,
  CmsTicketDetail,
  CmsUserDetail,
  CmsUserRow,
  ContentVersion,
  ContentVersionSummary,
  CouponInputPayload,
  CouponPerformance,
  CouponSummary,
  CouponStatus,
  DashboardResponse,
  FeedbackMetrics,
  Ok,
  Paged,
  PermissionGroup,
  PresignedUpload,
  ReviewMetrics,
  ReviewStatus,
  RoleScope,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  VerificationStatus,
  WorkflowStatus,
} from '../cms-types.js'
import type { Id, ItemType, Pagination, Plan } from '../types.js'

/**
 * CMS API (`/api/v1/cms`).
 *
 * Every call is authenticated with the same bearer token as the storefront;
 * the server decides what the session may reach. A 403 with code
 * `PERMISSION_DENIED` carries the missing permission in `details.required`, and
 * `OWNERSHIP_REQUIRED` means the row belongs to another author.
 */

const c = () => getClient()

export interface ContentQuery {
  page?: number
  limit?: number
  q?: string
  status?: WorkflowStatus
  author_id?: Id
  category_id?: Id
  free?: boolean
  has_audio?: boolean
  sort?: 'latest' | 'updated' | 'title' | 'popular'
}

export interface CouponQuery {
  page?: number
  limit?: number
  q?: string
  status?: CouponStatus
  scope?: 'global' | 'subscription' | 'book' | 'article'
  author_id?: Id
  campaign_type?: string
}

export interface RangeQuery {
  days?: number
  from?: string
  to?: string
}

export type ContentBulkAction = 'publish' | 'archive' | 'draft' | 'delete'

export const cms = {
  /** Permissions, roles, scope and owned author profiles of the current session. */
  me: () => c().get<CmsSession>('cms/me'),

  // ── Roles & users ────────────────────────────────────────────────────────

  roles: {
    list: () => c().get<{ status: 'ok'; roles: CmsRole[] }>('cms/roles'),
    permissions: () => c().get<{ status: 'ok'; permissions: string[]; groups: PermissionGroup[] }>('cms/permissions'),
    create: (payload: { key: string; name: string; description?: string | null; scope: RoleScope; rank?: number; permissions: string[] }) =>
      c().post<{ status: 'ok'; role: CmsRole }>('cms/roles', payload),
    update: (
      id: Id,
      payload: Partial<{ name: string; description: string | null; scope: RoleScope; rank: number; permissions: string[] }>,
    ) => c().patch<{ status: 'ok'; role: CmsRole }>(`cms/roles/${id}`, payload),
    remove: (id: Id) => c().delete<Ok>(`cms/roles/${id}`),
  },

  users: {
    list: (params: { page?: number; limit?: number; q?: string; role?: string; verified?: boolean; subscribed?: boolean } = {}) =>
      c().get<Paged<'users', CmsUserRow>>('cms/users', { params }),
    get: (id: string) => c().get<CmsUserDetail>(`cms/users/${id}`),
    update: (
      id: string,
      payload: Partial<{ name: string; firstname: string | null; lastname: string | null; phone: string | null; email_verified: boolean }>,
    ) => c().patch<Ok>(`cms/users/${id}`, payload),
    setRoles: (id: string, roleIds: Id[]) =>
      c().put<{ status: 'ok'; primary_role: string; roles: CmsSession['roles'] }>(`cms/users/${id}/roles`, { role_ids: roleIds }),
    remove: (id: string) => c().delete<Ok>(`cms/users/${id}`),
    bulk: (payload: { user_ids: string[]; action: 'verify_email' | 'assign_role' | 'remove_role'; role_id?: Id }) =>
      c().post<BulkResult<string>>('cms/users/bulk', payload),
    grant: (id: string, payload: { reason: string; expires_at: string | null }) =>
      c().post<{ status: 'ok'; id: Id }>(`cms/users/${id}/grants`, payload),
    revokeGrant: (grantId: Id) => c().delete<Ok>(`cms/grants/${grantId}`),
  },

  // ── Books & audiobooks ───────────────────────────────────────────────────

  books: {
    list: (params: ContentQuery = {}) => c().get<Paged<'books', CmsBook>>('cms/books', { params }),
    get: (id: Id) => c().get<{ status: 'ok'; book: CmsBookDetail }>(`cms/books/${id}`),
    create: (payload: Partial<CmsBook> & { title: string; tags?: string[] }) =>
      c().post<{ status: 'ok'; book: CmsBookDetail }>('cms/books', payload),
    update: (id: Id, payload: Partial<CmsBook> & { tags?: string[] }) =>
      c().patch<{ status: 'ok'; book: CmsBookDetail }>(`cms/books/${id}`, payload),
    remove: (id: Id) => c().delete<Ok>(`cms/books/${id}`),
    setStatus: (id: Id, status: WorkflowStatus, note?: string | null) =>
      c().post<{ status: 'ok'; book: { id: Id; status: WorkflowStatus } }>(`cms/books/${id}/status`, { status, note }),
    bulk: (ids: Id[], action: ContentBulkAction) => c().post<BulkResult>('cms/books/bulk', { ids, action }),
    versions: (id: Id) => c().get<{ status: 'ok'; versions: ContentVersionSummary[] }>(`cms/books/${id}/versions`),
    version: (id: Id, version: number) => c().get<{ status: 'ok'; version: ContentVersion }>(`cms/books/${id}/versions/${version}`),
    restore: (id: Id, version: number) =>
      c().post<{ status: 'ok'; item: CmsBookDetail }>(`cms/books/${id}/versions/${version}/restore`),
  },

  chapters: {
    list: (bookId: Id) => c().get<{ status: 'ok'; chapters: CmsChapter[] }>(`cms/books/${bookId}/chapters`),
    create: (bookId: Id, payload: { title: string; audio_key: string; duration_seconds?: number | null; is_preview?: boolean }) =>
      c().post<{ status: 'ok'; chapter: CmsChapter }>(`cms/books/${bookId}/chapters`, payload),
    update: (id: Id, payload: Partial<CmsChapter>) => c().patch<{ status: 'ok'; chapter: CmsChapter }>(`cms/chapters/${id}`, payload),
    remove: (id: Id) => c().delete<Ok>(`cms/chapters/${id}`),
    reorder: (bookId: Id, ids: Id[]) => c().put<{ status: 'ok'; chapters: CmsChapter[] }>(`cms/books/${bookId}/chapters/order`, { ids }),
  },

  // ── Articles ─────────────────────────────────────────────────────────────

  articles: {
    list: (params: ContentQuery = {}) => c().get<Paged<'articles', CmsArticle>>('cms/articles', { params }),
    get: (id: Id) => c().get<{ status: 'ok'; article: CmsArticleDetail }>(`cms/articles/${id}`),
    create: (payload: Partial<CmsArticleDetail> & { title: string; tags?: string[] }) =>
      c().post<{ status: 'ok'; article: CmsArticleDetail }>('cms/articles', payload),
    update: (id: Id, payload: Partial<CmsArticleDetail> & { tags?: string[] }) =>
      c().patch<{ status: 'ok'; article: CmsArticleDetail }>(`cms/articles/${id}`, payload),
    remove: (id: Id) => c().delete<Ok>(`cms/articles/${id}`),
    setStatus: (id: Id, status: WorkflowStatus, note?: string | null) =>
      c().post<{ status: 'ok'; article: { id: Id; status: WorkflowStatus } }>(`cms/articles/${id}/status`, { status, note }),
    bulk: (ids: Id[], action: ContentBulkAction) => c().post<BulkResult>('cms/articles/bulk', { ids, action }),
    versions: (id: Id) => c().get<{ status: 'ok'; versions: ContentVersionSummary[] }>(`cms/articles/${id}/versions`),
    version: (id: Id, version: number) => c().get<{ status: 'ok'; version: ContentVersion }>(`cms/articles/${id}/versions/${version}`),
    restore: (id: Id, version: number) =>
      c().post<{ status: 'ok'; item: CmsArticleDetail }>(`cms/articles/${id}/versions/${version}/restore`),
  },

  tags: {
    list: () => c().get<{ status: 'ok'; tags: CmsTag[] }>('cms/tags'),
  },

  // ── Taxonomy ─────────────────────────────────────────────────────────────

  authors: {
    list: (params: { page?: number; limit?: number; q?: string; verification?: VerificationStatus } = {}) =>
      c().get<Paged<'authors', CmsAuthor>>('cms/authors', { params }),
    get: (id: Id) => c().get<{ status: 'ok'; author: CmsAuthorDetail }>(`cms/authors/${id}`),
    create: (payload: Partial<CmsAuthor> & { name: string }) => c().post<{ status: 'ok'; author: CmsAuthor }>('cms/authors', payload),
    update: (id: Id, payload: Partial<CmsAuthor>) => c().patch<{ status: 'ok'; author: CmsAuthor }>(`cms/authors/${id}`, payload),
    remove: (id: Id) => c().delete<Ok>(`cms/authors/${id}`),
    setVerification: (id: Id, status: VerificationStatus, note?: string | null) =>
      c().post<{ status: 'ok'; author: CmsAuthor }>(`cms/authors/${id}/verification`, { status, note }),
  },

  categories: {
    tree: () => c().get<{ status: 'ok'; categories: CategoryNode[] }>('cms/categories'),
    create: (payload: { name: string; type?: ItemType | 'all'; parent_id?: Id | null; thumbnail_key?: string | null; display_order?: number }) =>
      c().post<{ status: 'ok'; category: CategoryNode }>('cms/categories', payload),
    update: (id: Id, payload: Partial<{ name: string; type: ItemType | 'all'; parent_id: Id | null; thumbnail_key: string | null; display_order: number }>) =>
      c().patch<{ status: 'ok'; category: CategoryNode }>(`cms/categories/${id}`, payload),
    remove: (id: Id) => c().delete<Ok>(`cms/categories/${id}`),
    /** Persists a drag-and-drop reorder of the whole tree. */
    reorder: (items: Array<{ id: Id; parent_id: Id | null; position: number }>) =>
      c().put<{ status: 'ok'; categories: CategoryNode[] }>('cms/categories/order', { items }),
  },

  collections: {
    list: (params: { page?: number; limit?: number; q?: string } = {}) =>
      c().get<Paged<'collections', CmsCollection>>('cms/collections', { params }),
    get: (id: Id) => c().get<{ status: 'ok'; collection: CmsCollection }>(`cms/collections/${id}`),
    create: (payload: Partial<CmsCollection> & { title: string }) =>
      c().post<{ status: 'ok'; collection: CmsCollection }>('cms/collections', payload),
    update: (id: Id, payload: Partial<CmsCollection>) =>
      c().patch<{ status: 'ok'; collection: CmsCollection }>(`cms/collections/${id}`, payload),
    remove: (id: Id) => c().delete<Ok>(`cms/collections/${id}`),
    setItems: (id: Id, items: Array<{ item_type: ItemType; item_id: Id }>) =>
      c().put<{ status: 'ok'; collection: CmsCollection }>(`cms/collections/${id}/items`, { items }),
  },

  sliders: {
    list: (params: { placement?: string } = {}) => c().get<{ status: 'ok'; sliders: CmsSlider[] }>('cms/sliders', { params }),
    create: (payload: Partial<CmsSlider> & { image_key: string }) =>
      c().post<{ status: 'ok'; slider: CmsSlider }>('cms/sliders', payload),
    update: (id: Id, payload: Partial<CmsSlider>) => c().patch<{ status: 'ok'; slider: CmsSlider }>(`cms/sliders/${id}`, payload),
    remove: (id: Id) => c().delete<Ok>(`cms/sliders/${id}`),
    reorder: (ids: Id[]) => c().put<{ status: 'ok'; sliders: CmsSlider[] }>('cms/sliders/order', { ids }),
  },

  // ── Coupons ──────────────────────────────────────────────────────────────

  coupons: {
    list: (params: CouponQuery = {}) => c().get<Paged<'coupons', CmsCoupon>>('cms/coupons', { params }),
    get: (id: Id) => c().get<{ status: 'ok'; coupon: CmsCouponDetail }>(`cms/coupons/${id}`),
    create: (payload: CouponInputPayload) => c().post<{ status: 'ok'; coupon: CmsCoupon }>('cms/coupons', payload),
    update: (id: Id, payload: Partial<CouponInputPayload>) => c().patch<{ status: 'ok'; coupon: CmsCoupon }>(`cms/coupons/${id}`, payload),
    setStatus: (id: Id, status: CouponStatus) => c().post<{ status: 'ok'; coupon: CmsCoupon }>(`cms/coupons/${id}/status`, { status }),
    /** A redeemed campaign is archived rather than deleted. */
    remove: (id: Id) => c().delete<Ok>(`cms/coupons/${id}`),
    suggestCode: () => c().get<{ status: 'ok'; code: string }>('cms/coupons/suggest-code'),
    summary: (params: RangeQuery = {}) => c().get<{ status: 'ok'; summary: CouponSummary }>('cms/coupons/summary', { params }),
    performance: (id: Id, params: RangeQuery = {}) =>
      c().get<{ status: 'ok'; performance: CouponPerformance }>(`cms/coupons/${id}/performance`, { params }),
    /** Dry run against a hypothetical order. */
    validate: (payload: { code: string; item_type?: 'book' | 'article' | 'subscription' | 'order'; item_id?: Id | null; plan_code?: string | null; gross_cents: number }) =>
      c().post<{ status: 'ok'; coupon: { id: Id; code: string; name: string; scope: string }; discount_cents: number; net_cents: number }>(
        'cms/coupons/validate',
        payload,
      ),
    /** CSV text of the campaigns the session may see. */
    exportCsv: (params: Omit<CouponQuery, 'page' | 'limit'> = {}) =>
      c().get<string>('cms/coupons/export', { params, responseType: 'text' }),
  },

  // ── Community ────────────────────────────────────────────────────────────

  reviews: {
    list: (params: { page?: number; limit?: number; q?: string; status?: ReviewStatus; item_type?: ItemType; item_id?: Id; rating?: number; reported?: boolean } = {}) =>
      c().get<Paged<'reviews', CmsReview>>('cms/reviews', { params }),
    metrics: (params: RangeQuery = {}) => c().get<{ status: 'ok'; metrics: ReviewMetrics }>('cms/reviews/metrics', { params }),
    setStatus: (id: Id, status: ReviewStatus, note?: string | null) =>
      c().post<{ status: 'ok'; review: CmsReview }>(`cms/reviews/${id}/status`, { status, note }),
    bulk: (ids: Id[], status: ReviewStatus) => c().post<BulkResult>('cms/reviews/bulk', { ids, status }),
    remove: (id: Id) => c().delete<Ok>(`cms/reviews/${id}`),
    reports: (params: { page?: number; limit?: number; status?: 'open' | 'dismissed' | 'actioned' } = {}) =>
      c().get<Paged<'reports', CmsReviewReport>>('cms/review-reports', { params }),
    resolveReport: (id: Id, outcome: 'dismissed' | 'actioned') => c().post<Ok>(`cms/review-reports/${id}/resolve`, { outcome }),
  },

  feedback: {
    list: (params: { page?: number; limit?: number; q?: string; status?: TicketStatus; category?: TicketCategory; priority?: TicketPriority; assigned_to?: string; unassigned?: boolean } = {}) =>
      c().get<Paged<'tickets', CmsTicket>>('cms/feedback', { params }),
    get: (id: Id) => c().get<{ status: 'ok'; ticket: CmsTicketDetail }>(`cms/feedback/${id}`),
    metrics: (params: RangeQuery = {}) => c().get<{ status: 'ok'; metrics: FeedbackMetrics }>('cms/feedback/metrics', { params }),
    reply: (id: Id, body: string, internal = false) =>
      c().post<{ status: 'ok'; ticket: CmsTicketDetail }>(`cms/feedback/${id}/messages`, { body, internal }),
    update: (id: Id, payload: Partial<{ status: TicketStatus; priority: TicketPriority; category: TicketCategory; resolution_note: string | null }>) =>
      c().patch<{ status: 'ok'; ticket: CmsTicketDetail }>(`cms/feedback/${id}`, payload),
    assign: (id: Id, assignedTo: string | null) =>
      c().put<{ status: 'ok'; ticket: CmsTicketDetail }>(`cms/feedback/${id}/assignee`, { assigned_to: assignedTo }),
    remove: (id: Id) => c().delete<Ok>(`cms/feedback/${id}`),
  },

  // ── Platform ─────────────────────────────────────────────────────────────

  policies: {
    list: () => c().get<{ status: 'ok'; policies: CmsPolicySummary[] }>('cms/policies'),
    get: (slug: string) => c().get<{ status: 'ok'; policy: CmsPolicyDetail }>(`cms/policies/${slug}`),
    create: (payload: { slug: string; title: string; kind?: string }) =>
      c().post<{ status: 'ok'; policy: CmsPolicyDetail }>('cms/policies', payload),
    saveDraft: (slug: string, payload: { title?: string; body: string; summary?: string | null; effective_at?: string | null }) =>
      c().put<{ status: 'ok'; policy: CmsPolicyDetail }>(`cms/policies/${slug}/draft`, payload),
    publish: (slug: string, version: number) => c().post<{ status: 'ok'; policy: CmsPolicyDetail }>(`cms/policies/${slug}/publish`, { version }),
    remove: (slug: string) => c().delete<Ok>(`cms/policies/${slug}`),
  },

  settings: {
    all: () => c().get<{ status: 'ok'; settings: CmsSetting[] }>('cms/settings'),
    update: (values: Record<string, unknown>) => c().patch<{ status: 'ok'; settings: CmsSetting[] }>('cms/settings', { values }),
  },

  plans: {
    list: () => c().get<{ status: 'ok'; plans: Plan[] }>('cms/plans'),
    update: (code: string, payload: Partial<{ name: string; description: string | null; price_cents: number; apple_product_id: string | null; google_product_id: string | null; google_base_plan_id: string | null; display_order: number; is_active: boolean }>) =>
      c().patch<Ok>(`cms/plans/${code}`, payload),
  },

  subscriptions: {
    list: (params: { page?: number; limit?: number; status?: string; platform?: string; plan_code?: string } = {}) =>
      c().get<{ status: 'ok'; subscriptions: CmsSubscriptionRow[]; pagination: Pick<Pagination, 'page' | 'limit' | 'total'> }>(
        'cms/subscriptions',
        { params },
      ),
    reconcile: () => c().post<{ status: 'ok'; checked?: number; updated?: number }>('cms/subscriptions/reconcile'),
    events: (params: { page?: number; limit?: number; subscription_id?: string } = {}) =>
      c().get<{ status: 'ok'; events: unknown[] }>('cms/subscription-events', { params }),
  },

  analytics: {
    overview: (params: RangeQuery = {}) => c().get<DashboardResponse>('cms/analytics/overview', { params }),
    authors: (params: RangeQuery = {}) => c().get<{ status: 'ok'; authors: AuthorPerformanceRow[] }>('cms/analytics/authors', { params }),
  },

  audit: {
    list: (params: { page?: number; limit?: number; actor_id?: string; action?: string; entity_type?: string; entity_id?: string; from?: string; to?: string } = {}) =>
      c().get<{ status: 'ok'; logs: AuditLogEntry[]; pagination: Pagination; actions: string[] }>('cms/audit-logs', { params }),
    forEntity: (entityType: string, entityId: string | number) =>
      c().get<{ status: 'ok'; logs: AuditLogEntry[] }>(`cms/audit-logs/${entityType}/${entityId}`),
  },

  media: {
    /** Small files (images) go through the API. */
    upload: (kind: AssetKind, file: Blob | File) => {
      const form = new FormData()
      form.append('kind', kind)
      form.append('file', file)
      return c().post<{ status: 'ok'; key: string; public_url: string | null }>('cms/media', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    /** Large files (PDF, EPUB, audio) are PUT straight to object storage. */
    presign: (kind: AssetKind, contentType: string, filename?: string) =>
      c().post<{ status: 'ok'; upload: PresignedUpload; public_url: string | null }>('cms/media/presign', {
        kind,
        content_type: contentType,
        filename,
      }),
    signedUrl: (key: string) => c().post<{ status: 'ok'; url: string; expires_at: string }>('cms/media/signed-url', { key }),
    remove: (key: string) => c().delete<Ok>('cms/media', { data: { key } }),
  },
}

/** Uploads a large file directly to object storage and returns its key. */
export async function uploadLargeAsset(
  kind: AssetKind,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ key: string; public_url: string | null }> {
  const { data } = await cms.media.presign(kind, file.type || 'application/octet-stream', file.name)
  // The presigned PUT goes to MinIO, not to the API: no auth header, no baseURL.
  await getClient().put(data.upload.url, file, {
    baseURL: '',
    headers: { ...data.upload.headers, Authorization: undefined as unknown as string },
    transformRequest: [(body) => body],
    onUploadProgress: onProgress
      ? (event) => onProgress(event.total ? Math.round((event.loaded / event.total) * 100) : 0)
      : undefined,
  })
  return { key: data.upload.key, public_url: data.public_url }
}

// ── Public (storefront) endpoints backed by the CMS ─────────────────────────

export const site = {
  /** Branding, SEO and feature toggles marked public. */
  settings: () => c().get<{ status: 'ok'; settings: Record<string, unknown> }>('settings'),

  policies: () =>
    c().get<{ status: 'ok'; policies: Array<{ slug: string; title: string; kind: string; version: number; effective_at: string | null }> }>(
      'policies',
    ),

  policy: (slug: string) => c().get<{ status: 'ok'; policy: import('../cms-types.js').PublicPolicy }>(`policies/${slug}`),

  submitFeedback: (payload: { subject: string; body: string; category?: TicketCategory; email?: string; name?: string }) =>
    c().post<{ status: 'ok'; reference: string; ticket_id: Id }>('feedback', payload),

  myTickets: () => c().get<{ status: 'ok'; tickets: CmsTicketDetail[] }>('feedback/me'),

  reportReview: (reviewId: Id, reason: 'spam' | 'abuse' | 'spoiler' | 'off_topic' | 'other', note?: string | null) =>
    c().post<Ok>(`reviews/${reviewId}/report`, { reason, note }),
}
