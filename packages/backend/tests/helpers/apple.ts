import { createPrivateKey, sign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Environment, SignedDataVerifier } from '@apple/app-store-server-library'
import { AppleStoreService, type AppleStatusApi } from '../../src/payments/apple.js'
import { silentLogger } from './fakes.js'

/**
 * Signs JWS exactly like the App Store does (ES256 + x5c chain), but with the
 * test PKI in tests/fixtures/apple-test-pki. Verification therefore runs
 * through Apple's real SignedDataVerifier code path.
 */

const pkiDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'apple-test-pki')
const pemBody = (file: string) =>
  readFileSync(join(pkiDir, file), 'utf8')
    .replace(/-----(BEGIN|END) CERTIFICATE-----/g, '')
    .replace(/\s+/g, '')

const leafKey = createPrivateKey(readFileSync(join(pkiDir, 'leaf.pkcs8.pem')))
const x5c = [pemBody('leaf.pem'), pemBody('intermediate.pem'), pemBody('root.pem')]
export const testRootCertificate = readFileSync(join(pkiDir, 'root.der'))

export const TEST_BUNDLE_ID = 'org.loikmon.mobile'
export const TEST_APP_APPLE_ID = 1234567890

const b64url = (value: string | Buffer) => Buffer.from(value).toString('base64url')

export function signJws(payload: Record<string, unknown>, options: { tamper?: boolean } = {}): string {
  const header = b64url(JSON.stringify({ alg: 'ES256', x5c }))
  const body = b64url(JSON.stringify(payload))
  const signature = sign('sha256', Buffer.from(`${header}.${body}`), { key: leafKey, dsaEncoding: 'ieee-p1363' })
  if (options.tamper) {
    const forged = b64url(JSON.stringify({ ...payload, expiresDate: Date.now() + 10 * 365 * 86400_000 }))
    return `${header}.${forged}.${b64url(signature)}`
  }
  return `${header}.${body}.${b64url(signature)}`
}

export function transactionPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Date.now()
  return {
    transactionId: '2000000000000001',
    originalTransactionId: '2000000000000001',
    webOrderLineItemId: '2000000000000002',
    bundleId: TEST_BUNDLE_ID,
    productId: 'org.loikmon.mobile.premium.monthly',
    subscriptionGroupIdentifier: '21000000',
    purchaseDate: now - 60_000,
    originalPurchaseDate: now - 60_000,
    expiresDate: now + 30 * 86400_000,
    quantity: 1,
    type: 'Auto-Renewable Subscription',
    inAppOwnershipType: 'PURCHASED',
    signedDate: now,
    environment: 'Sandbox',
    transactionReason: 'PURCHASE',
    storefront: 'THA',
    price: 4000,
    currency: 'USD',
    ...overrides,
  }
}

export function renewalPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    originalTransactionId: '2000000000000001',
    autoRenewProductId: 'org.loikmon.mobile.premium.monthly',
    productId: 'org.loikmon.mobile.premium.monthly',
    autoRenewStatus: 1,
    signedDate: Date.now(),
    environment: 'Sandbox',
    ...overrides,
  }
}

export function notificationPayload(input: {
  type: string
  subtype?: string
  uuid?: string
  transaction?: Record<string, unknown>
  renewal?: Record<string, unknown>
  environment?: string
  /** App Store subscription status: 1 active, 2 expired, 3 billing retry, 4 grace period, 5 revoked. */
  status?: number
}): string {
  const environment = input.environment ?? 'Sandbox'
  return signJws({
    notificationType: input.type,
    subtype: input.subtype,
    notificationUUID: input.uuid ?? crypto.randomUUID(),
    version: '2.0',
    signedDate: Date.now(),
    data: {
      bundleId: TEST_BUNDLE_ID,
      appAppleId: environment === 'Production' ? TEST_APP_APPLE_ID : undefined,
      environment,
      status: input.status,
      signedTransactionInfo: input.transaction ? signJws({ environment, ...input.transaction }) : undefined,
      signedRenewalInfo: input.renewal ? signJws({ environment, ...input.renewal }) : undefined,
    },
  })
}

export function createTestAppleService(options: { allowSandbox?: boolean; statusApi?: AppleStatusApi; now?: () => Date } = {}) {
  const roots = [testRootCertificate]
  return new AppleStoreService({
    bundleId: TEST_BUNDLE_ID,
    allowSandbox: options.allowSandbox ?? true,
    verifiers: {
      sandbox: new SignedDataVerifier(roots, false, Environment.SANDBOX, TEST_BUNDLE_ID),
      production: new SignedDataVerifier(roots, false, Environment.PRODUCTION, TEST_BUNDLE_ID, TEST_APP_APPLE_ID),
    },
    statusApis: options.statusApi ? { sandbox: options.statusApi, production: options.statusApi } : undefined,
    logger: silentLogger,
    now: options.now,
  })
}
