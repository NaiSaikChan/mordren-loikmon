import { sql, type Kysely } from 'kysely'

/*
 * Content catalogue + per-user interaction tables.
 *
 * MySQL ignores inline column REFERENCES clauses, so every foreign key is
 * declared as a table-level constraint. `users` is created by Better Auth's
 * migrator, which always runs before these migrations.
 */

const now = sql`CURRENT_TIMESTAMP(3)`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('categories')
    .addColumn('id', 'bigint', (c) => c.primaryKey().autoIncrement())
    .addColumn('parent_id', 'bigint')
    // Legacy categories are shared by books and articles, hence 'all'.
    .addColumn('type', sql`enum('book','article','all')`, (c) => c.notNull().defaultTo('all'))
    .addColumn('name', 'varchar(255)', (c) => c.notNull())
    .addColumn('thumbnail_key', 'varchar(1024)')
    .addColumn('display_order', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('legacy_id', 'varchar(64)', (c) => c.unique())
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addColumn('updated_at', 'datetime(3)', (c) => c.notNull().defaultTo(now).modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP(3)`))
    .addForeignKeyConstraint('fk_categories_parent', ['parent_id'], 'categories', ['id'], (fk) => fk.onDelete('set null'))
    .execute()
  await db.schema.createIndex('idx_categories_type_order').on('categories').columns(['type', 'display_order']).execute()

  await db.schema
    .createTable('authors')
    .addColumn('id', 'bigint', (c) => c.primaryKey().autoIncrement())
    .addColumn('user_id', 'varchar(36)')
    .addColumn('name', 'varchar(255)', (c) => c.notNull())
    .addColumn('bio', 'text')
    .addColumn('avatar_key', 'varchar(1024)')
    .addColumn('website', 'varchar(1024)')
    .addColumn('facebook', 'varchar(1024)')
    .addColumn('youtube', 'varchar(1024)')
    .addColumn('instagram', 'varchar(1024)')
    .addColumn('is_verified', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('legacy_id', 'varchar(64)', (c) => c.unique())
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addColumn('updated_at', 'datetime(3)', (c) => c.notNull().defaultTo(now).modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP(3)`))
    .addForeignKeyConstraint('fk_authors_user', ['user_id'], 'users', ['id'], (fk) => fk.onDelete('set null'))
    .execute()
  await db.schema.createIndex('idx_authors_name').on('authors').column('name').execute()

  await db.schema
    .createTable('author_follows')
    .addColumn('user_id', 'varchar(36)', (c) => c.notNull())
    .addColumn('author_id', 'bigint', (c) => c.notNull())
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addPrimaryKeyConstraint('pk_author_follows', ['user_id', 'author_id'])
    .addForeignKeyConstraint('fk_author_follows_user', ['user_id'], 'users', ['id'], (fk) => fk.onDelete('cascade'))
    .addForeignKeyConstraint('fk_author_follows_author', ['author_id'], 'authors', ['id'], (fk) => fk.onDelete('cascade'))
    .execute()
  await db.schema.createIndex('idx_author_follows_author').on('author_follows').column('author_id').execute()

  await db.schema
    .createTable('books')
    .addColumn('id', 'bigint', (c) => c.primaryKey().autoIncrement())
    .addColumn('author_id', 'bigint')
    .addColumn('category_id', 'bigint')
    .addColumn('subcategory_id', 'bigint')
    .addColumn('title', 'varchar(500)', (c) => c.notNull())
    .addColumn('description', 'text')
    .addColumn('language', 'varchar(16)', (c) => c.notNull().defaultTo('mnw'))
    .addColumn('pages', 'integer')
    .addColumn('publisher', 'varchar(255)')
    .addColumn('published_at', 'date')
    .addColumn('cover_key', 'varchar(1024)')
    .addColumn('pdf_key', 'varchar(1024)')
    .addColumn('epub_key', 'varchar(1024)')
    .addColumn('is_free', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('is_published', 'boolean', (c) => c.notNull().defaultTo(true))
    .addColumn('is_recommended', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('is_top', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('view_count', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('rating_avg', sql`decimal(3,2)`, (c) => c.notNull().defaultTo(0))
    .addColumn('rating_count', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('legacy_id', 'varchar(64)', (c) => c.unique())
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addColumn('updated_at', 'datetime(3)', (c) => c.notNull().defaultTo(now).modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP(3)`))
    .addForeignKeyConstraint('fk_books_author', ['author_id'], 'authors', ['id'], (fk) => fk.onDelete('set null'))
    .addForeignKeyConstraint('fk_books_category', ['category_id'], 'categories', ['id'], (fk) => fk.onDelete('set null'))
    .addForeignKeyConstraint('fk_books_subcategory', ['subcategory_id'], 'categories', ['id'], (fk) => fk.onDelete('set null'))
    .execute()
  await db.schema.createIndex('idx_books_published_created').on('books').columns(['is_published', 'created_at']).execute()
  await db.schema.createIndex('idx_books_views').on('books').column('view_count').execute()

  await db.schema
    .createTable('book_audio_chapters')
    .addColumn('id', 'bigint', (c) => c.primaryKey().autoIncrement())
    .addColumn('book_id', 'bigint', (c) => c.notNull())
    .addColumn('chapter_number', 'integer', (c) => c.notNull())
    .addColumn('title', 'varchar(500)', (c) => c.notNull())
    .addColumn('audio_key', 'varchar(1024)', (c) => c.notNull())
    .addColumn('duration_seconds', 'integer')
    .addColumn('is_preview', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addColumn('updated_at', 'datetime(3)', (c) => c.notNull().defaultTo(now).modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP(3)`))
    .addForeignKeyConstraint('fk_chapters_book', ['book_id'], 'books', ['id'], (fk) => fk.onDelete('cascade'))
    .addUniqueConstraint('uq_chapters_book_number', ['book_id', 'chapter_number'])
    .execute()

  await db.schema
    .createTable('articles')
    .addColumn('id', 'bigint', (c) => c.primaryKey().autoIncrement())
    .addColumn('author_id', 'bigint')
    .addColumn('category_id', 'bigint')
    .addColumn('subcategory_id', 'bigint')
    .addColumn('title', 'varchar(500)', (c) => c.notNull())
    .addColumn('excerpt', 'text')
    .addColumn('content', sql`longtext`, (c) => c.notNull())
    .addColumn('thumbnail_key', 'varchar(1024)')
    .addColumn('audio_key', 'varchar(1024)')
    .addColumn('is_free', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('is_published', 'boolean', (c) => c.notNull().defaultTo(true))
    .addColumn('view_count', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('rating_avg', sql`decimal(3,2)`, (c) => c.notNull().defaultTo(0))
    .addColumn('rating_count', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('published_at', 'datetime(3)')
    .addColumn('legacy_id', 'varchar(64)', (c) => c.unique())
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addColumn('updated_at', 'datetime(3)', (c) => c.notNull().defaultTo(now).modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP(3)`))
    .addForeignKeyConstraint('fk_articles_author', ['author_id'], 'authors', ['id'], (fk) => fk.onDelete('set null'))
    .addForeignKeyConstraint('fk_articles_category', ['category_id'], 'categories', ['id'], (fk) => fk.onDelete('set null'))
    .addForeignKeyConstraint('fk_articles_subcategory', ['subcategory_id'], 'categories', ['id'], (fk) => fk.onDelete('set null'))
    .execute()
  await db.schema.createIndex('idx_articles_published').on('articles').columns(['is_published', 'published_at']).execute()

  await db.schema
    .createTable('collections')
    .addColumn('id', 'bigint', (c) => c.primaryKey().autoIncrement())
    .addColumn('title', 'varchar(255)', (c) => c.notNull())
    .addColumn('description', 'text')
    .addColumn('thumbnail_key', 'varchar(1024)')
    .addColumn('display_order', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('is_published', 'boolean', (c) => c.notNull().defaultTo(true))
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addColumn('updated_at', 'datetime(3)', (c) => c.notNull().defaultTo(now).modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP(3)`))
    .execute()

  await db.schema
    .createTable('collection_items')
    .addColumn('collection_id', 'bigint', (c) => c.notNull())
    .addColumn('item_type', sql`enum('book','article')`, (c) => c.notNull())
    .addColumn('item_id', 'bigint', (c) => c.notNull())
    .addColumn('position', 'integer', (c) => c.notNull().defaultTo(0))
    .addPrimaryKeyConstraint('pk_collection_items', ['collection_id', 'item_type', 'item_id'])
    .addForeignKeyConstraint('fk_collection_items_collection', ['collection_id'], 'collections', ['id'], (fk) => fk.onDelete('cascade'))
    .execute()

  await db.schema
    .createTable('sliders')
    .addColumn('id', 'bigint', (c) => c.primaryKey().autoIncrement())
    .addColumn('title', 'varchar(255)')
    .addColumn('image_key', 'varchar(1024)', (c) => c.notNull())
    .addColumn('link', 'varchar(1024)')
    .addColumn('display_order', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('is_active', 'boolean', (c) => c.notNull().defaultTo(true))
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addColumn('updated_at', 'datetime(3)', (c) => c.notNull().defaultTo(now).modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP(3)`))
    .execute()

  await db.schema
    .createTable('faqs')
    .addColumn('id', 'bigint', (c) => c.primaryKey().autoIncrement())
    .addColumn('question', 'text', (c) => c.notNull())
    .addColumn('answer', 'text', (c) => c.notNull())
    .addColumn('display_order', 'integer', (c) => c.notNull().defaultTo(0))
    .addColumn('is_published', 'boolean', (c) => c.notNull().defaultTo(true))
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addColumn('updated_at', 'datetime(3)', (c) => c.notNull().defaultTo(now).modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP(3)`))
    .execute()

  await db.schema
    .createTable('notifications')
    .addColumn('id', 'bigint', (c) => c.primaryKey().autoIncrement())
    .addColumn('user_id', 'varchar(36)')
    .addColumn('type', 'varchar(32)', (c) => c.notNull())
    .addColumn('title', 'varchar(255)', (c) => c.notNull())
    .addColumn('message', 'text')
    .addColumn('data', 'json')
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addForeignKeyConstraint('fk_notifications_user', ['user_id'], 'users', ['id'], (fk) => fk.onDelete('cascade'))
    .execute()
  await db.schema.createIndex('idx_notifications_user_created').on('notifications').columns(['user_id', 'created_at']).execute()

  await db.schema
    .createTable('reviews')
    .addColumn('id', 'bigint', (c) => c.primaryKey().autoIncrement())
    .addColumn('user_id', 'varchar(36)', (c) => c.notNull())
    .addColumn('item_type', sql`enum('book','article')`, (c) => c.notNull())
    .addColumn('item_id', 'bigint', (c) => c.notNull())
    .addColumn('rating', sql`tinyint unsigned`, (c) => c.notNull().check(sql`rating BETWEEN 1 AND 5`))
    .addColumn('content', 'text')
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addColumn('updated_at', 'datetime(3)', (c) => c.notNull().defaultTo(now).modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP(3)`))
    .addForeignKeyConstraint('fk_reviews_user', ['user_id'], 'users', ['id'], (fk) => fk.onDelete('cascade'))
    .addUniqueConstraint('uq_reviews_user_item', ['user_id', 'item_type', 'item_id'])
    .execute()
  await db.schema.createIndex('idx_reviews_item').on('reviews').columns(['item_type', 'item_id', 'created_at']).execute()

  await db.schema
    .createTable('library_items')
    .addColumn('user_id', 'varchar(36)', (c) => c.notNull())
    .addColumn('item_type', sql`enum('book','article')`, (c) => c.notNull())
    .addColumn('item_id', 'bigint', (c) => c.notNull())
    .addColumn('created_at', 'datetime(3)', (c) => c.notNull().defaultTo(now))
    .addPrimaryKeyConstraint('pk_library_items', ['user_id', 'item_type', 'item_id'])
    .addForeignKeyConstraint('fk_library_items_user', ['user_id'], 'users', ['id'], (fk) => fk.onDelete('cascade'))
    .execute()

  await db.schema
    .createTable('reading_progress')
    .addColumn('user_id', 'varchar(36)', (c) => c.notNull())
    .addColumn('book_id', 'bigint', (c) => c.notNull())
    .addColumn('format', sql`enum('pdf','epub','audio')`, (c) => c.notNull())
    .addColumn('location', 'varchar(2048)')
    .addColumn('progress', sql`decimal(5,2)`, (c) => c.notNull().defaultTo(0))
    .addColumn('updated_at', 'datetime(3)', (c) => c.notNull().defaultTo(now).modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP(3)`))
    .addPrimaryKeyConstraint('pk_reading_progress', ['user_id', 'book_id', 'format'])
    .addForeignKeyConstraint('fk_reading_progress_user', ['user_id'], 'users', ['id'], (fk) => fk.onDelete('cascade'))
    .addForeignKeyConstraint('fk_reading_progress_book', ['book_id'], 'books', ['id'], (fk) => fk.onDelete('cascade'))
    .execute()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  for (const table of [
    'reading_progress',
    'library_items',
    'reviews',
    'notifications',
    'faqs',
    'sliders',
    'collection_items',
    'collections',
    'articles',
    'book_audio_chapters',
    'books',
    'author_follows',
    'authors',
    'categories',
  ]) {
    await db.schema.dropTable(table).ifExists().execute()
  }
}
