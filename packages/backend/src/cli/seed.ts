import 'dotenv/config'
import { loadConfig } from '../config/env.js'
import { createContainer } from '../container.js'

/**
 * `npm run db:seed` — development data: an admin account, categories,
 * authors, free and subscriber-only books/articles, audio chapters, a slider
 * and FAQs. Safe to re-run: it does nothing when books already exist.
 *
 *   SEED_ADMIN_EMAIL=admin@loikmon.local SEED_ADMIN_PASSWORD=change-me-please npm run db:seed
 */
const config = loadConfig()
if (config.isProduction) throw new Error('Refusing to seed a production database')
const container = await createContainer(config, {}, { migrate: true })
const { db, auth, logger } = container.ctx

try {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@loikmon.local').toLowerCase()
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin-password-123'
  const existingAdmin = await db.selectFrom('users').select('id').where('email', '=', adminEmail).executeTakeFirst()
  if (!existingAdmin) {
    await auth.api.signUpEmail({ body: { email: adminEmail, password: adminPassword, name: 'Loikmon Admin' } })
  }
  await db.updateTable('users').set({ role: 'admin', email_verified: true }).where('email', '=', adminEmail).execute()
  logger.info({ email: adminEmail }, 'admin account ready')

  const alreadySeeded = await db.selectFrom('books').select('id').limit(1).executeTakeFirst()
  if (alreadySeeded) {
    logger.info('catalogue already has books — skipping content seed')
  } else {
    await db.transaction().execute(async (trx) => {
      const insertId = async (query: { executeTakeFirstOrThrow(): Promise<{ insertId?: bigint }> }) =>
        Number((await query.executeTakeFirstOrThrow()).insertId)

      const history = await insertId(trx.insertInto('categories').values({ type: 'book', name: 'ဇာတ် · History', display_order: 1 }))
      const poetry = await insertId(trx.insertInto('categories').values({ type: 'book', name: 'ကဗျ · Poetry', display_order: 2 }))
      const news = await insertId(trx.insertInto('categories').values({ type: 'article', name: 'ပရေၚ် · Culture', display_order: 1 }))

      const author1 = await insertId(trx.insertInto('authors').values({ name: 'ကၞေဟ်မန်', bio: 'Mon historian and writer.', is_verified: true }))
      const author2 = await insertId(trx.insertInto('authors').values({ name: 'နာဲကလျာဏ', bio: 'Poet and essayist.' }))

      const freeBook = await insertId(
        trx.insertInto('books').values({
          title: 'Mon Alphabet Primer',
          description: 'A free introduction to reading Mon script.',
          author_id: author1,
          category_id: history,
          pages: 42,
          is_free: true,
          is_recommended: true,
          pdf_key: 'pdf/seed/primer.pdf',
          cover_key: 'cover/seed/primer.jpg',
        }),
      )
      const paidBook = await insertId(
        trx.insertInto('books').values({
          title: 'Chronicles of Hongsawadi',
          description: 'The history of the Mon kingdom of Hanthawaddy.',
          author_id: author1,
          category_id: history,
          pages: 312,
          is_free: false,
          is_top: true,
          epub_key: 'epub/seed/hongsawadi.epub',
          pdf_key: 'pdf/seed/hongsawadi.pdf',
          cover_key: 'cover/seed/hongsawadi.jpg',
        }),
      )
      await insertId(
        trx.insertInto('books').values({
          title: 'Songs of the Salween',
          description: 'Collected Mon poetry.',
          author_id: author2,
          category_id: poetry,
          pages: 96,
          epub_key: 'epub/seed/salween.epub',
          cover_key: 'cover/seed/salween.jpg',
        }),
      )

      await trx
        .insertInto('book_audio_chapters')
        .values([
          { book_id: paidBook, chapter_number: 1, title: 'Prologue', audio_key: 'audio/seed/hongsawadi-01.mp3', duration_seconds: 420, is_preview: true },
          { book_id: paidBook, chapter_number: 2, title: 'The founding of Pegu', audio_key: 'audio/seed/hongsawadi-02.mp3', duration_seconds: 1310 },
        ])
        .execute()

      await trx
        .insertInto('articles')
        .values([
          {
            title: 'Mon National Day',
            excerpt: 'How Mon communities celebrate their national day.',
            content: '<p>Mon National Day is celebrated every year…</p>',
            author_id: author2,
            category_id: news,
            is_free: true,
            published_at: new Date(),
          },
          {
            title: 'The Kyaikhtiyo Legend (subscribers)',
            excerpt: 'The story behind the Golden Rock.',
            content: '<p>Long ago, a hermit kept a hair relic of the Buddha…</p>',
            author_id: author1,
            category_id: news,
            is_free: false,
            published_at: new Date(),
          },
        ])
        .execute()

      const collection = await insertId(trx.insertInto('collections').values({ title: 'Start here', description: 'Editor picks' }))
      await trx
        .insertInto('collection_items')
        .values([
          { collection_id: collection, item_type: 'book', item_id: freeBook, position: 0 },
          { collection_id: collection, item_type: 'book', item_id: paidBook, position: 1 },
        ])
        .execute()

      await trx.insertInto('sliders').values({ title: 'Welcome to Loikmon', image_key: 'slider/seed/welcome.jpg', link: '/books' }).execute()
      await trx
        .insertInto('faqs')
        .values([
          { question: 'What does a subscription include?', answer: 'Every book, audiobook and article on Loikmon.', display_order: 1 },
          { question: 'How do I cancel?', answer: 'Manage or cancel from your App Store or Google Play subscription settings.', display_order: 2 },
        ])
        .execute()
    })
    logger.info('sample catalogue created')
  }
} catch (err) {
  logger.error({ err }, 'seed failed')
  process.exitCode = 1
} finally {
  await container.close()
}
