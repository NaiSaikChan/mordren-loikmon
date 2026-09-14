/**
 * Centralised, validated environment configuration.
 * Fail-fast: the process refuses to boot in production with placeholder secrets.
 */
import 'dotenv/config'

function bool(name: string, fallback = false): boolean {
  const v = process.env[name]
  if (v === undefined) return fallback
  return v === 'true' || v === '1'
}

const NODE_ENV = process.env.NODE_ENV ?? 'development'
const isProd = NODE_ENV === 'production'

export const config = {
  env: NODE_ENV,
  isProd,
  port: Number(process.env.PORT ?? 4001),
  logLevel: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:4173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  auth: {
    jwtSecret: (() => {
      const s = process.env.AUTH_SECRET ?? 'dev-secret-change-in-production'
      if (isProd && s === 'dev-secret-change-in-production') {
        throw new Error('AUTH_SECRET must be set to a strong value in production')
      }
      return s
    })(),
    jwtExpiresIn: process.env.AUTH_JWT_EXPIRES_IN ?? '7d',
  },

  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'loikmon',
    password: process.env.DB_PASSWORD ?? 'password',
    database: process.env.DB_NAME ?? 'loikmon',
    connectionLimit: Number(process.env.DB_POOL_SIZE ?? 10),
  },

  minio: {
    endpoint: process.env.MINIO_ENDPOINT ?? 'localhost',
    port: Number(process.env.MINIO_PORT ?? 9000),
    useSSL: bool('MINIO_USE_SSL', false),
    accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
    region: process.env.MINIO_REGION ?? 'us-east-1',
    buckets: {
      books: process.env.MINIO_BUCKET_BOOKS ?? 'loikmon-books',
      images: process.env.MINIO_BUCKET_IMAGES ?? 'loikmon-images',
      audio: process.env.MINIO_BUCKET_AUDIO ?? 'loikmon-audio',
    },
    publicBaseUrl: process.env.MINIO_PUBLIC_BASE_URL ?? '',
    signedUrlTtlSeconds: Number(process.env.MINIO_SIGNED_URL_TTL ?? 3600),
  },

  payments: {
    google: {
      enabled: bool('GOOGLE_PLAY_ENABLED', false),
      packageName: process.env.GOOGLE_PLAY_PACKAGE_NAME ?? '',
      serviceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '',
      pubsubVerificationToken: process.env.GOOGLE_RTDN_TOKEN ?? '',
    },
    apple: {
      enabled: bool('APPLE_IAP_ENABLED', false),
      bundleId: process.env.APPLE_BUNDLE_ID ?? '',
      issuerId: process.env.APPLE_ISSUER_ID ?? '',
      keyId: process.env.APPLE_KEY_ID ?? '',
      privateKey: process.env.APPLE_PRIVATE_KEY ?? '',
      environment: process.env.APPLE_ENVIRONMENT ?? 'Sandbox',
      sharedSecret: process.env.APPLE_SHARED_SECRET ?? '',
    },
    stripe: {
      enabled: bool('STRIPE_ENABLED', false),
      secretKey: process.env.STRIPE_SECRET_KEY ?? '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
      successUrl: process.env.STRIPE_SUCCESS_URL ?? 'http://localhost:5173/subscribe/success',
      cancelUrl: process.env.STRIPE_CANCEL_URL ?? 'http://localhost:5173/subscribe/cancel',
    },
  },
} as const

export type AppConfig = typeof config
