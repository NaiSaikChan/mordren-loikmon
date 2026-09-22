import type { Kysely } from 'kysely'

/*
 * Give sliders a legacy_id, like categories, authors, books and articles have.
 *
 * The legacy PHP API serves its home banners from `initapp` (they have no list
 * endpoint of their own), and `import-legacy` matches rows on legacy_id so the
 * import stays idempotent and can be re-run until the old system is retired.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('sliders').addColumn('legacy_id', 'varchar(64)', (c) => c.unique()).execute()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('sliders').dropColumn('legacy_id').execute()
}
