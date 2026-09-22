import { sql, type Kysely } from 'kysely'

/*
 * Widen media_assets.checksum.
 *
 * Checksums are stored with an algorithm prefix — `sha256:<64 hex>` (71 chars)
 * for uploads, `key:<64 hex>` for direct-to-storage registrations — but an
 * early version of 0004_media created the column as char(64), which fits the
 * digest alone. Every upload then failed with "Data too long for column
 * 'checksum'". 0004 already declares varchar(80), so databases created from it
 * are correct; this migration repairs the ones that ran the earlier version and
 * is a no-op elsewhere.
 *
 * Never fix an applied migration by editing it: the migrator records it by name
 * and will not run it again.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('media_assets').modifyColumn('checksum', sql`varchar(80)`, (c) => c.notNull()).execute()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  // Narrowing back to char(64) would truncate the prefix, so the column keeps
  // its width; 0004's own down() drops the table.
}
