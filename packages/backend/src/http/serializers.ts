import { openGraphImageUrl, responsiveImage } from '@loikmon/media-standards'
import type { AccessDecision } from '../domain/access.js'
import type { StorageService } from '../storage/storage.js'
import type { ArticleRow, AuthorRow, BookRow, CategoryRow, ChapterRow } from '../services/catalog.js'
import type { AuthUser } from './context.js'

/**
 * Public JSON representations.
 *
 * Field names intentionally match what the existing web and mobile UIs read
 * from the legacy API (`thumbnail`, `authorname`, `categoryname`, `views`,
 * `rating`, `articledate`, ...) so screens keep working, while ids and flags
 * are properly typed. File URLs are never part of these objects: they are
 * issued per request, only to viewers with access.
 *
 * Every image field has a `*_image` companion — `{ src, srcset, original,
 * variants }` from @loikmon/media-standards — for responsive, lazy-loaded
 * rendering. The flat URL fields stay for older clients.
 */

const iso = (d: Date | string | null | undefined): string | null =>
  d ? (d instanceof Date ? d.toISOString() : new Date(d).toISOString()) : null

const urlFor = (storage: StorageService) => (key: string) => storage.publicUrl(key)

const num = (v: unknown): number => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

export function serializeBook(row: BookRow, storage: StorageService) {
  const cover = storage.publicUrl(row.cover_key)
  const chapters = num(row.audio_chapters_count)
  const formats = [row.pdf_key ? 'pdf' : null, row.epub_key ? 'epub' : null].filter(Boolean) as Array<'pdf' | 'epub'>
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    author_id: row.author_id,
    authorname: row.author_name ?? '',
    category: row.category_id,
    categoryname: row.category_name ?? '',
    subcategory: row.subcategory_id,
    subcategoryname: row.subcategory_name ?? '',
    thumbnail: cover,
    coverphoto: cover,
    cover_url: cover,
    cover_image: responsiveImage(row.cover_key, urlFor(storage)),
    og_image_url: openGraphImageUrl(row.og_image_key, row.cover_key, urlFor(storage)),
    pages: row.pages,
    publisher: row.publisher,
    published_at: row.published_at ? iso(row.published_at)!.slice(0, 10) : null,
    language: row.language,
    is_free: row.is_free,
    is_recommended: row.is_recommended,
    is_top: row.is_top,
    views: num(row.view_count),
    rating: num(row.rating_avg),
    rating_count: num(row.rating_count),
    formats,
    has_pdf: formats.includes('pdf'),
    has_epub: formats.includes('epub'),
    has_audio: chapters > 0,
    audio_chapters_count: chapters,
    audio_duration_seconds: num(row.audio_duration_seconds),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    date: iso(row.created_at),
  }
}

export type BookDto = ReturnType<typeof serializeBook>

export function serializeArticle(row: ArticleRow, storage: StorageService) {
  const thumbnail = storage.publicUrl(row.thumbnail_key)
  const published = iso(row.published_at ?? row.created_at)
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt ?? '',
    description: row.excerpt ?? '',
    author_id: row.author_id,
    authorname: row.author_name ?? '',
    category: row.category_id,
    categoryname: row.category_name ?? '',
    subcategory: row.subcategory_id,
    thumbnail,
    thumbnail_url: thumbnail,
    thumbnail_image: responsiveImage(row.thumbnail_key, urlFor(storage)),
    og_image_url: openGraphImageUrl(row.og_image_key, row.thumbnail_key, urlFor(storage)),
    has_audio: Boolean(row.audio_key),
    is_free: row.is_free,
    views: num(row.view_count),
    rating: num(row.rating_avg),
    rating_count: num(row.rating_count),
    published_at: published,
    articledate: published,
    date: published,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  }
}

export type ArticleDto = ReturnType<typeof serializeArticle>

export function serializeAuthor(row: AuthorRow, storage: StorageService, extra: { is_following?: boolean } = {}) {
  const avatar = storage.publicUrl(row.avatar_key)
  return {
    id: row.id,
    name: row.name,
    bio: row.bio ?? '',
    description: row.bio ?? '',
    thumbnail: avatar,
    avatar_url: avatar,
    avatar_image: responsiveImage(row.avatar_key, urlFor(storage)),
    website: row.website,
    facebook: row.facebook,
    youtube: row.youtube,
    instagram: row.instagram,
    verified: row.is_verified,
    books_count: num(row.books_count),
    bookscount: num(row.books_count),
    articles_count: num(row.articles_count),
    articlescount: num(row.articles_count),
    followers_count: num(row.followers_count),
    is_following: extra.is_following ?? false,
    created_at: iso(row.created_at),
    joined_date: iso(row.created_at),
  }
}

export function serializeCategory(row: CategoryRow, storage: StorageService) {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    parent_id: row.parent_id,
    thumbnail: storage.publicUrl(row.thumbnail_key),
    thumbnail_image: responsiveImage(row.thumbnail_key, urlFor(storage)),
    cover: storage.publicUrl(row.cover_key),
    cover_image: responsiveImage(row.cover_key, urlFor(storage)),
    display_order: row.display_order,
    books_count: num(row.books_count),
    bookscount: num(row.books_count),
    articles_count: num(row.articles_count),
    articlescount: num(row.articles_count),
  }
}

/** Collections as the storefront lists them. */
export function serializeCollectionSummary(
  row: { id: number; title: string; description: string | null; thumbnail_key: string | null },
  storage: StorageService,
) {
  return {
    id: row.id,
    title: row.title,
    name: row.title,
    description: row.description,
    thumbnail: storage.publicUrl(row.thumbnail_key),
    cover_image: responsiveImage(row.thumbnail_key, urlFor(storage)),
    og_image_url: openGraphImageUrl(null, row.thumbnail_key, urlFor(storage)),
  }
}

/** A home-page slide with its separate desktop (21:9) and mobile (4:5) artwork. */
export function serializeSlider(
  row: { id: number; title: string | null; link: string | null; image_key: string; mobile_image_key: string | null },
  storage: StorageService,
) {
  return {
    id: row.id,
    name: row.title,
    title: row.title,
    link: row.link,
    thumbnail: storage.publicUrl(row.image_key),
    image: responsiveImage(row.image_key, urlFor(storage)),
    // Phones fall back to the desktop artwork when no mobile banner was uploaded.
    mobile_thumbnail: storage.publicUrl(row.mobile_image_key ?? row.image_key),
    mobile_image: responsiveImage(row.mobile_image_key ?? row.image_key, urlFor(storage)),
  }
}

export function serializeChapter(row: ChapterRow, access: { locked: boolean; audio_url: string | null; audio_expires_at: string | null }) {
  return {
    id: row.id,
    book_id: row.book_id,
    chapter_number: row.chapter_number,
    title: row.title,
    chapter_title: row.title,
    duration_seconds: row.duration_seconds,
    duration: row.duration_seconds,
    is_preview: row.is_preview,
    locked: access.locked,
    audio_url: access.audio_url,
    /** Signed URLs expire; request the chapters again after this time. */
    audio_expires_at: access.audio_expires_at,
  }
}

export function serializeAccess(decision: AccessDecision) {
  return { granted: decision.granted, reason: decision.reason }
}

export function serializeUser(user: AuthUser, storage: StorageService) {
  const avatar = user.image ? storage.publicUrl(user.image) : null
  const [first, ...rest] = (user.name ?? '').trim().split(/\s+/)
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    firstname: user.firstname ?? first ?? '',
    lastname: user.lastname ?? rest.join(' '),
    phone: user.phone,
    role: user.role,
    is_admin: user.role === 'admin',
    email_verified: user.emailVerified,
    thumbnail: avatar,
    avatar,
    avatar_image: user.image ? responsiveImage(user.image, urlFor(storage)) : null,
    created_at: iso(user.createdAt),
  }
}

export function serializePage<T>(items: T[], page: number, limit: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  return { items, pagination: { page, limit, total, total_pages: totalPages, has_more: page < totalPages } }
}
