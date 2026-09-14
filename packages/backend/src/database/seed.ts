/**
 * Dev seed: creates an admin user and a couple of content_assets rows so the
 * signed-URL endpoints can be exercised locally. Run: npm run db:seed
 */
import { pool } from './pool.js'
import { hashPassword } from '../auth/password.js'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'

async function seed() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@loikmon.local'
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin1234'
  const hash = await hashPassword(password)

  await pool.query(
    `INSERT INTO users (email, name, password_hash, auth_provider, is_admin, email_verified)
     VALUES (?, 'Admin', ?, 'password', 1, 1)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), is_admin = 1`,
    [email, hash],
  )

  await pool.query(
    `INSERT IGNORE INTO content_assets
       (content_type, content_id, asset_kind, bucket, object_key, is_public, mime_type)
     VALUES
       ('book', 'demo-book-1', 'file',  ?, 'demo-book-1/book.epub', 0, 'application/epub+zip'),
       ('book', 'demo-book-1', 'cover', ?, 'demo-book-1/cover.jpg', 1, 'image/jpeg')`,
    [config.minio.buckets.books, config.minio.buckets.images],
  )

  logger.info({ email }, 'seed complete (admin + demo assets)')
  await pool.end()
}

seed().catch((err) => {
  logger.error({ err }, 'seed failed')
  process.exit(1)
})
