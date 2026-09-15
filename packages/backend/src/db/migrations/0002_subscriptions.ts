import { sql, type Kysely } from 'kysely'

/*
 * Subscription model — replaces the legacy coin wallet / per-item purchases.
 *
 * - subscription_plans: the four packages and their store product ids.
 * - subscriptions: one row per store subscription (Apple original transaction
 *   or Google purchase token), kept in sync by verification, webhooks and the
 *   reconciliation job.
 * - subscription_events: append-only audit log; the unique (platform, event_id)
 *   key makes webhook processing idempotent.
 * - entitlement_grants: complimentary access granted by an admin.
 */

const now = sql`CURRENT_TIMESTAMP(3)`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('subscription_plans')
    .addColumn('code', 'varchar(32)', (c) => c.primaryKey())
    .addColumn('name', 'varchar(64)', (c) => c.notNull())
    .addColumn('description', 'varchar(255)')
    .addColumn('price_cents', 'integer', (c) => c.notNull())
    .addColumn('currency', sql`char(3)`, (c) => c.notNull().defaultTo('USD'))
    .addColumn('period_months', sql`tinyint unsigned`, (c) => c.notNull())
    .addColumn('apple_product_id', 'varchar(128)', (c) => c.unique())
    .addColumn('google_product_id', 'varchar(128)')
    .addColumn('google_base_plan_id', 'varchar(64)')
    .addColumn('display_order', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('is_active', 'boolean', (c) => c.notNull().defaultTo(true))
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addColumn('updated_at', 'datetime(3)', (c) => c.notNull().defaultTo(now).modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP(3)`))
    .addUniqueConstraint('uq_plans_google', ['google_product_id', 'google_base_plan_id'])
    .execute()

  // Seed values are frozen here on purpose; later price/product changes are
  // made through the admin API, not by editing this migration.
  // App Store: four auto-renewable products in one subscription group.
  // Google Play: one subscription product with four auto-renewing base plans.
  const plan = (code: string, name: string, cents: number, months: number, order: number) => ({
    code,
    name,
    description: `Unlimited access to every book and article for ${months === 1 ? '1 month' : `${months} months`}`,
    price_cents: cents,
    currency: 'USD',
    period_months: months,
    apple_product_id: `org.loikmon.mobile.premium.${code}`,
    google_product_id: 'loikmon_premium',
    google_base_plan_id: code,
    display_order: order,
    is_active: true,
  })
  await db
    .insertInto('subscription_plans')
    .values([
      plan('monthly', 'Monthly', 400, 1, 1),
      plan('quarterly', '3 Months', 1000, 3, 2),
      plan('semiannual', '6 Months', 2000, 6, 3),
      plan('yearly', 'Yearly', 4500, 12, 4),
    ])
    .execute()

  await db.schema
    .createTable('subscriptions')
    .addColumn('id', 'varchar(36)', (c) => c.primaryKey())
    .addColumn('user_id', 'varchar(36)', (c) => c.notNull())
    .addColumn('plan_code', 'varchar(32)')
    .addColumn('platform', sql`enum('app_store','google_play','manual')`, (c) => c.notNull())
    .addColumn('store_subscription_id', 'varchar(512)', (c) => c.notNull())
    .addColumn('product_id', 'varchar(128)')
    .addColumn(
      'status',
      sql`enum('active','canceled','grace_period','billing_retry','paused','pending','expired','revoked')`,
      (c) => c.notNull(),
    )
    .addColumn('auto_renew', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('environment', sql`enum('production','sandbox')`, (c) => c.notNull().defaultTo('production'))
    .addColumn('started_at', 'datetime(3)')
    .addColumn('expires_at', 'datetime(3)')
    .addColumn('grace_expires_at', 'datetime(3)')
    .addColumn('canceled_at', 'datetime(3)')
    .addColumn('revoked_at', 'datetime(3)')
    .addColumn('latest_transaction_id', 'varchar(255)')
    .addColumn('linked_purchase_token', 'varchar(512)')
    .addColumn('last_verified_at', 'datetime(3)')
    .addColumn('raw_data', 'json')
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addColumn('updated_at', 'datetime(3)', (c) => c.notNull().defaultTo(now).modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP(3)`))
    .addForeignKeyConstraint('fk_subscriptions_user', ['user_id'], 'users', ['id'], (fk) => fk.onDelete('cascade'))
    .addForeignKeyConstraint('fk_subscriptions_plan', ['plan_code'], 'subscription_plans', ['code'], (fk) =>
      fk.onDelete('set null').onUpdate('cascade'),
    )
    .addUniqueConstraint('uq_subscriptions_store', ['platform', 'store_subscription_id'])
    .execute()
  await db.schema
    .createIndex('idx_subscriptions_user_status')
    .on('subscriptions')
    .columns(['user_id', 'status', 'expires_at'])
    .execute()
  await db.schema.createIndex('idx_subscriptions_expires').on('subscriptions').columns(['status', 'expires_at']).execute()

  await db.schema
    .createTable('subscription_events')
    .addColumn('id', 'bigint', (c) => c.primaryKey().autoIncrement())
    .addColumn('platform', sql`enum('app_store','google_play','manual')`, (c) => c.notNull())
    .addColumn('event_id', 'varchar(255)', (c) => c.notNull())
    .addColumn('event_type', 'varchar(64)', (c) => c.notNull())
    .addColumn('event_subtype', 'varchar(64)')
    .addColumn('subscription_id', 'varchar(36)')
    .addColumn('user_id', 'varchar(36)')
    .addColumn('outcome', sql`enum('processed','ignored','failed')`, (c) => c.notNull())
    .addColumn('error', 'text')
    .addColumn('payload', 'json')
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addUniqueConstraint('uq_subscription_events', ['platform', 'event_id'])
    .execute()
  await db.schema.createIndex('idx_subscription_events_sub').on('subscription_events').column('subscription_id').execute()

  await db.schema
    .createTable('entitlement_grants')
    .addColumn('id', 'bigint', (c) => c.primaryKey().autoIncrement())
    .addColumn('user_id', 'varchar(36)', (c) => c.notNull())
    .addColumn('reason', 'varchar(255)', (c) => c.notNull())
    .addColumn('starts_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addColumn('expires_at', 'datetime(3)')
    .addColumn('granted_by', 'varchar(36)')
    .addColumn('revoked_at', 'datetime(3)')
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addForeignKeyConstraint('fk_grants_user', ['user_id'], 'users', ['id'], (fk) => fk.onDelete('cascade'))
    .execute()
  await db.schema.createIndex('idx_grants_user').on('entitlement_grants').columns(['user_id', 'expires_at']).execute()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  for (const table of ['entitlement_grants', 'subscription_events', 'subscriptions', 'subscription_plans']) {
    await db.schema.dropTable(table).ifExists().execute()
  }
}
