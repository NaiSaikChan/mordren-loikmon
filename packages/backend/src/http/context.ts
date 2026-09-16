import type { Kysely } from 'kysely'
import type { Auth } from '../auth/auth.js'
import type { AppConfig } from '../config/env.js'
import type { Database } from '../db/types.js'
import type { EntitlementDto } from '../domain/entitlement.js'
import type { Logger } from '../lib/logger.js'
import type { Mailer } from '../lib/mailer.js'
import type { AppleStoreService } from '../payments/apple.js'
import type { GooglePlayService } from '../payments/google.js'
import type { AuditService } from '../services/audit.js'
import type { CatalogService } from '../services/catalog.js'
import type { AnalyticsService } from '../services/cms/analytics.js'
import type { CmsContentService } from '../services/cms/content.js'
import type { CouponService } from '../services/cms/coupons.js'
import type { FeedbackService } from '../services/cms/feedback.js'
import type { ModerationService } from '../services/cms/moderation.js'
import type { PolicyService } from '../services/cms/policies.js'
import type { SettingsService } from '../services/cms/settings.js'
import type { TaxonomyService } from '../services/cms/taxonomy.js'
import type { EngagementService } from '../services/engagement.js'
import type { LegacyAuthService } from '../services/legacyAuth.js'
import type { CmsActor, RbacService } from '../services/rbac.js'
import type { SubscriptionService } from '../services/subscriptions.js'
import type { StorageService } from '../storage/storage.js'

/** Everything a route handler may depend on. Built once in container.ts; replaced piecemeal in tests. */
export interface AppContext {
  config: AppConfig
  logger: Logger
  db: Kysely<Database>
  auth: Auth
  mailer: Mailer
  storage: StorageService
  apple: AppleStoreService | null
  google: GooglePlayService | null
  legacyAuth: LegacyAuthService | null
  services: {
    subscriptions: SubscriptionService
    catalog: CatalogService
    engagement: EngagementService
    rbac: RbacService
    audit: AuditService
    cmsContent: CmsContentService
    cmsTaxonomy: TaxonomyService
    coupons: CouponService
    moderation: ModerationService
    feedback: FeedbackService
    policies: PolicyService
    settings: SettingsService
    analytics: AnalyticsService
  }
  /** Readiness probes, e.g. database and storage pings. */
  healthChecks: Record<string, () => Promise<void>>
}

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  emailVerified: boolean
  image: string | null
  firstname: string | null
  lastname: string | null
  phone: string | null
  createdAt: Date
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by attachAuth: the signed-in user, or null for anonymous requests. */
      user: AuthUser | null
      sessionId: string | null
      /** Memoised entitlement for the current request (see getEntitlement). */
      entitlementPromise?: Promise<EntitlementDto>
      /** Effective CMS permissions and ownership scope; set by loadCmsActor. */
      cmsActor?: CmsActor
    }
  }
}
