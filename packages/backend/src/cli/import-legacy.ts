import 'dotenv/config'
import { Readable } from 'node:stream'
import { sql, type Kysely } from 'kysely'
import { loadConfig } from '../config/env.js'
import { createContainer } from '../container.js'
import type { Database } from '../db/types.js'
import type { Logger } from '../lib/logger.js'
import { makeExcerpt, normalizeLegacyUrl } from '../lib/text.js'
import type { AssetKind, StorageService } from '../storage/storage.js'

/**
 * Import the catalogue from the legacy PHP API (https://loikmon.org/webapis).
 *
 *   npm run import:legacy                  # metadata; file columns keep the legacy URLs
 *   npm run import:legacy -- --files       # also copy covers, PDFs, EPUBs and audio into MinIO
 *   npm run import:legacy -- --all-paid    # make every imported title subscriber-only
 *
 * Idempotent: rows are matched on legacy_id and updated in place, so the
 * import can be re-run until the old system is switched off. `--files` only
 * copies files whose column still holds an http(s) URL.
 *
 * User accounts are not imported (passwords are not exposed by the API);
 * they migrate automatically on first sign-in when LEGACY_API_BASE is set.
 */

const args = process.argv.slice(2)
/**
 * Read `--name` / `--name=value` from argv, falling back to `npm_config_name`.
 * Windows PowerShell drops the bare `--` in `npm run import:legacy -- --files`,
 * so npm keeps the flag as its own config and the script gets no arguments.
 */
const option = (name: string): string | undefined => {
  const arg = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`))
  if (arg) return arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : 'true'
  return process.env[`npm_config_${name.replace(/-/g, '_')}`]
}
const COPY_FILES = option('files') === 'true'
const ALL_PAID = option('all-paid') === 'true'
/** `--max-pages=2` limits each paginated list (useful for a trial run). */
const MAX_PAGES = Number(option('max-pages') ?? 500)

type Json = Record<string, unknown>

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : typeof v === 'number' ? String(v) : null)
const int = (v: unknown): number | null => {
  const n = Number.parseInt(String(v ?? ''), 10)
  return Number.isFinite(n) ? n : null
}
/** Legacy timestamps carry no time zone; they are imported as UTC. */
const date = (v: unknown): Date | null => {
  const s = str(v)
  if (!s || s.startsWith('0000')) return null
  const d = new Date(s.includes('T') || s.length <= 10 ? s : `${s.replace(' ', 'T')}Z`)
  return Number.isNaN(d.getTime()) ? null : d
}
const durationSeconds = (v: unknown): number | null => {
  const s = str(v)
  if (!s) return null
  const parts = s.split(':').map(Number)
  if (parts.some((p) => !Number.isFinite(p))) return null
  return parts.reduce((acc, p) => acc * 60 + p, 0)
}

class LegacyClient {
  constructor(private readonly base: string, private readonly logger: Logger) {}

  async post(endpoint: string, data: Json, attempt = 1): Promise<Json> {
    try {
      const res = await fetch(`${this.base}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ data }),
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as Json
    } catch (err) {
      if (attempt >= 3) throw new Error(`legacy ${endpoint} failed: ${(err as Error).message}`, { cause: err })
      this.logger.warn({ endpoint, attempt, err: (err as Error).message }, 'legacy request failed, retrying')
      await new Promise((r) => setTimeout(r, 1000 * attempt))
      return this.post(endpoint, data, attempt + 1)
    }
  }

  /** Iterate a paginated legacy list until an empty/repeated page or isLastPage. */
  async *pages(endpoint: string, key: string, build: (page: number) => Json): AsyncGenerator<Json[]> {
    const seen = new Set<string>()
    for (let page = 0; page < MAX_PAGES; page++) {
      const body = await this.post(endpoint, build(page))
      const items = (Array.isArray(body[key]) ? body[key] : []) as Json[]
      const fresh = items.filter((item) => {
        const id = String(item.id)
        if (seen.has(id)) return false
        seen.add(id)
        return true
      })
      if (!fresh.length) return
      yield fresh
      // if (body.isLastPage === true) return
    }
  }
}

async function upsertByLegacyId(
  db: Kysely<Database>,
  table: 'categories' | 'authors' | 'books' | 'articles',
  legacyId: string,
  values: Record<string, unknown>,
): Promise<number> {
  const anyDb = db as unknown as Kysely<Record<string, Record<string, unknown>>>
  const existing = await anyDb.selectFrom(table).select('id').where('legacy_id', '=', legacyId).executeTakeFirst()
  if (existing) {
    await anyDb.updateTable(table).set(values).where('id', '=', existing.id as number).execute()
    return Number(existing.id)
  }
  const result = await anyDb.insertInto(table).values({ ...values, legacy_id: legacyId }).executeTakeFirstOrThrow()
  return Number(result.insertId)
}

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.epub': 'application/epub+zip',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

async function copyToStorage(storage: StorageService, kind: AssetKind, url: string, logger: Logger): Promise<string | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10 * 60_000) })
  if (!res.ok || !res.body) {
    logger.warn({ url, status: res.status }, 'legacy file download failed — keeping URL')
    return null
  }
  const size = Number(res.headers.get('content-length'))
  const path = decodeURIComponent(new URL(url).pathname)
  const ext = (path.match(/\.[a-z0-9]+$/i)?.[0] ?? '').toLowerCase()
  const contentType = CONTENT_TYPES[ext] ?? res.headers.get('content-type') ?? 'application/octet-stream'
  if (Number.isFinite(size) && size > 0) {
    return storage.putObject(kind, Readable.fromWeb(res.body as never), size, contentType, path)
  }
  const buffer = Buffer.from(await res.arrayBuffer())
  return storage.putObject(kind, buffer, buffer.length, contentType, path)
}

async function main() {
  const config = loadConfig()
  if (!config.legacyApiBase) throw new Error('Set LEGACY_API_BASE (e.g. https://loikmon.org/webapis) to import')
  const container = await createContainer(config, {}, { migrate: true })
  const { db, storage, logger } = container.ctx
  const legacy = new LegacyClient(config.legacyApiBase, logger)
  const stats = { categories: 0, authors: 0, books: 0, chapters: 0, articles: 0, files: 0 }
  logger.info({ copyFiles: COPY_FILES, allPaid: ALL_PAID, maxPages: MAX_PAGES }, 'legacy import starting')

  try {
    // ── Categories (shared by books and articles in the legacy system) ──
    const categoryIds = new Map<string, number>()
    for (const type of ['book', 'article']) {
      for await (const page of legacy.pages('fetchcategories', 'categories', (p) => ({ type, page: p }))) {
        for (const c of page) {
          const legacyId = String(c.id)
          if (categoryIds.has(legacyId)) continue
          const id = await upsertByLegacyId(db, 'categories', legacyId, {
            name: str(c.name) ?? `Category ${legacyId}`,
            type: 'all',
            thumbnail_key: normalizeLegacyUrl(str(c.thumbnail)),
          })
          categoryIds.set(legacyId, id)
          stats.categories++
        }
      }
    }
    logger.info({ count: categoryIds.size }, 'categories imported')

    // ── Authors ──
    const authorIds = new Map<string, number>()
    for await (const page of legacy.pages('fetchauthors', 'authors', (p) => ({ type: 'book', page: String(p), limit: '100', query: '', email: '' }))) {
      for (const a of page) {
        const legacyId = String(a.id)
        const id = await upsertByLegacyId(db, 'authors', legacyId, {
          name: str(a.name) ?? `Author ${legacyId}`,
          bio: str(a.description),
          avatar_key: normalizeLegacyUrl(str(a.thumbnail)),
          facebook: str(a.facebook),
          youtube: str(a.youtube),
          instagram: str(a.instagram),
        })
        authorIds.set(legacyId, id)
        stats.authors++
      }
    }

    const authorFor = async (item: Json): Promise<number | null> => {
      const legacyId = str(item.authorid) ?? str(item.author)
      if (!legacyId) return null
      if (!authorIds.has(legacyId)) {
        const id = await upsertByLegacyId(db, 'authors', legacyId, { name: str(item.authorname) ?? `Author ${legacyId}` })
        authorIds.set(legacyId, id)
      }
      return authorIds.get(legacyId)!
    }
    const categoryFor = (value: unknown) => {
      const legacyId = str(value)
      return legacyId ? (categoryIds.get(legacyId) ?? null) : null
    }

    // ── Books + audio chapters ──
    for await (const page of legacy.pages('fetchbooks', 'books', (p) => ({ page: String(p) }))) {
      for (const b of page) {
        const legacyId = String(b.id)
        const bookId = await upsertByLegacyId(db, 'books', legacyId, {
          title: str(b.title) ?? `Book ${legacyId}`,
          description: str(b.description),
          author_id: await authorFor(b),
          category_id: categoryFor(b.category),
          subcategory_id: categoryFor(b.subcategory),
          pages: int(b.pages),
          publisher: str(b.publisher),
          published_at: date(b.publishdate),
          cover_key: normalizeLegacyUrl(str(b.coverphoto) ?? str(b.thumbnail)),
          pdf_key: normalizeLegacyUrl(str(b.pdf)),
          epub_key: normalizeLegacyUrl(str(b.epub)),
          is_free: ALL_PAID ? false : Number(b.amount ?? 0) === 0,
          is_recommended: String(b.recommended) === '1',
          is_top: String(b.top) === '1',
          view_count: int(b.views) ?? 0,
          created_at: date(b.date) ?? new Date(),
        })
        stats.books++

        if (b.has_audio === true || b.has_audio === 'true' || b.has_audio === 1) {
          const body = await legacy.post('getBookChapters', { book_id: legacyId })
          const list = (Array.isArray(body.data) ? body.data : ((body.data as Json | undefined)?.chapters ?? body.chapters ?? [])) as Json[]
          for (const [index, ch] of list.entries()) {
            const audio = normalizeLegacyUrl(str(ch.audio) ?? str(ch.audio_url))
            if (!audio) continue
            const chapterNumber = int(ch.chapter_number) ?? index + 1
            await db
              .insertInto('book_audio_chapters')
              .values({
                book_id: bookId,
                chapter_number: chapterNumber,
                title: str(ch.chapter_title) ?? str(ch.title) ?? `Chapter ${chapterNumber}`,
                audio_key: audio,
                duration_seconds: durationSeconds(ch.duration),
              })
              .onDuplicateKeyUpdate({ title: sql`VALUES(title)`, duration_seconds: sql`VALUES(duration_seconds)` })
              .execute()
            stats.chapters++
          }
        }
      }
      logger.info({ books: stats.books }, 'books page imported')
    }

    // ── Articles ──
    for await (const page of legacy.pages('fetcharticles', 'articles', (p) => ({ page: p, limit: 500, type: 1, query: '', category: 0 }))) {
      for (const a of page) {
        const legacyId = String(a.id)
        const content = str(a.content) ?? ''
        await upsertByLegacyId(db, 'articles', legacyId, {
          title: (str(a.title) ?? `Article ${legacyId}`).slice(0, 500),
          // Legacy descriptions may contain HTML; excerpts are plain text.
          excerpt: makeExcerpt(str(a.description) ?? content),
          content,
          author_id: await authorFor(a),
          category_id: categoryFor(a.category),
          subcategory_id: categoryFor(a.subcategory),
          thumbnail_key: normalizeLegacyUrl(str(a.thumbnail)),
          audio_key: normalizeLegacyUrl(str(a.audio)),
          is_free: ALL_PAID ? false : Number(a.amount ?? 0) === 0,
          view_count: int(a.views) ?? 0,
          published_at: date(a.articledate),
        })
        stats.articles++
      }
    }
    logger.info(stats, 'metadata import finished')

    if (COPY_FILES) await copyFiles(db, storage, logger, stats)
    logger.info(stats, 'legacy import complete')
  } finally {
    await container.close()
  }
}

/** Move files still pointing at the legacy server into MinIO, one column at a time (resumable). */
async function copyFiles(db: Kysely<Database>, storage: StorageService, logger: Logger, stats: { files: number }) {
  const anyDb = db as unknown as Kysely<Record<string, Record<string, unknown>>>
  const jobs: Array<{ table: string; column: string; kind: AssetKind }> = [
    { table: 'categories', column: 'thumbnail_key', kind: 'category' },
    { table: 'authors', column: 'avatar_key', kind: 'avatar' },
    { table: 'books', column: 'cover_key', kind: 'cover' },
    { table: 'books', column: 'pdf_key', kind: 'pdf' },
    { table: 'books', column: 'epub_key', kind: 'epub' },
    { table: 'book_audio_chapters', column: 'audio_key', kind: 'audio' },
    { table: 'articles', column: 'thumbnail_key', kind: 'thumbnail' },
    { table: 'articles', column: 'audio_key', kind: 'audio' },
  ]
  for (const job of jobs) {
    const rows = await anyDb.selectFrom(job.table).select(['id', job.column]).where(job.column, 'like', 'http%').execute()
    for (const row of rows) {
      const url = row[job.column] as string
      try {
        const key = await copyToStorage(storage, job.kind, url, logger)
        if (!key) continue
        await anyDb.updateTable(job.table).set({ [job.column]: key }).where('id', '=', row.id as number).execute()
        stats.files++
        logger.info({ table: job.table, id: row.id, key }, 'file copied')
      } catch (err) {
        logger.error({ err, table: job.table, id: row.id, url }, 'file copy failed — will retry on next run')
      }
    }
  }
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
