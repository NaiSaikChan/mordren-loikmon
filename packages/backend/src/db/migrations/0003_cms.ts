import { sql, type Kysely } from 'kysely'
import { SYSTEM_ROLES } from '../../domain/permissions.js'

/*
 * CMS module schema.
 *
 * Adds role-based access control, auditing, editorial workflow, coupons,
 * feedback ticketing, policy versioning, site settings and review moderation.
 *
 * Backward compatibility: no existing column changes meaning. `is_published`
 * stays the flag the public catalogue filters on and is kept in sync with the
 * new `status` workflow column; `users.role` stays the single role key the
 * legacy `requireAdmin` guard reads and is now derived from `user_roles`.
 */

const now = sql`CURRENT_TIMESTAMP(3)`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  // ── Roles & permissions ────────────────────────────────────────────────

  await db.schema
    .createTable('roles')
    .addColumn('id', 'bigint', (c) => c.primaryKey().autoIncrement())
    .addColumn('role_key', 'varchar(64)', (c) => c.notNull().unique())
    .addColumn('name', 'varchar(128)', (c) => c.notNull())
    .addColumn('description', 'varchar(255)')
    // 'own' restricts every query to content owned by the actor's author profiles.
    .addColumn('scope', sql`enum('all','own')`, (c) => c.notNull().defaultTo('all'))
    /** Precedence used to derive the denormalised users.role value. */
    .addColumn('rank', 'integer', (c) => c.notNull().defaultTo(100))
    .addColumn('is_system', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addColumn('updated_at', 'datetime(3)', (c) => c.notNull().defaultTo(now).modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP(3)`))
    .execute()

  await db.schema
    .createTable('role_permissions')
    .addColumn('role_id', 'bigint', (c) => c.notNull())
    .addColumn('permission', 'varchar(64)', (c) => c.notNull())
    .addPrimaryKeyConstraint('pk_role_permissions', ['role_id', 'permission'])
    .addForeignKeyConstraint('fk_role_permissions_role', ['role_id'], 'roles', ['id'], (fk) => fk.onDelete('cascade'))
    .execute()

  await db.schema
    .createTable('user_roles')
    .addColumn('user_id', 'varchar(36)', (c) => c.notNull())
    .addColumn('role_id', 'bigint', (c) => c.notNull())
    .addColumn('granted_by', 'varchar(36)')
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addPrimaryKeyConstraint('pk_user_roles', ['user_id', 'role_id'])
    .addForeignKeyConstraint('fk_user_roles_user', ['user_id'], 'users', ['id'], (fk) => fk.onDelete('cascade'))
    .addForeignKeyConstraint('fk_user_roles_role', ['role_id'], 'roles', ['id'], (fk) => fk.onDelete('cascade'))
    .execute()
  await db.schema.createIndex('idx_user_roles_role').on('user_roles').column('role_id').execute()

  for (const role of SYSTEM_ROLES) {
    const inserted = await db
      .insertInto('roles')
      .values({
        role_key: role.key,
        name: role.name,
        description: role.description,
        scope: role.scope,
        rank: role.rank,
        is_system: true,
      })
      .executeTakeFirstOrThrow()
    const roleId = Number(inserted.insertId)
    if (role.permissions.length) {
      await db
        .insertInto('role_permissions')
        .values(role.permissions.map((permission) => ({ role_id: roleId, permission })))
        .execute()
    }
  }

  // Existing accounts keep the access they already had.
  await sql`
    INSERT INTO user_roles (user_id, role_id)
    SELECT u.id, r.id FROM users u
    JOIN roles r ON r.role_key = CASE WHEN u.role = 'admin' THEN 'admin' ELSE 'user' END
  `.execute(db)

  // ── Audit log ──────────────────────────────────────────────────────────

  await db.schema
    .createTable('audit_logs')
    .addColumn('id', 'bigint', (c) => c.primaryKey().autoIncrement())
    .addColumn('actor_id', 'varchar(36)')
    .addColumn('actor_email', 'varchar(255)')
    .addColumn('actor_role', 'varchar(64)')
    .addColumn('action', 'varchar(64)', (c) => c.notNull())
    .addColumn('entity_type', 'varchar(64)', (c) => c.notNull())
    .addColumn('entity_id', 'varchar(64)')
    .addColumn('summary', 'varchar(255)')
    .addColumn('before_data', 'json')
    .addColumn('after_data', 'json')
    .addColumn('ip', 'varchar(64)')
    .addColumn('user_agent', 'varchar(255)')
    .addColumn('request_id', 'varchar(128)')
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .execute()
  await db.schema.createIndex('idx_audit_entity').on('audit_logs').columns(['entity_type', 'entity_id', 'created_at']).execute()
  await db.schema.createIndex('idx_audit_actor').on('audit_logs').columns(['actor_id', 'created_at']).execute()
  await db.schema.createIndex('idx_audit_action').on('audit_logs').columns(['action', 'created_at']).execute()

  // ── Editorial workflow ─────────────────────────────────────────────────

  const workflow = sql`enum('draft','in_review','scheduled','published','archived')`

  await db.schema
    .alterTable('books')
    .addColumn('status', workflow, (c) => c.notNull().defaultTo('published'))
    .execute()
  await db.schema.alterTable('books').addColumn('submitted_at', 'datetime(3)').execute()
  await db.schema.alterTable('books').addColumn('reviewed_by', 'varchar(36)').execute()
  await db.schema.alterTable('books').addColumn('review_note', 'varchar(500)').execute()
  await db.schema.alterTable('books').addColumn('created_by', 'varchar(36)').execute()
  await db.schema.alterTable('books').addColumn('updated_by', 'varchar(36)').execute()
  await db.schema.alterTable('books').addColumn('revision', 'integer', (c) => c.notNull().defaultTo(1)).execute()
  await sql`UPDATE books SET status = IF(is_published, 'published', 'draft')`.execute(db)
  await db.schema.createIndex('idx_books_status').on('books').columns(['status', 'created_at']).execute()
  await db.schema.createIndex('idx_books_author_status').on('books').columns(['author_id', 'status']).execute()

  await db.schema
    .alterTable('articles')
    .addColumn('status', workflow, (c) => c.notNull().defaultTo('published'))
    .execute()
  await db.schema.alterTable('articles').addColumn('submitted_at', 'datetime(3)').execute()
  await db.schema.alterTable('articles').addColumn('reviewed_by', 'varchar(36)').execute()
  await db.schema.alterTable('articles').addColumn('review_note', 'varchar(500)').execute()
  await db.schema.alterTable('articles').addColumn('created_by', 'varchar(36)').execute()
  await db.schema.alterTable('articles').addColumn('updated_by', 'varchar(36)').execute()
  await db.schema.alterTable('articles').addColumn('revision', 'integer', (c) => c.notNull().defaultTo(1)).execute()
  await sql`UPDATE articles SET status = IF(is_published, 'published', 'draft')`.execute(db)
  await db.schema.createIndex('idx_articles_status').on('articles').columns(['status', 'published_at']).execute()
  await db.schema.createIndex('idx_articles_author_status').on('articles').columns(['author_id', 'status']).execute()

  await db.schema
    .createTable('content_versions')
    .addColumn('id', 'bigint', (c) => c.primaryKey().autoIncrement())
    .addColumn('entity_type', sql`enum('book','article')`, (c) => c.notNull())
    .addColumn('entity_id', 'bigint', (c) => c.notNull())
    .addColumn('version', 'integer', (c) => c.notNull())
    .addColumn('snapshot', 'json', (c) => c.notNull())
    .addColumn('change_note', 'varchar(255)')
    .addColumn('created_by', 'varchar(36)')
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addUniqueConstraint('uq_content_versions', ['entity_type', 'entity_id', 'version'])
    .execute()

  // ── Tags ───────────────────────────────────────────────────────────────

  await db.schema
    .createTable('tags')
    .addColumn('id', 'bigint', (c) => c.primaryKey().autoIncrement())
    .addColumn('slug', 'varchar(96)', (c) => c.notNull().unique())
    .addColumn('name', 'varchar(96)', (c) => c.notNull())
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .execute()

  await db.schema
    .createTable('content_tags')
    .addColumn('tag_id', 'bigint', (c) => c.notNull())
    .addColumn('item_type', sql`enum('book','article')`, (c) => c.notNull())
    .addColumn('item_id', 'bigint', (c) => c.notNull())
    .addPrimaryKeyConstraint('pk_content_tags', ['tag_id', 'item_type', 'item_id'])
    .addForeignKeyConstraint('fk_content_tags_tag', ['tag_id'], 'tags', ['id'], (fk) => fk.onDelete('cascade'))
    .execute()
  await db.schema.createIndex('idx_content_tags_item').on('content_tags').columns(['item_type', 'item_id']).execute()

  // ── Authors: verification workflow ─────────────────────────────────────

  await db.schema
    .alterTable('authors')
    .addColumn('verification_status', sql`enum('unverified','pending','verified','rejected')`, (c) =>
      c.notNull().defaultTo('unverified'),
    )
    .execute()
  await db.schema.alterTable('authors').addColumn('verified_at', 'datetime(3)').execute()
  await db.schema.alterTable('authors').addColumn('verified_by', 'varchar(36)').execute()
  await db.schema.alterTable('authors').addColumn('verification_note', 'varchar(500)').execute()
  await sql`UPDATE authors SET verification_status = 'verified', verified_at = created_at WHERE is_verified = 1`.execute(db)

  // ── Collections & sliders ──────────────────────────────────────────────

  await db.schema.alterTable('collections').addColumn('is_featured', 'boolean', (c) => c.notNull().defaultTo(false)).execute()
  await db.schema.alterTable('collections').addColumn('slug', 'varchar(160)').execute()

  await db.schema.alterTable('sliders').addColumn('starts_at', 'datetime(3)').execute()
  await db.schema.alterTable('sliders').addColumn('ends_at', 'datetime(3)').execute()
  await db.schema
    .alterTable('sliders')
    .addColumn('audience', sql`enum('all','guests','members','subscribers','non_subscribers')`, (c) => c.notNull().defaultTo('all'))
    .execute()
  await db.schema.alterTable('sliders').addColumn('placement', 'varchar(32)', (c) => c.notNull().defaultTo('home')).execute()
  await db.schema.createIndex('idx_sliders_schedule').on('sliders').columns(['is_active', 'starts_at', 'ends_at']).execute()

  // ── Review moderation ──────────────────────────────────────────────────

  await db.schema
    .alterTable('reviews')
    .addColumn('status', sql`enum('published','pending','hidden')`, (c) => c.notNull().defaultTo('published'))
    .execute()
  await db.schema.alterTable('reviews').addColumn('moderated_by', 'varchar(36)').execute()
  await db.schema.alterTable('reviews').addColumn('moderated_at', 'datetime(3)').execute()
  await db.schema.alterTable('reviews').addColumn('moderation_note', 'varchar(500)').execute()
  await db.schema.alterTable('reviews').addColumn('report_count', 'integer', (c) => c.notNull().defaultTo(0)).execute()
  await db.schema.createIndex('idx_reviews_status').on('reviews').columns(['status', 'created_at']).execute()

  await db.schema
    .createTable('review_reports')
    .addColumn('id', 'bigint', (c) => c.primaryKey().autoIncrement())
    .addColumn('review_id', 'bigint', (c) => c.notNull())
    .addColumn('reporter_id', 'varchar(36)')
    .addColumn('reason', sql`enum('spam','abuse','spoiler','off_topic','other')`, (c) => c.notNull())
    .addColumn('note', 'varchar(500)')
    .addColumn('status', sql`enum('open','dismissed','actioned')`, (c) => c.notNull().defaultTo('open'))
    .addColumn('resolved_by', 'varchar(36)')
    .addColumn('resolved_at', 'datetime(3)')
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addForeignKeyConstraint('fk_review_reports_review', ['review_id'], 'reviews', ['id'], (fk) => fk.onDelete('cascade'))
    .addForeignKeyConstraint('fk_review_reports_reporter', ['reporter_id'], 'users', ['id'], (fk) => fk.onDelete('set null'))
    .execute()
  await db.schema.createIndex('idx_review_reports_status').on('review_reports').columns(['status', 'created_at']).execute()

  // ── Coupons ────────────────────────────────────────────────────────────

  await db.schema
    .createTable('coupons')
    .addColumn('id', 'bigint', (c) => c.primaryKey().autoIncrement())
    .addColumn('code', 'varchar(48)', (c) => c.notNull().unique())
    .addColumn('name', 'varchar(160)', (c) => c.notNull())
    .addColumn('description', 'varchar(500)')
    .addColumn('created_by_user_id', 'varchar(36)')
    /** Owning author. NULL for platform-wide campaigns. */
    .addColumn('author_id', 'bigint')
    .addColumn('scope', sql`enum('global','subscription','book','article')`, (c) => c.notNull())
    .addColumn('book_id', 'bigint')
    .addColumn('article_id', 'bigint')
    .addColumn('plan_code', 'varchar(32)')
    .addColumn('campaign_type', 'varchar(48)', (c) => c.notNull().defaultTo('standard'))
    .addColumn('discount_type', sql`enum('percent','fixed')`, (c) => c.notNull())
    /** Percent: 1-100. Fixed: minor currency units (cents). */
    .addColumn('discount_value', 'integer', (c) => c.notNull())
    .addColumn('max_discount_cents', 'integer')
    .addColumn('min_order_cents', 'integer')
    .addColumn('currency', sql`char(3)`, (c) => c.notNull().defaultTo('USD'))
    .addColumn('usage_limit', 'integer')
    .addColumn('usage_limit_per_user', 'integer')
    .addColumn('used_count', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('starts_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addColumn('ends_at', 'datetime(3)')
    .addColumn('status', sql`enum('draft','active','paused','expired','archived')`, (c) => c.notNull().defaultTo('draft'))
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addColumn('updated_at', 'datetime(3)', (c) => c.notNull().defaultTo(now).modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP(3)`))
    .addForeignKeyConstraint('fk_coupons_creator', ['created_by_user_id'], 'users', ['id'], (fk) => fk.onDelete('set null'))
    .addForeignKeyConstraint('fk_coupons_author', ['author_id'], 'authors', ['id'], (fk) => fk.onDelete('cascade'))
    .addForeignKeyConstraint('fk_coupons_book', ['book_id'], 'books', ['id'], (fk) => fk.onDelete('cascade'))
    .addForeignKeyConstraint('fk_coupons_article', ['article_id'], 'articles', ['id'], (fk) => fk.onDelete('cascade'))
    .addForeignKeyConstraint('fk_coupons_plan', ['plan_code'], 'subscription_plans', ['code'], (fk) =>
      fk.onDelete('set null').onUpdate('cascade'),
    )
    .execute()
  await db.schema.createIndex('idx_coupons_author').on('coupons').columns(['author_id', 'status']).execute()
  await db.schema.createIndex('idx_coupons_window').on('coupons').columns(['status', 'starts_at', 'ends_at']).execute()
  await db.schema.createIndex('idx_coupons_scope').on('coupons').columns(['scope', 'status']).execute()

  await db.schema
    .createTable('coupon_redemptions')
    .addColumn('id', 'bigint', (c) => c.primaryKey().autoIncrement())
    .addColumn('coupon_id', 'bigint', (c) => c.notNull())
    .addColumn('user_id', 'varchar(36)')
    .addColumn('item_type', sql`enum('book','article','subscription','order')`, (c) => c.notNull().defaultTo('order'))
    .addColumn('item_id', 'bigint')
    .addColumn('discount_cents', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('gross_cents', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('currency', sql`char(3)`, (c) => c.notNull().defaultTo('USD'))
    .addColumn('source', 'varchar(32)', (c) => c.notNull().defaultTo('web'))
    .addColumn('metadata', 'json')
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addForeignKeyConstraint('fk_redemptions_coupon', ['coupon_id'], 'coupons', ['id'], (fk) => fk.onDelete('cascade'))
    .addForeignKeyConstraint('fk_redemptions_user', ['user_id'], 'users', ['id'], (fk) => fk.onDelete('set null'))
    .execute()
  await db.schema.createIndex('idx_redemptions_coupon').on('coupon_redemptions').columns(['coupon_id', 'created_at']).execute()
  await db.schema.createIndex('idx_redemptions_user').on('coupon_redemptions').columns(['user_id', 'coupon_id']).execute()

  // ── Feedback ticketing ─────────────────────────────────────────────────

  await db.schema
    .createTable('feedback_tickets')
    .addColumn('id', 'bigint', (c) => c.primaryKey().autoIncrement())
    .addColumn('reference', 'varchar(24)', (c) => c.notNull().unique())
    .addColumn('user_id', 'varchar(36)')
    .addColumn('email', 'varchar(255)')
    .addColumn('name', 'varchar(160)')
    .addColumn('subject', 'varchar(255)', (c) => c.notNull())
    .addColumn('category', sql`enum('bug','content','billing','account','suggestion','other')`, (c) => c.notNull().defaultTo('other'))
    .addColumn('priority', sql`enum('low','normal','high','urgent')`, (c) => c.notNull().defaultTo('normal'))
    .addColumn('status', sql`enum('open','pending','resolved','closed')`, (c) => c.notNull().defaultTo('open'))
    .addColumn('assigned_to', 'varchar(36)')
    .addColumn('resolution_note', 'varchar(1000)')
    .addColumn('first_response_at', 'datetime(3)')
    .addColumn('resolved_at', 'datetime(3)')
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addColumn('updated_at', 'datetime(3)', (c) => c.notNull().defaultTo(now).modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP(3)`))
    .addForeignKeyConstraint('fk_tickets_user', ['user_id'], 'users', ['id'], (fk) => fk.onDelete('set null'))
    .addForeignKeyConstraint('fk_tickets_assignee', ['assigned_to'], 'users', ['id'], (fk) => fk.onDelete('set null'))
    .execute()
  await db.schema.createIndex('idx_tickets_status').on('feedback_tickets').columns(['status', 'created_at']).execute()
  await db.schema.createIndex('idx_tickets_assignee').on('feedback_tickets').columns(['assigned_to', 'status']).execute()

  await db.schema
    .createTable('feedback_messages')
    .addColumn('id', 'bigint', (c) => c.primaryKey().autoIncrement())
    .addColumn('ticket_id', 'bigint', (c) => c.notNull())
    .addColumn('author_user_id', 'varchar(36)')
    .addColumn('body', 'text', (c) => c.notNull())
    /** Internal notes are never returned to the reporter. */
    .addColumn('is_internal', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addForeignKeyConstraint('fk_messages_ticket', ['ticket_id'], 'feedback_tickets', ['id'], (fk) => fk.onDelete('cascade'))
    .addForeignKeyConstraint('fk_messages_author', ['author_user_id'], 'users', ['id'], (fk) => fk.onDelete('set null'))
    .execute()
  await db.schema.createIndex('idx_messages_ticket').on('feedback_messages').columns(['ticket_id', 'created_at']).execute()

  // ── Policies & terms ───────────────────────────────────────────────────

  await db.schema
    .createTable('policies')
    .addColumn('id', 'bigint', (c) => c.primaryKey().autoIncrement())
    .addColumn('slug', 'varchar(96)', (c) => c.notNull().unique())
    .addColumn('title', 'varchar(255)', (c) => c.notNull())
    .addColumn('kind', sql`enum('terms','privacy','refund','content','custom')`, (c) => c.notNull().defaultTo('custom'))
    .addColumn('published_version', 'integer')
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addColumn('updated_at', 'datetime(3)', (c) => c.notNull().defaultTo(now).modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP(3)`))
    .execute()

  await db.schema
    .createTable('policy_versions')
    .addColumn('id', 'bigint', (c) => c.primaryKey().autoIncrement())
    .addColumn('policy_id', 'bigint', (c) => c.notNull())
    .addColumn('version', 'integer', (c) => c.notNull())
    .addColumn('title', 'varchar(255)', (c) => c.notNull())
    .addColumn('body', sql`longtext`, (c) => c.notNull())
    .addColumn('summary', 'varchar(500)')
    .addColumn('status', sql`enum('draft','published','archived')`, (c) => c.notNull().defaultTo('draft'))
    .addColumn('effective_at', 'datetime(3)')
    .addColumn('published_at', 'datetime(3)')
    .addColumn('created_by', 'varchar(36)')
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addColumn('updated_at', 'datetime(3)', (c) => c.notNull().defaultTo(now).modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP(3)`))
    .addUniqueConstraint('uq_policy_versions', ['policy_id', 'version'])
    .addForeignKeyConstraint('fk_policy_versions_policy', ['policy_id'], 'policies', ['id'], (fk) => fk.onDelete('cascade'))
    .execute()

  await db
    .insertInto('policies')
    .values([
      { slug: 'terms', title: 'Terms & Conditions', kind: 'terms' },
      { slug: 'privacy', title: 'Privacy Policy', kind: 'privacy' },
      { slug: 'refund', title: 'Refund Policy', kind: 'refund' },
    ])
    .execute()

  // ── Website settings ───────────────────────────────────────────────────

  await db.schema
    .createTable('settings')
    .addColumn('setting_key', 'varchar(96)', (c) => c.primaryKey())
    .addColumn('group_key', 'varchar(48)', (c) => c.notNull().defaultTo('general'))
    .addColumn('value', 'json', (c) => c.notNull())
    /** Public settings are served unauthenticated at GET /api/v1/settings. */
    .addColumn('is_public', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('updated_by', 'varchar(36)')
    .addColumn('updated_at', 'datetime(3)', (c) => c.notNull().defaultTo(now).modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP(3)`))
    .execute()

  const setting = (key: string, group: string, value: unknown, isPublic = true) => ({
    setting_key: key,
    group_key: group,
    value: JSON.stringify(value),
    is_public: isPublic,
  })
  await db
    .insertInto('settings')
    .values([
      setting('branding.site_name', 'branding', 'Loikmon'),
      setting('branding.tagline', 'branding', 'Mon books, audiobooks and articles'),
      setting('branding.logo_key', 'branding', null),
      setting('branding.primary_color', 'branding', '#4f46e5'),
      setting('seo.default_title', 'seo', 'Loikmon'),
      setting('seo.default_description', 'seo', 'Read and listen to Mon literature.'),
      setting('seo.keywords', 'seo', []),
      setting('seo.og_image_key', 'seo', null),
      setting('social.facebook', 'social', null),
      setting('social.youtube', 'social', null),
      setting('social.instagram', 'social', null),
      setting('email.support_address', 'email', null, false),
      setting('email.reply_to', 'email', null, false),
      setting('features.reviews_enabled', 'features', true),
      setting('features.reviews_require_approval', 'features', false),
      setting('features.feedback_enabled', 'features', true),
      setting('features.coupons_enabled', 'features', true),
      setting('features.registration_enabled', 'features', true),
    ])
    .execute()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  for (const table of [
    'settings',
    'policy_versions',
    'policies',
    'feedback_messages',
    'feedback_tickets',
    'coupon_redemptions',
    'coupons',
    'review_reports',
    'content_tags',
    'tags',
    'content_versions',
    'audit_logs',
    'user_roles',
    'role_permissions',
    'roles',
  ]) {
    await db.schema.dropTable(table).ifExists().execute()
  }

  for (const [table, columns] of Object.entries({
    reviews: ['status', 'moderated_by', 'moderated_at', 'moderation_note', 'report_count'],
    sliders: ['starts_at', 'ends_at', 'audience', 'placement'],
    collections: ['is_featured', 'slug'],
    authors: ['verification_status', 'verified_at', 'verified_by', 'verification_note'],
    articles: ['status', 'submitted_at', 'reviewed_by', 'review_note', 'created_by', 'updated_by', 'revision'],
    books: ['status', 'submitted_at', 'reviewed_by', 'review_note', 'created_by', 'updated_by', 'revision'],
  })) {
    for (const column of columns) {
      await db.schema.alterTable(table).dropColumn(column).execute()
    }
  }
}
