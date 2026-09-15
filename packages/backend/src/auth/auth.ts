import { randomUUID } from 'node:crypto'
import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { bearer } from 'better-auth/plugins'
import type { Dialect } from 'kysely'
import type { AppConfig } from '../config/env.js'
import type { Logger } from '../lib/logger.js'
import { emailTemplates, type Mailer } from '../lib/mailer.js'

/**
 * Better Auth configuration.
 *
 * - Email + password, scrypt hashing, optional email verification.
 * - `bearer()` lets the mobile apps and the SPA authenticate with
 *   `Authorization: Bearer <token>`; the token is returned by sign-in/up.
 * - User ids are UUIDs so they can double as Apple `appAccountToken` and
 *   Google `obfuscatedAccountId`, linking store purchases to accounts.
 * - Tables use the same snake_case conventions as the rest of the schema.
 */
export function buildAuthOptions(deps: {
  config: AppConfig
  dialect: Dialect
  mailer?: Mailer
  logger?: Logger
}) {
  const { config, dialect, mailer, logger } = deps
  const timestamps = { createdAt: 'created_at', updatedAt: 'updated_at' } as const

  // `satisfies` (not a return type annotation) keeps the literal option types,
  // so auth.api.* knows about the additional user fields.
  return {
    appName: 'Loikmon',
    baseURL: config.publicApiUrl,
    basePath: '/api/auth',
    secret: config.auth.secret,
    database: { dialect, type: 'mysql' },
    trustedOrigins: [...new Set([...config.corsOrigins, config.appWebUrl])],
    telemetry: { enabled: false },
    logger: logger
      ? {
          log: (level, message, ...args) => {
            const fn = level === 'error' ? logger.error : level === 'warn' ? logger.warn : logger.debug
            fn.call(logger, { args, source: 'better-auth' }, message)
          },
        }
      : undefined,

    user: {
      modelName: 'users',
      fields: { emailVerified: 'email_verified', ...timestamps },
      additionalFields: {
        firstname: { type: 'string', required: false },
        lastname: { type: 'string', required: false },
        phone: { type: 'string', required: false },
        role: { type: 'string', required: false, defaultValue: 'user', input: false },
      },
      deleteUser: { enabled: true },
    },
    session: {
      modelName: 'sessions',
      fields: { userId: 'user_id', expiresAt: 'expires_at', ipAddress: 'ip_address', userAgent: 'user_agent', ...timestamps },
      expiresIn: config.auth.sessionDays * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    },
    account: {
      modelName: 'accounts',
      fields: {
        accountId: 'account_id',
        providerId: 'provider_id',
        userId: 'user_id',
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        idToken: 'id_token',
        accessTokenExpiresAt: 'access_token_expires_at',
        refreshTokenExpiresAt: 'refresh_token_expires_at',
        ...timestamps,
      },
    },
    verification: {
      modelName: 'verifications',
      fields: { expiresAt: 'expires_at', ...timestamps },
    },

    advanced: {
      database: { generateId: () => randomUUID() },
      ipAddress: { ipAddressHeaders: ['x-forwarded-for', 'x-real-ip'] },
    },

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      requireEmailVerification: config.auth.requireEmailVerification,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user, token }) => {
        const url = `${config.appWebUrl}/auth/reset-password?token=${encodeURIComponent(token)}`
        await mailer?.send({ to: user.email, ...emailTemplates.resetPassword(url) })
      },
    },
    emailVerification: {
      sendOnSignUp: config.auth.requireEmailVerification,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await mailer?.send({ to: user.email, ...emailTemplates.verifyEmail(url) })
      },
    },

    rateLimit: {
      enabled: !config.isTest,
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-up/email': { window: 60, max: 5 },
        '/request-password-reset': { window: 300, max: 5 },
      },
    },

    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const email = String(user.email).toLowerCase()
            const role = config.auth.adminEmails.includes(email) ? 'admin' : 'user'
            return { data: { ...user, role } }
          },
        },
      },
    },

    plugins: [bearer()],
  } satisfies BetterAuthOptions
}

export function createAuth(deps: Parameters<typeof buildAuthOptions>[0]) {
  return betterAuth(buildAuthOptions(deps))
}

export type AuthOptions = ReturnType<typeof buildAuthOptions>

export type Auth = ReturnType<typeof createAuth>
