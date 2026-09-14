import { pool, query, queryOne } from '../database/pool.js'
import type { PaymentProvider, SubscriptionStatus } from '../types/index.js'

export interface SubscriptionRow {
  id: string
  user_id: string
  plan_code: string
  provider: PaymentProvider
  status: SubscriptionStatus
  provider_txn_id: string | null
  purchase_token: string | null
  original_txn_id: string | null
  environment: string
  auto_renewing: number
  started_at: string | null
  expires_at: string | null
  canceled_at: string | null
  created_at: string
  updated_at: string
}

export interface UpsertSubscriptionInput {
  userId: string
  planCode: string
  provider: PaymentProvider
  status: SubscriptionStatus
  providerTxnId: string | null
  purchaseToken: string | null
  originalTxnId: string | null
  environment: string
  autoRenewing: boolean
  startedAt: Date | null
  expiresAt: Date | null
  latestReceipt?: string | null
}

/**
 * Idempotent upsert keyed on (provider, provider_txn_id). Re-verifying the same
 * transaction updates status/expiry rather than creating duplicates.
 */
export async function upsertSubscription(input: UpsertSubscriptionInput): Promise<string> {
  const existing = input.providerTxnId
    ? await queryOne<SubscriptionRow>(
        'SELECT * FROM subscriptions WHERE provider = ? AND provider_txn_id = ? LIMIT 1',
        [input.provider, input.providerTxnId],
      )
    : null

  if (existing) {
    await pool.query(
      `UPDATE subscriptions SET
         plan_code = ?, status = ?, purchase_token = ?, original_txn_id = ?,
         environment = ?, auto_renewing = ?, started_at = ?, expires_at = ?,
         latest_receipt = COALESCE(?, latest_receipt)
       WHERE id = ?`,
      [
        input.planCode, input.status, input.purchaseToken, input.originalTxnId,
        input.environment, input.autoRenewing ? 1 : 0, input.startedAt, input.expiresAt,
        input.latestReceipt ?? null, existing.id,
      ],
    )
    return existing.id
  }

  const [res]: any = await pool.query(
    `INSERT INTO subscriptions
       (user_id, plan_code, provider, status, provider_txn_id, purchase_token,
        original_txn_id, environment, auto_renewing, started_at, expires_at, latest_receipt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.userId, input.planCode, input.provider, input.status, input.providerTxnId,
      input.purchaseToken, input.originalTxnId, input.environment, input.autoRenewing ? 1 : 0,
      input.startedAt, input.expiresAt, input.latestReceipt ?? null,
    ],
  )
  // Fetch the generated UUID (INSERT ... returns no id for UUID default).
  const row = await queryOne<{ id: string }>(
    'SELECT id FROM subscriptions WHERE provider = ? AND provider_txn_id = ? ORDER BY created_at DESC LIMIT 1',
    [input.provider, input.providerTxnId],
  )
  return row?.id ?? String(res.insertId ?? '')
}

/** The single source of truth for "is this user subscribed right now". */
export async function getActiveSubscription(userId: string): Promise<SubscriptionRow | null> {
  return queryOne<SubscriptionRow>(
    `SELECT * FROM subscriptions
       WHERE user_id = ? AND status IN ('active','grace_period') AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP())
       ORDER BY expires_at DESC LIMIT 1`,
    [userId],
  )
}

export async function listUserSubscriptions(userId: string): Promise<SubscriptionRow[]> {
  return query<SubscriptionRow>(
    'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
  )
}

export async function findByOriginalTxn(originalTxnId: string): Promise<SubscriptionRow | null> {
  return queryOne<SubscriptionRow>(
    'SELECT * FROM subscriptions WHERE original_txn_id = ? ORDER BY created_at DESC LIMIT 1',
    [originalTxnId],
  )
}

export async function updateStatusByOriginalTxn(
  originalTxnId: string,
  status: SubscriptionStatus,
  expiresAt?: Date | null,
): Promise<void> {
  if (expiresAt !== undefined) {
    await pool.query(
      'UPDATE subscriptions SET status = ?, expires_at = ? WHERE original_txn_id = ?',
      [status, expiresAt, originalTxnId],
    )
  } else {
    await pool.query('UPDATE subscriptions SET status = ? WHERE original_txn_id = ?', [status, originalTxnId])
  }
}

export async function recordPaymentEvent(input: {
  subscriptionId?: string | null
  userId?: string | null
  provider: PaymentProvider
  eventType: string
  providerEventId?: string | null
  payload?: unknown
}): Promise<boolean> {
  try {
    await pool.query(
      `INSERT INTO payment_events (subscription_id, user_id, provider, event_type, provider_event_id, payload)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.subscriptionId ?? null, input.userId ?? null, input.provider, input.eventType,
        input.providerEventId ?? null,
        input.payload ? JSON.stringify(input.payload) : null,
      ],
    )
    return true
  } catch (err: any) {
    // Duplicate provider_event_id => already processed (idempotent no-op).
    if (err?.code === 'ER_DUP_ENTRY') return false
    throw err
  }
}
