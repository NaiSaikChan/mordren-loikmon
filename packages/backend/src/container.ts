import { buildAuthOptions, createAuth } from './auth/auth.js'
import type { AppConfig } from './config/env.js'
import { createDb, pingDb, type DbHandle } from './db/client.js'
import { migrateToLatest } from './db/migrate.js'
import type { AppContext } from './http/context.js'
import { createLogger, type Logger } from './lib/logger.js'
import { createMailer, type Mailer } from './lib/mailer.js'
import { AppleStoreService } from './payments/apple.js'
import { GooglePlayService } from './payments/google.js'
import { AuditService } from './services/audit.js'
import { CatalogService } from './services/catalog.js'
import { AnalyticsService } from './services/cms/analytics.js'
import { CmsContentService } from './services/cms/content.js'
import { CouponService } from './services/cms/coupons.js'
import { FeedbackService } from './services/cms/feedback.js'
import { ModerationService } from './services/cms/moderation.js'
import { PolicyService } from './services/cms/policies.js'
import { SettingsService } from './services/cms/settings.js'
import { TaxonomyService } from './services/cms/taxonomy.js'
import { EngagementService } from './services/engagement.js'
import { LegacyAuthService } from './services/legacyAuth.js'
import { RbacService } from './services/rbac.js'
import { SubscriptionService } from './services/subscriptions.js'
import { MinioStorageService, type StorageService } from './storage/storage.js'

export interface ContainerOverrides {
  logger?: Logger
  mailer?: Mailer
  storage?: StorageService
  apple?: AppleStoreService | null
  google?: GooglePlayService | null
  legacyAuth?: LegacyAuthService | null
  now?: () => Date
}

export interface Container {
  ctx: AppContext
  dbHandle: DbHandle
  close: () => Promise<void>
}

/**
 * Wire every dependency from configuration. Tests pass overrides for external services.
 *
 * With `migrate: true` the schema is brought up to date *before* Better Auth
 * is constructed: Better Auth validates the schema when it is created and
 * keeps failing if the tables were missing at that moment.
 */
export async function createContainer(
  config: AppConfig,
  overrides: ContainerOverrides = {},
  options: { migrate?: boolean } = {},
): Promise<Container> {
  const logger = overrides.logger ?? createLogger(config)
  const dbHandle = createDb(config.db)
  const mailer = overrides.mailer ?? createMailer(config, logger)
  const authDeps = { config, dialect: dbHandle.dialect, mailer, logger: logger.child({ component: 'auth' }) }

  if (options.migrate) {
    try {
      await migrateToLatest(dbHandle.db, buildAuthOptions(authDeps), logger)
    } catch (err) {
      await dbHandle.close()
      throw err
    }
  }

  const storage = overrides.storage ?? new MinioStorageService(config.storage, logger.child({ component: 'storage' }))
  const apple = overrides.apple !== undefined ? overrides.apple : AppleStoreService.fromConfig(config, logger.child({ component: 'apple' }))
  const google = overrides.google !== undefined ? overrides.google : GooglePlayService.fromConfig(config, logger.child({ component: 'google' }))
  const legacyAuth =
    overrides.legacyAuth !== undefined
      ? overrides.legacyAuth
      : config.legacyApiBase
        ? new LegacyAuthService(config.legacyApiBase, logger.child({ component: 'legacy-auth' }))
        : null

  const now = overrides.now ?? (() => new Date())
  const audit = new AuditService(dbHandle.db, logger.child({ component: 'audit' }))

  const ctx: AppContext = {
    config,
    logger,
    db: dbHandle.db,
    auth: createAuth(authDeps),
    mailer,
    storage,
    apple,
    google,
    legacyAuth,
    services: {
      subscriptions: new SubscriptionService({ db: dbHandle.db, apple, google, logger: logger.child({ component: 'subscriptions' }), now: overrides.now }),
      catalog: new CatalogService(dbHandle.db),
      engagement: new EngagementService(dbHandle.db),
      rbac: new RbacService(dbHandle.db, now),
      audit,
      cmsContent: new CmsContentService(dbHandle.db, storage, audit, now),
      cmsTaxonomy: new TaxonomyService(dbHandle.db, storage, audit, now),
      coupons: new CouponService(dbHandle.db, audit, now),
      moderation: new ModerationService(dbHandle.db, audit, now),
      feedback: new FeedbackService(dbHandle.db, audit, mailer, logger.child({ component: 'feedback' }), now),
      policies: new PolicyService(dbHandle.db, audit, now),
      settings: new SettingsService(dbHandle.db, audit),
      analytics: new AnalyticsService(dbHandle.db),
    },
    healthChecks: {
      database: () => pingDb(dbHandle.db),
      storage: () => storage.ping(),
    },
  }

  return { ctx, dbHandle, close: () => dbHandle.close() }
}
