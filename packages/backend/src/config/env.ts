import { z } from 'zod'

/**
 * Environment configuration, parsed and validated once at boot.
 *
 * Every optional integration (SMTP, Apple, Google, legacy migration) is
 * switched on by the presence of its credentials, so a developer can run the
 * backend with only a database. Production refuses to boot with unsafe
 * defaults (see `assertProductionSafety`).
 */

const bool = (fallback: boolean) =>
  z
    .enum(['true', 'false', '1', '0', 'yes', 'no'])
    .optional()
    .transform((v) => (v === undefined ? fallback : v === 'true' || v === '1' || v === 'yes'))

const csv = (fallback: string) =>
  z
    .string()
    .optional()
    .transform((v) =>
      (v ?? fallback)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined))

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4001),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  /**
   * Express "trust proxy". The default trusts private-network hops only
   * (Traefik → nginx → backend inside Docker), so req.ip is the first public
   * address and client-supplied X-Forwarded-For entries are ignored.
   */
  TRUST_PROXY: z.string().default('loopback, linklocal, uniquelocal'),

  PUBLIC_API_URL: z.string().url().default('http://localhost:4001'),
  APP_WEB_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGINS: csv('http://localhost:5173,http://localhost:4173'),

  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().default('loikmon'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('loikmon'),
  DB_POOL_SIZE: z.coerce.number().int().positive().default(10),
  DB_MIGRATE_ON_BOOT: bool(true),

  AUTH_SECRET: z.string().default('dev-only-secret-change-me-dev-only-secret'),
  AUTH_REQUIRE_EMAIL_VERIFICATION: bool(false),
  AUTH_SESSION_DAYS: z.coerce.number().int().positive().default(30),
  ADMIN_EMAILS: csv(''),

  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_SECURE: bool(true),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  MAIL_FROM: z.string().default('Loikmon <no-reply@loikmon.org>'),

  MINIO_ENDPOINT: z.string().default('127.0.0.1'),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_USE_SSL: bool(false),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin'),
  MINIO_REGION: z.string().default('us-east-1'),
  MINIO_BUCKET_PUBLIC: z.string().default('loikmon-public'),
  MINIO_BUCKET_PRIVATE: z.string().default('loikmon-private'),
  /** Browser-reachable origin of MinIO, e.g. https://storage.loikmon.org */
  MINIO_PUBLIC_URL: z.string().url().default('http://127.0.0.1:9000'),
  SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(7 * 24 * 3600).default(3600),
  /** Can only lower the per-category limits in @loikmon/media-standards (images 10 MB, documents 250 MB, audio 1 GB). */
  UPLOAD_MAX_MB: z.coerce.number().int().positive().default(1024),
  /** Optional CDN origin in front of the public bucket, e.g. https://cdn.loikmon.org — public asset URLs use it. */
  MEDIA_CDN_URL: optionalString.pipe(z.string().url().optional()),

  APPLE_BUNDLE_ID: optionalString,
  APPLE_APP_APPLE_ID: z.coerce.number().int().positive().optional(),
  APPLE_ALLOW_SANDBOX: bool(true),
  APPLE_ROOT_CERTS_DIR: z.string().default('certs/apple'),
  APPLE_ISSUER_ID: optionalString,
  APPLE_KEY_ID: optionalString,
  /** Contents of the App Store Connect API .p8 key. Literal "\n" sequences are unescaped. */
  APPLE_PRIVATE_KEY: optionalString,

  GOOGLE_PLAY_PACKAGE_NAME: optionalString,
  /** Service-account JSON, raw or base64 encoded. */
  GOOGLE_SERVICE_ACCOUNT_JSON: optionalString,
  /** Audience configured on the Pub/Sub push subscription (usually the webhook URL). */
  GOOGLE_PUBSUB_AUDIENCE: optionalString,
  /** Service account the Pub/Sub push subscription authenticates as. */
  GOOGLE_PUBSUB_SERVICE_ACCOUNT: optionalString,
  /** Fallback shared secret for the push endpoint (?token=...) when OIDC is not configured. */
  GOOGLE_PUBSUB_VERIFICATION_TOKEN: optionalString,

  LEGACY_API_BASE: optionalString,

  JOBS_ENABLED: bool(true),
  JOBS_RECONCILE_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
})

export type RawEnv = z.infer<typeof EnvSchema>

export interface AppConfig {
  env: RawEnv['NODE_ENV']
  isProduction: boolean
  isTest: boolean
  port: number
  host: string
  logLevel: NonNullable<RawEnv['LOG_LEVEL']>
  trustProxy: string | number | boolean
  publicApiUrl: string
  appWebUrl: string
  corsOrigins: string[]
  db: {
    host: string
    port: number
    user: string
    password: string
    database: string
    poolSize: number
    migrateOnBoot: boolean
  }
  auth: {
    secret: string
    requireEmailVerification: boolean
    sessionDays: number
    adminEmails: string[]
  }
  mail: {
    smtp?: { host: string; port: number; secure: boolean; user?: string; password?: string }
    from: string
  }
  storage: {
    endpoint: string
    port: number
    useSSL: boolean
    accessKey: string
    secretKey: string
    region: string
    publicBucket: string
    privateBucket: string
    publicUrl: string
    cdnUrl?: string
    signedUrlTtlSeconds: number
    uploadMaxBytes: number
  }
  apple?: {
    bundleId: string
    appAppleId?: number
    allowSandbox: boolean
    rootCertsDir: string
    api?: { issuerId: string; keyId: string; privateKey: string }
  }
  google?: {
    packageName: string
    serviceAccount: Record<string, unknown>
    pubsub: { audience?: string; serviceAccount?: string; verificationToken?: string }
  }
  legacyApiBase?: string
  jobs: { enabled: boolean; reconcileIntervalMinutes: number }
}

export class ConfigError extends Error {
  override name = 'ConfigError'
}

function parseServiceAccount(value: string): Record<string, unknown> {
  const text = value.trim().startsWith('{') ? value : Buffer.from(value, 'base64').toString('utf8')
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    if (typeof parsed.client_email !== 'string' || typeof parsed.private_key !== 'string') {
      throw new Error('missing client_email/private_key')
    }
    return parsed
  } catch (err) {
    throw new ConfigError(`GOOGLE_SERVICE_ACCOUNT_JSON is not a valid service-account key: ${(err as Error).message}`)
  }
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(source)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new ConfigError(`Invalid environment configuration:\n${issues}`)
  }
  const e = parsed.data
  const isProduction = e.NODE_ENV === 'production'

  const config: AppConfig = {
    env: e.NODE_ENV,
    isProduction,
    isTest: e.NODE_ENV === 'test',
    port: e.PORT,
    host: e.HOST,
    logLevel: e.LOG_LEVEL ?? (e.NODE_ENV === 'test' ? 'silent' : isProduction ? 'info' : 'debug'),
    trustProxy: /^\d+$/.test(e.TRUST_PROXY) ? Number(e.TRUST_PROXY) : e.TRUST_PROXY === 'false' ? false : e.TRUST_PROXY,
    publicApiUrl: e.PUBLIC_API_URL.replace(/\/+$/, ''),
    appWebUrl: e.APP_WEB_URL.replace(/\/+$/, ''),
    corsOrigins: e.CORS_ORIGINS,
    db: {
      host: e.DB_HOST,
      port: e.DB_PORT,
      user: e.DB_USER,
      password: e.DB_PASSWORD,
      database: e.DB_NAME,
      poolSize: e.DB_POOL_SIZE,
      migrateOnBoot: e.DB_MIGRATE_ON_BOOT,
    },
    auth: {
      secret: e.AUTH_SECRET,
      requireEmailVerification: e.AUTH_REQUIRE_EMAIL_VERIFICATION,
      sessionDays: e.AUTH_SESSION_DAYS,
      adminEmails: e.ADMIN_EMAILS.map((s) => s.toLowerCase()),
    },
    mail: {
      smtp: e.SMTP_HOST
        ? { host: e.SMTP_HOST, port: e.SMTP_PORT, secure: e.SMTP_SECURE, user: e.SMTP_USER, password: e.SMTP_PASSWORD }
        : undefined,
      from: e.MAIL_FROM,
    },
    storage: {
      endpoint: e.MINIO_ENDPOINT,
      port: e.MINIO_PORT,
      useSSL: e.MINIO_USE_SSL,
      accessKey: e.MINIO_ACCESS_KEY,
      secretKey: e.MINIO_SECRET_KEY,
      region: e.MINIO_REGION,
      publicBucket: e.MINIO_BUCKET_PUBLIC,
      privateBucket: e.MINIO_BUCKET_PRIVATE,
      publicUrl: e.MINIO_PUBLIC_URL.replace(/\/+$/, ''),
      cdnUrl: e.MEDIA_CDN_URL?.replace(/\/+$/, ''),
      signedUrlTtlSeconds: e.SIGNED_URL_TTL_SECONDS,
      uploadMaxBytes: e.UPLOAD_MAX_MB * 1024 * 1024,
    },
    apple: e.APPLE_BUNDLE_ID
      ? {
          bundleId: e.APPLE_BUNDLE_ID,
          appAppleId: e.APPLE_APP_APPLE_ID,
          allowSandbox: e.APPLE_ALLOW_SANDBOX,
          rootCertsDir: e.APPLE_ROOT_CERTS_DIR,
          api:
            e.APPLE_ISSUER_ID && e.APPLE_KEY_ID && e.APPLE_PRIVATE_KEY
              ? { issuerId: e.APPLE_ISSUER_ID, keyId: e.APPLE_KEY_ID, privateKey: e.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n') }
              : undefined,
        }
      : undefined,
    google:
      e.GOOGLE_PLAY_PACKAGE_NAME && e.GOOGLE_SERVICE_ACCOUNT_JSON
        ? {
            packageName: e.GOOGLE_PLAY_PACKAGE_NAME,
            serviceAccount: parseServiceAccount(e.GOOGLE_SERVICE_ACCOUNT_JSON),
            pubsub: {
              audience: e.GOOGLE_PUBSUB_AUDIENCE,
              serviceAccount: e.GOOGLE_PUBSUB_SERVICE_ACCOUNT,
              verificationToken: e.GOOGLE_PUBSUB_VERIFICATION_TOKEN,
            },
          }
        : undefined,
    legacyApiBase: e.LEGACY_API_BASE?.replace(/\/+$/, ''),
    jobs: { enabled: e.JOBS_ENABLED, reconcileIntervalMinutes: e.JOBS_RECONCILE_INTERVAL_MINUTES },
  }

  if (isProduction) assertProductionSafety(config)
  return config
}

function assertProductionSafety(config: AppConfig): void {
  const problems: string[] = []
  if (config.auth.secret.length < 32 || config.auth.secret.startsWith('dev-only-secret')) {
    problems.push('AUTH_SECRET must be a random string of at least 32 characters')
  }
  if (!config.db.password) problems.push('DB_PASSWORD must be set')
  if (config.storage.accessKey === 'minioadmin' || config.storage.secretKey === 'minioadmin') {
    problems.push('MINIO_ACCESS_KEY / MINIO_SECRET_KEY must not use the MinIO defaults')
  }
  if (!config.publicApiUrl.startsWith('https://')) problems.push('PUBLIC_API_URL must use https in production')
  if (config.google && !config.google.pubsub.audience && !config.google.pubsub.verificationToken) {
    problems.push('Set GOOGLE_PUBSUB_AUDIENCE (recommended) or GOOGLE_PUBSUB_VERIFICATION_TOKEN to authenticate Play notifications')
  }
  if (config.apple && !config.apple.appAppleId) {
    problems.push('APPLE_APP_APPLE_ID is required to verify production App Store transactions')
  }
  if (problems.length) {
    throw new ConfigError(`Unsafe production configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`)
  }
}
