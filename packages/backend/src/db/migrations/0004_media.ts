import { sql, type Kysely } from 'kysely'

/*
 * Media library.
 *
 * - media_folders: a tree the CMS organises assets in.
 * - media_assets:  one row per uploaded file — the library's registry. Asset
 *   *types* (`book_cover`, `hero_mobile`, …) are defined in
 *   @loikmon/media-standards and stored as plain strings, so adding a standard
 *   never needs a schema change.
 *
 * Content rows keep referencing files by storage key, exactly as before; the
 * library matches keys to find where an asset is used. Existing keys that were
 * uploaded before this migration simply have no registry row.
 *
 * Also adds the image columns the asset standards call for but the schema did
 * not have yet: the mobile hero banner, category covers, plan / coupon /
 * policy images and explicit Open Graph images.
 */

const now = sql`CURRENT_TIMESTAMP(3)`

/** New nullable key columns, per table. */
const IMAGE_COLUMNS: Record<string, string[]> = {
  sliders: ['mobile_image_key'],
  categories: ['cover_key'],
  subscription_plans: ['image_key'],
  coupons: ['banner_key'],
  policies: ['thumbnail_key'],
  books: ['og_image_key'],
  articles: ['og_image_key'],
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('media_folders')
    .addColumn('id', 'bigint', (c) => c.primaryKey().autoIncrement())
    .addColumn('parent_id', 'bigint')
    .addColumn('name', 'varchar(120)', (c) => c.notNull())
    .addColumn('created_by', 'varchar(36)')
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addColumn('updated_at', 'datetime(3)', (c) => c.notNull().defaultTo(now).modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP(3)`))
    // Deleting a folder that still has sub-folders is refused by the database too.
    .addForeignKeyConstraint('fk_media_folders_parent', ['parent_id'], 'media_folders', ['id'], (fk) => fk.onDelete('restrict'))
    .execute()
  await db.schema.createIndex('idx_media_folders_parent').on('media_folders').columns(['parent_id', 'name']).execute()

  await db.schema
    .createTable('media_assets')
    .addColumn('id', 'bigint', (c) => c.primaryKey().autoIncrement())
    .addColumn('storage_key', 'varchar(512)', (c) => c.notNull().unique())
    .addColumn('storage_kind', 'varchar(32)', (c) => c.notNull())
    .addColumn('asset_type', 'varchar(48)', (c) => c.notNull())
    .addColumn('category', sql`enum('image','document','audio')`, (c) => c.notNull())
    .addColumn('folder_id', 'bigint')
    .addColumn('original_name', 'varchar(255)', (c) => c.notNull())
    .addColumn('title', 'varchar(255)')
    /** Accessibility and image SEO. */
    .addColumn('alt_text', 'varchar(500)')
    .addColumn('mime_type', 'varchar(128)', (c) => c.notNull())
    .addColumn('format', 'varchar(16)', (c) => c.notNull())
    .addColumn('size_bytes', 'bigint', (c) => c.notNull())
    .addColumn('width', 'integer')
    .addColumn('height', 'integer')
    .addColumn('has_alpha', 'boolean', (c) => c.notNull().defaultTo(false))
    /** Average colour as #rrggbb — a placeholder background while the image lazy-loads. */
    .addColumn('dominant_color', 'char(7)')
    /** `sha256:<hex>` of the original bytes (identical re-uploads reuse the asset), or `etag:<etag>` for direct-to-storage uploads. */
    .addColumn('checksum', 'varchar(80)', (c) => c.notNull())
    /** { xs: { key, width, height, bytes }, … } — see IMAGE_VARIANTS. */
    .addColumn('variants', 'json')
    /** Original plus every variant, for storage reporting. */
    .addColumn('total_bytes', 'bigint', (c) => c.notNull())
    .addColumn('uploaded_by', 'varchar(36)')
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addColumn('updated_at', 'datetime(3)', (c) => c.notNull().defaultTo(now).modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP(3)`))
    .addForeignKeyConstraint('fk_media_assets_folder', ['folder_id'], 'media_folders', ['id'], (fk) => fk.onDelete('set null'))
    .execute()
  await db.schema.createIndex('idx_media_assets_folder').on('media_assets').columns(['folder_id', 'created_at']).execute()
  await db.schema.createIndex('idx_media_assets_type').on('media_assets').columns(['asset_type', 'created_at']).execute()
  await db.schema.createIndex('idx_media_assets_category').on('media_assets').columns(['category', 'created_at']).execute()
  await db.schema.createIndex('idx_media_assets_checksum').on('media_assets').columns(['checksum', 'asset_type']).execute()

  for (const [table, columns] of Object.entries(IMAGE_COLUMNS)) {
    for (const column of columns) {
      await db.schema.alterTable(table).addColumn(column, 'varchar(1024)').execute()
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  for (const [table, columns] of Object.entries(IMAGE_COLUMNS)) {
    for (const column of columns) {
      await db.schema.alterTable(table).dropColumn(column).execute()
    }
  }
  await db.schema.dropTable('media_assets').ifExists().execute()
  await db.schema.dropTable('media_folders').ifExists().execute()
}
