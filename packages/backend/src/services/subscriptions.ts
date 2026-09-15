import { randomUUID } from 'node:crypto'
import { sql, type Kysely, type Transaction } from 'kysely'
import type { Database, Platform, Subscription, SubscriptionPlan } from '../db/types.js'
import { computeEntitlement, type EntitlementDto } from '../domain/entitlement.js'
import { findPlanForAppleProduct, findPlanForGoogleProduct } from '../domain/plans.js'
import { AppError, errors } from '../lib/errors.js'
import type { Logger } from '../lib/logger.js'
import type { AppleStoreService } from '../payments/apple.js'
import type { GooglePlayService } from '../payments/google.js'
import type { StoreNotification, StoreSubscriptionSnapshot } from '../payments/types.js'

export type VerifyPurchaseInput =
  | { platform: 'ios'; transaction_jws: string }
  | { platform: 'android'; product_id: string; purchase_token: string }

export interface VerifyResult {
  entitlement: EntitlementDto
  subscription: Subscription
}

export type NotificationOutcome = 'processed' | 'ignored' | 'duplicate'

type Db = Kysely<Database> | Transaction<Database>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Decide whether `requestingUserId` may attach a store subscription.
 * Pure; exported for tests.
 *
 * - The account token embedded by the app at purchase time is authoritative.
 * - Otherwise the first account to verify the subscription owns it. This
 *   stops one Apple ID / Google account from unlocking many Loikmon accounts.
 */
export function decideOwnership(input: {
  requestingUserId: string
  existingOwnerId: string | null
  accountToken: string | null
}): 'allow' | 'reject' {
  if (input.accountToken && UUID_RE.test(input.accountToken) && input.accountToken !== input.requestingUserId) {
    return 'reject'
  }
  if (input.existingOwnerId && input.existingOwnerId !== input.requestingUserId) return 'reject'
  return 'allow'
}

function isDuplicateKey(err: unknown): boolean {
  return (err as { errno?: number } | null)?.errno === 1062
}

export class SubscriptionService {
  constructor(
    private readonly deps: {
      db: Kysely<Database>
      apple: AppleStoreService | null
      google: GooglePlayService | null
      logger: Logger
      now?: () => Date
    },
  ) {}

  private now(): Date {
    return this.deps.now?.() ?? new Date()
  }

  // ── Plans & entitlement ────────────────────────────────────────────────

  async listPlans(options: { includeInactive?: boolean } = {}): Promise<SubscriptionPlan[]> {
    let query = this.deps.db.selectFrom('subscription_plans').selectAll().orderBy('display_order')
    if (!options.includeInactive) query = query.where('is_active', '=', true)
    return query.execute()
  }

  async getEntitlement(userId: string, role?: string | null): Promise<EntitlementDto> {
    const [subscriptions, grants] = await Promise.all([
      this.deps.db
        .selectFrom('subscriptions')
        .selectAll()
        .where('user_id', '=', userId)
        .where('status', '!=', 'pending')
        .orderBy('expires_at', 'desc')
        .limit(20)
        .execute(),
      this.deps.db
        .selectFrom('entitlement_grants')
        .selectAll()
        .where('user_id', '=', userId)
        .where('revoked_at', 'is', null)
        .execute(),
    ])
    return computeEntitlement({ role, subscriptions, grants, now: this.now() })
  }

  async listUserSubscriptions(userId: string): Promise<Subscription[]> {
    return this.deps.db
      .selectFrom('subscriptions')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('updated_at', 'desc')
      .execute()
  }

  // ── Client verification ────────────────────────────────────────────────

  async verifyPurchase(user: { id: string; role?: string | null }, input: VerifyPurchaseInput): Promise<VerifyResult> {
    const snapshot = await this.fetchSnapshot(input)
    const subscription = await this.deps.db.transaction().execute(async (trx) => {
      const existing = await this.findByStoreId(trx, snapshot.platform, snapshot.storeSubscriptionId, true)
      const decision = decideOwnership({
        requestingUserId: user.id,
        existingOwnerId: existing?.user_id ?? null,
        accountToken: snapshot.accountToken,
      })
      if (decision === 'reject') {
        this.deps.logger.warn(
          { userId: user.id, ownerId: existing?.user_id, platform: snapshot.platform },
          'store subscription belongs to another account',
        )
        throw errors.purchaseAlreadyLinked()
      }
      const saved = await this.applySnapshot(trx, snapshot, user.id, existing)
      await this.recordEvent(trx, {
        platform: snapshot.platform,
        eventId: `verify:${snapshot.storeSubscriptionId.slice(0, 120)}:${snapshot.latestTransactionId ?? ''}:${saved.status}`,
        type: 'CLIENT_VERIFY',
        subscriptionId: saved.id,
        userId: user.id,
        outcome: 'processed',
        payload: { status: saved.status, product_id: snapshot.productId },
        ignoreDuplicate: true,
      })
      return saved
    })

    if (snapshot.platform === 'google_play') await this.deps.google?.acknowledge(snapshot)
    this.deps.logger.info(
      { userId: user.id, platform: snapshot.platform, status: subscription.status, plan: subscription.plan_code },
      'subscription verified',
    )
    return { subscription, entitlement: await this.getEntitlement(user.id, user.role) }
  }

  /** Verify several purchases (restore flow); failures are reported per purchase instead of aborting. */
  async restorePurchases(user: { id: string; role?: string | null }, inputs: VerifyPurchaseInput[]) {
    const results: Array<{ ok: boolean; code?: string; message?: string; subscription_id?: string }> = []
    for (const input of inputs) {
      try {
        const { subscription } = await this.verifyPurchase(user, input)
        results.push({ ok: true, subscription_id: subscription.id })
      } catch (err) {
        if (!(err instanceof AppError)) throw err
        results.push({ ok: false, code: err.code, message: err.message })
      }
    }
    return { results, entitlement: await this.getEntitlement(user.id, user.role) }
  }

  private async fetchSnapshot(input: VerifyPurchaseInput): Promise<StoreSubscriptionSnapshot> {
    if (input.platform === 'ios') {
      if (!this.deps.apple) throw errors.storeNotConfigured('App Store')
      return this.deps.apple.verifyTransaction(input.transaction_jws)
    }
    if (!this.deps.google) throw errors.storeNotConfigured('Google Play')
    return this.deps.google.verifyPurchase(input.product_id, input.purchase_token)
  }

  // ── Store notifications ────────────────────────────────────────────────

  async handleAppleNotification(signedPayload: string): Promise<NotificationOutcome> {
    if (!this.deps.apple) throw errors.storeNotConfigured('App Store')
    const notification = await this.deps.apple.decodeNotification(signedPayload)
    return this.processNotification(notification)
  }

  async handleGoogleNotification(
    body: unknown,
    headers: { authorization?: string },
    query: { token?: unknown },
  ): Promise<NotificationOutcome> {
    if (!this.deps.google) throw errors.storeNotConfigured('Google Play')
    await this.deps.google.authenticatePush(headers, query)
    const notification = await this.deps.google.decodeNotification(body)
    const outcome = await this.processNotification(notification)
    if (notification.snapshot) await this.deps.google.acknowledge(notification.snapshot)
    return outcome
  }

  /** Idempotent: the event row and the subscription change commit together. */
  async processNotification(notification: StoreNotification): Promise<NotificationOutcome> {
    const log = this.deps.logger.child({ platform: notification.platform, type: notification.type, eventId: notification.eventId })
    try {
      return await this.deps.db.transaction().execute(async (trx) => {
        let subscription: Subscription | null = null
        let outcome: 'processed' | 'ignored' = 'ignored'

        if (notification.revokedPurchaseToken) {
          subscription = await this.revoke(trx, notification.platform, notification.revokedPurchaseToken)
          outcome = subscription ? 'processed' : 'ignored'
        } else if (notification.snapshot) {
          const snapshot = notification.snapshot
          const existing = await this.findByStoreId(trx, snapshot.platform, snapshot.storeSubscriptionId, true)
          const ownerId = existing?.user_id ?? (await this.resolveOwnerForNewSubscription(trx, snapshot))
          if (ownerId) {
            subscription = await this.applySnapshot(trx, snapshot, ownerId, existing)
            outcome = 'processed'
          } else {
            log.info('notification for a subscription not yet linked to an account — waiting for the app to verify it')
          }
        }

        const inserted = await this.recordEvent(trx, {
          platform: notification.platform,
          eventId: notification.eventId,
          type: notification.type,
          subtype: notification.subtype,
          subscriptionId: subscription?.id ?? null,
          userId: subscription?.user_id ?? null,
          outcome,
          payload: notification.payload,
        })
        log.info({ outcome, subscriptionId: subscription?.id, status: subscription?.status }, 'store notification handled')
        return inserted ? outcome : 'duplicate'
      })
    } catch (err) {
      if (err instanceof DuplicateEventError) {
        log.info('duplicate store notification ignored')
        return 'duplicate'
      }
      log.error({ err }, 'store notification processing failed')
      throw err
    }
  }

  private async resolveOwnerForNewSubscription(trx: Db, snapshot: StoreSubscriptionSnapshot): Promise<string | null> {
    if (snapshot.accountToken && UUID_RE.test(snapshot.accountToken)) {
      const user = await trx.selectFrom('users').select('id').where('id', '=', snapshot.accountToken).executeTakeFirst()
      if (user) return user.id
    }
    if (snapshot.linkedPurchaseToken) {
      const previous = await this.findByStoreId(trx, snapshot.platform, snapshot.linkedPurchaseToken)
      if (previous) return previous.user_id
    }
    return null
  }

  private async revoke(trx: Db, platform: Platform, storeSubscriptionId: string): Promise<Subscription | null> {
    const existing = await this.findByStoreId(trx, platform, storeSubscriptionId, true)
    if (!existing) return null
    const now = this.now()
    await trx
      .updateTable('subscriptions')
      .set({ status: 'revoked', auto_renew: false, revoked_at: now, last_verified_at: now })
      .where('id', '=', existing.id)
      .execute()
    return { ...existing, status: 'revoked', auto_renew: false, revoked_at: now }
  }

  // ── Reconciliation ─────────────────────────────────────────────────────

  /**
   * Re-check subscriptions whose state may have changed without a
   * notification reaching us (missed webhooks, grace periods ending, ...).
   */
  async reconcile(options: { limit?: number } = {}): Promise<{ checked: number; updated: number; failed: number }> {
    const now = this.now()
    const soon = new Date(now.getTime() + 24 * 3600 * 1000)
    const stale = new Date(now.getTime() - 24 * 3600 * 1000)
    const candidates = await this.deps.db
      .selectFrom('subscriptions')
      .selectAll()
      .where('platform', 'in', ['app_store', 'google_play'])
      .where('status', 'in', ['active', 'canceled', 'grace_period', 'billing_retry', 'paused', 'pending'])
      .where((eb) =>
        eb.or([eb('expires_at', '<=', soon), eb('last_verified_at', 'is', null), eb('last_verified_at', '<=', stale)]),
      )
      .orderBy('last_verified_at')
      .limit(options.limit ?? 200)
      .execute()

    let updated = 0
    let failed = 0
    for (const sub of candidates) {
      try {
        const snapshot =
          sub.platform === 'app_store'
            ? await this.deps.apple?.fetchLatest(sub.store_subscription_id, sub.environment)
            : await this.deps.google?.fetchLatest(sub.store_subscription_id)
        if (!snapshot) {
          await this.deps.db.updateTable('subscriptions').set({ last_verified_at: now }).where('id', '=', sub.id).execute()
          continue
        }
        await this.deps.db.transaction().execute((trx) => this.applySnapshot(trx, snapshot, sub.user_id, sub))
        if (snapshot.platform === 'google_play') await this.deps.google?.acknowledge(snapshot)
        if (snapshot.status !== sub.status || snapshot.expiresAt?.getTime() !== sub.expires_at?.getTime()) updated++
      } catch (err) {
        failed++
        this.deps.logger.warn({ err, subscriptionId: sub.id }, 'subscription reconciliation failed')
      }
    }
    return { checked: candidates.length, updated, failed }
  }

  // ── Persistence helpers ────────────────────────────────────────────────

  private async findByStoreId(db: Db, platform: Platform, storeSubscriptionId: string, forUpdate = false) {
    let query = db
      .selectFrom('subscriptions')
      .selectAll()
      .where('platform', '=', platform)
      .where('store_subscription_id', '=', storeSubscriptionId)
    if (forUpdate) query = query.forUpdate()
    return (await query.executeTakeFirst()) ?? null
  }

  private async resolvePlanCode(db: Db, snapshot: StoreSubscriptionSnapshot): Promise<string | null> {
    const plans = await db.selectFrom('subscription_plans').selectAll().execute()
    const plan =
      snapshot.platform === 'app_store'
        ? findPlanForAppleProduct(plans, snapshot.productId)
        : findPlanForGoogleProduct(plans, snapshot.productId, snapshot.basePlanId)
    if (!plan) {
      // Any auto-renewable subscription of this app unlocks the catalogue, so
      // keep the row; an admin should add the product to subscription_plans.
      this.deps.logger.error({ productId: snapshot.productId, basePlanId: snapshot.basePlanId }, 'store product is not mapped to a plan')
    }
    return plan?.code ?? null
  }

  private async applySnapshot(
    trx: Db,
    snapshot: StoreSubscriptionSnapshot,
    userId: string,
    existing: Subscription | null,
  ): Promise<Subscription> {
    const now = this.now()
    const planCode = await this.resolvePlanCode(trx, snapshot)
    const values = {
      plan_code: planCode,
      product_id: snapshot.productId,
      status: snapshot.status,
      auto_renew: snapshot.autoRenew,
      environment: snapshot.environment,
      started_at: existing?.started_at ?? snapshot.startedAt,
      expires_at: snapshot.expiresAt,
      grace_expires_at: snapshot.graceExpiresAt,
      canceled_at: snapshot.canceledAt ? (existing?.canceled_at ?? snapshot.canceledAt) : null,
      revoked_at: snapshot.revokedAt,
      latest_transaction_id: snapshot.latestTransactionId,
      linked_purchase_token: snapshot.linkedPurchaseToken,
      last_verified_at: now,
      raw_data: JSON.stringify(snapshot.raw ?? null),
    }

    let id: string
    if (existing) {
      id = existing.id
      await trx.updateTable('subscriptions').set(values).where('id', '=', id).execute()
    } else {
      id = randomUUID()
      await trx
        .insertInto('subscriptions')
        .values({ id, user_id: userId, platform: snapshot.platform, store_subscription_id: snapshot.storeSubscriptionId, ...values })
        .execute()
    }

    // Google issues a new purchase token on upgrade/downgrade/resubscribe;
    // the replaced subscription no longer grants access.
    if (snapshot.linkedPurchaseToken) {
      await trx
        .updateTable('subscriptions')
        .set({ status: 'expired', auto_renew: false, last_verified_at: now })
        .where('platform', '=', snapshot.platform)
        .where('store_subscription_id', '=', snapshot.linkedPurchaseToken)
        .where('user_id', '=', userId)
        .where('status', 'not in', ['expired', 'revoked'])
        .execute()
    }

    return trx.selectFrom('subscriptions').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
  }

  /** Returns false when the event was already recorded. */
  private async recordEvent(
    trx: Db,
    event: {
      platform: Platform
      eventId: string
      type: string
      subtype?: string | null
      subscriptionId: string | null
      userId: string | null
      outcome: 'processed' | 'ignored' | 'failed'
      payload: unknown
      ignoreDuplicate?: boolean
    },
  ): Promise<boolean> {
    const row = {
      platform: event.platform,
      event_id: event.eventId.slice(0, 255),
      event_type: event.type.slice(0, 64),
      event_subtype: event.subtype?.slice(0, 64) ?? null,
      subscription_id: event.subscriptionId,
      user_id: event.userId,
      outcome: event.outcome,
      error: null,
      payload: JSON.stringify(event.payload ?? null),
    }
    if (event.ignoreDuplicate) {
      await trx.insertInto('subscription_events').ignore().values(row).execute()
      return true
    }
    try {
      await trx.insertInto('subscription_events').values(row).execute()
      return true
    } catch (err) {
      if (isDuplicateKey(err)) throw new DuplicateEventError()
      throw err
    }
  }

  // ── Admin grants ───────────────────────────────────────────────────────

  async grantAccess(input: { userId: string; reason: string; expiresAt: Date | null; grantedBy: string }) {
    const result = await this.deps.db
      .insertInto('entitlement_grants')
      .values({
        user_id: input.userId,
        reason: input.reason,
        starts_at: this.now(),
        expires_at: input.expiresAt,
        granted_by: input.grantedBy,
      })
      .executeTakeFirstOrThrow()
    return Number(result.insertId)
  }

  async revokeGrant(grantId: number): Promise<boolean> {
    const result = await this.deps.db
      .updateTable('entitlement_grants')
      .set({ revoked_at: this.now() })
      .where('id', '=', grantId)
      .where('revoked_at', 'is', null)
      .executeTakeFirst()
    return Number(result.numUpdatedRows) > 0
  }

  /** Mark subscriptions whose paid period ended as expired (keeps admin views tidy; access checks use dates anyway). */
  async expireLapsed(): Promise<number> {
    const result = await this.deps.db
      .updateTable('subscriptions')
      .set({ status: 'expired', auto_renew: false })
      .where('status', 'in', ['active', 'canceled'])
      .where('expires_at', '<', sql<Date>`DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 3 DAY)`)
      .executeTakeFirst()
    return Number(result.numUpdatedRows)
  }
}

class DuplicateEventError extends Error {
  override name = 'DuplicateEventError'
}
