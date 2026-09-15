import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  APIException,
  AppStoreServerAPIClient,
  AutoRenewStatus,
  Environment,
  SignedDataVerifier,
  Status,
  VerificationException,
  VerificationStatus,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
  type StatusResponse,
} from '@apple/app-store-server-library'
import type { AppConfig } from '../config/env.js'
import type { SubscriptionStatus } from '../db/types.js'
import { errors } from '../lib/errors.js'
import type { Logger } from '../lib/logger.js'
import { msToDate, peekJwsPayload, type StoreNotification, type StoreSubscriptionSnapshot } from './types.js'

/**
 * Apple App Store verification (StoreKit 2).
 *
 * Every JWS the app sends (expo-iap `purchase.purchaseToken` on iOS) and every
 * App Store Server Notification V2 is verified against Apple's root CAs with
 * Apple's official library — never merely decoded. When App Store Server API
 * credentials are configured the current status (auto-renew, grace period,
 * billing retry, revocation) is also fetched from Apple.
 *
 * Sandbox transactions are accepted in production by default because App
 * Review and TestFlight purchase against the sandbox.
 */

export interface AppleVerifier {
  verifyAndDecodeTransaction(jws: string): Promise<JWSTransactionDecodedPayload>
  verifyAndDecodeRenewalInfo(jws: string): Promise<JWSRenewalInfoDecodedPayload>
  verifyAndDecodeNotification(signedPayload: string): Promise<ResponseBodyV2DecodedPayload>
}

export interface AppleStatusApi {
  getAllSubscriptionStatuses(transactionId: string): Promise<StatusResponse>
}

type Env = 'production' | 'sandbox'

export interface AppleStoreOptions {
  bundleId: string
  allowSandbox: boolean
  verifiers: Partial<Record<Env, AppleVerifier>>
  statusApis?: Partial<Record<Env, AppleStatusApi>>
  logger: Logger
  now?: () => Date
}

const AUTO_RENEWABLE = 'Auto-Renewable Subscription'

export class AppleStoreService {
  constructor(private readonly options: AppleStoreOptions) {}

  static fromConfig(config: AppConfig, logger: Logger): AppleStoreService | null {
    const apple = config.apple
    if (!apple) return null
    const certs = loadRootCertificates(apple.rootCertsDir)
    const verifiers: Partial<Record<Env, AppleVerifier>> = {
      sandbox: new SignedDataVerifier(certs, true, Environment.SANDBOX, apple.bundleId),
    }
    if (apple.appAppleId) {
      verifiers.production = new SignedDataVerifier(certs, true, Environment.PRODUCTION, apple.bundleId, apple.appAppleId)
    } else {
      logger.warn('APPLE_APP_APPLE_ID not set — only sandbox App Store transactions can be verified')
    }
    const statusApis: Partial<Record<Env, AppleStatusApi>> = {}
    if (apple.api) {
      const { privateKey, keyId, issuerId } = apple.api
      statusApis.production = new AppStoreServerAPIClient(privateKey, keyId, issuerId, apple.bundleId, Environment.PRODUCTION)
      statusApis.sandbox = new AppStoreServerAPIClient(privateKey, keyId, issuerId, apple.bundleId, Environment.SANDBOX)
    } else {
      logger.warn('App Store Server API credentials not set — subscription status will rely on transactions and notifications only')
    }
    return new AppleStoreService({ bundleId: apple.bundleId, allowSandbox: apple.allowSandbox, verifiers, statusApis, logger })
  }

  private now(): Date {
    return this.options.now?.() ?? new Date()
  }

  private environmentOf(value: unknown): Env {
    return value === Environment.PRODUCTION ? 'production' : 'sandbox'
  }

  private verifierFor(env: Env): AppleVerifier {
    if (env === 'sandbox' && !this.options.allowSandbox) {
      throw errors.purchaseInvalid('Sandbox App Store purchases are not accepted by this server')
    }
    const verifier = this.options.verifiers[env]
    if (!verifier) throw errors.storeNotConfigured(`App Store (${env})`)
    return verifier
  }

  /** Verify a StoreKit 2 signed transaction sent by the app and return the subscription's current state. */
  async verifyTransaction(jws: string): Promise<StoreSubscriptionSnapshot> {
    const peek = peekJwsPayload(jws)
    if (!peek) throw errors.purchaseInvalid('Malformed App Store transaction')
    const env = this.environmentOf(peek.environment)

    const tx = await this.verify(() => this.verifierFor(env).verifyAndDecodeTransaction(jws))
    if (tx.type !== AUTO_RENEWABLE) {
      throw errors.purchaseInvalid(`App Store transaction is not an auto-renewable subscription (${tx.type ?? 'unknown'})`)
    }
    if (!tx.originalTransactionId || !tx.productId) throw errors.purchaseInvalid('App Store transaction is incomplete')

    const latest = await this.fetchLatest(tx.originalTransactionId, env).catch((err: unknown) => {
      this.options.logger.warn({ err, originalTransactionId: tx.originalTransactionId }, 'App Store status lookup failed, using transaction only')
      return null
    })
    return latest ?? snapshotFromApple(tx, undefined, undefined, this.now())
  }

  /**
   * Ask the App Store Server API for the authoritative status of a
   * subscription. Returns null when the API is not configured.
   */
  async fetchLatest(originalTransactionId: string, env: Env): Promise<StoreSubscriptionSnapshot | null> {
    const api = this.options.statusApis?.[env]
    if (!api) return null
    let response: StatusResponse
    try {
      response = await api.getAllSubscriptionStatuses(originalTransactionId)
    } catch (err) {
      if (err instanceof APIException && err.httpStatusCode === 404) return null
      throw errors.storeUnavailable('App Store', err)
    }
    const item = response.data
      ?.flatMap((group) => group.lastTransactions ?? [])
      .find((t) => t.originalTransactionId === originalTransactionId)
    if (!item?.signedTransactionInfo) return null

    const verifier = this.verifierFor(env)
    const tx = await this.verify(() => verifier.verifyAndDecodeTransaction(item.signedTransactionInfo!))
    const renewal = item.signedRenewalInfo
      ? await this.verify(() => verifier.verifyAndDecodeRenewalInfo(item.signedRenewalInfo!))
      : undefined
    return snapshotFromApple(tx, renewal, item.status, this.now())
  }

  /** Verify and decode an App Store Server Notification V2 request body. */
  async decodeNotification(signedPayload: string): Promise<StoreNotification> {
    const peek = peekJwsPayload(signedPayload)
    if (!peek) throw errors.webhookUnauthorized('Malformed App Store notification')
    const data = (peek.data ?? {}) as Record<string, unknown>
    const summaryEnv = (peek.summary as Record<string, unknown> | undefined)?.environment
    const env = this.environmentOf(data.environment ?? summaryEnv)

    let notification: ResponseBodyV2DecodedPayload
    try {
      notification = await this.verifierFor(env).verifyAndDecodeNotification(signedPayload)
    } catch (err) {
      if (err instanceof VerificationException) {
        throw errors.webhookUnauthorized(`App Store notification failed verification (${VerificationStatus[err.status]})`)
      }
      throw err
    }

    const base = {
      platform: 'app_store' as const,
      eventId: notification.notificationUUID ?? `${notification.notificationType}:${notification.signedDate}`,
      type: String(notification.notificationType ?? 'UNKNOWN'),
      subtype: notification.subtype ? String(notification.subtype) : null,
      payload: notification,
    }

    const signedTx = notification.data?.signedTransactionInfo
    if (!signedTx) return { ...base, snapshot: null }

    const verifier = this.verifierFor(env)
    const tx = await this.verify(() => verifier.verifyAndDecodeTransaction(signedTx))
    if (tx.type !== AUTO_RENEWABLE) return { ...base, snapshot: null }
    const renewal = notification.data?.signedRenewalInfo
      ? await this.verify(() => verifier.verifyAndDecodeRenewalInfo(notification.data!.signedRenewalInfo!))
      : undefined
    return { ...base, snapshot: snapshotFromApple(tx, renewal, notification.data?.status, this.now()) }
  }

  private async verify<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      if (err instanceof VerificationException) {
        if (err.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE) {
          throw errors.storeUnavailable('App Store', err)
        }
        throw errors.purchaseInvalid(`App Store signature verification failed (${VerificationStatus[err.status]})`, err)
      }
      throw err
    }
  }
}

export function loadRootCertificates(dir: string): Buffer[] {
  const absolute = resolve(dir)
  let files: string[]
  try {
    files = readdirSync(absolute).filter((f) => /\.(cer|der)$/i.test(f))
  } catch (err) {
    throw new Error(`Apple root certificates directory not found: ${absolute}`, { cause: err })
  }
  if (!files.length) throw new Error(`No Apple root certificates (*.cer) in ${absolute}`)
  return files.map((f) => readFileSync(join(absolute, f)))
}

/** Normalise verified Apple payloads into a store-agnostic snapshot. Pure; exported for tests. */
export function snapshotFromApple(
  tx: JWSTransactionDecodedPayload,
  renewal: JWSRenewalInfoDecodedPayload | undefined,
  statusCode: Status | number | undefined,
  now: Date,
): StoreSubscriptionSnapshot {
  const expiresAt = msToDate(tx.expiresDate)
  const revokedAt = msToDate(tx.revocationDate)
  const graceExpiresAt = msToDate(renewal?.gracePeriodExpiresDate)
  const autoRenew = renewal ? renewal.autoRenewStatus === AutoRenewStatus.ON : !revokedAt

  let status: SubscriptionStatus
  if (revokedAt || statusCode === Status.REVOKED) {
    status = 'revoked'
  } else if (statusCode === Status.BILLING_GRACE_PERIOD) {
    status = 'grace_period'
  } else if (statusCode === Status.BILLING_RETRY) {
    status = 'billing_retry'
  } else if (statusCode === Status.EXPIRED) {
    status = 'expired'
  } else if (expiresAt && expiresAt > now) {
    status = autoRenew ? 'active' : 'canceled'
  } else if (graceExpiresAt && graceExpiresAt > now) {
    status = 'grace_period'
  } else if (renewal?.isInBillingRetryPeriod) {
    status = 'billing_retry'
  } else {
    status = statusCode === Status.ACTIVE ? 'active' : 'expired'
  }

  return {
    platform: 'app_store',
    storeSubscriptionId: tx.originalTransactionId!,
    productId: tx.productId!,
    basePlanId: null,
    status,
    autoRenew: status === 'revoked' || status === 'expired' ? false : autoRenew,
    environment: tx.environment === Environment.PRODUCTION ? 'production' : 'sandbox',
    startedAt: msToDate(tx.originalPurchaseDate ?? tx.purchaseDate),
    expiresAt,
    graceExpiresAt,
    canceledAt: renewal && renewal.autoRenewStatus === AutoRenewStatus.OFF ? msToDate(renewal.signedDate) : null,
    revokedAt,
    latestTransactionId: tx.transactionId ?? null,
    linkedPurchaseToken: null,
    accountToken: tx.appAccountToken ?? renewal?.appAccountToken ?? null,
    needsAcknowledgement: false,
    raw: { transaction: tx, renewal: renewal ?? null, status: statusCode ?? null },
  }
}
