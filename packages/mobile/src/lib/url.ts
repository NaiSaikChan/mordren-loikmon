/**
 * URL helpers for Loikmon media assets.
 *
 * The backend returns absolute URLs: public covers/avatars from object storage
 * and short-lived *signed* URLs for book files and audio. Signed URLs carry an
 * already percent-encoded query string (X-Amz-Credential=…%2F…,
 * response-content-disposition=…%27%27…) and must reach the network exactly as
 * received — re-encoding a single character invalidates the signature.
 *
 * `fixUrl` therefore only repairs what is unambiguously broken and keeps
 * handling legacy values:
 *  - JSON-escaped slashes (`https:\/\/host\/path`),
 *  - raw spaces / narrow no-break spaces (U+202F), which are never valid in a URL,
 *  - relative paths (prefixed with the media origin).
 * Existing `%XX` escapes are never touched.
 */
export const DEFAULT_ORIGIN = 'https://loikmon.org'

let _origin = DEFAULT_ORIGIN

/** Override the origin used to resolve legacy relative media paths. */
export function setMediaOrigin(origin: string): void {
  if (origin) _origin = origin.replace(/\/+$/, '')
}

/** Current media asset origin. */
export function getMediaOrigin(): string {
  return _origin
}

const ABSOLUTE_SCHEME = /^(https?|file|content|data|blob|asset|ph):/i

/** True for pre-signed object-storage URLs (S3/MinIO query-string signatures). */
export function isSignedUrl(url: string | null | undefined): boolean {
  if (!url) return false
  return /[?&](X-Amz-Signature|X-Amz-Credential|Signature|sig|token)=/i.test(url)
}

export function fixUrl(url: string | undefined | null, base = _origin): string {
  if (!url) return ''

  let u = String(url).trim()
  if (!u) return ''

  // Legacy responses double-encoded URLs as JSON strings (https:\/\/host\/path).
  if (u.includes('\\')) {
    try {
      const decoded = JSON.parse(`"${u}"`)
      if (typeof decoded === 'string' && /^https?:\/\//i.test(decoded)) u = decoded
    } catch {
      /* not a JSON-escaped string */
    }
    u = u.replace(/\\\//g, '/')
  }

  // Characters that can never appear raw in a URL. `%` is deliberately left
  // alone so already-encoded (signed) query strings stay byte-for-byte intact.
  u = u.replace(/\u202f/g, '%E2%80%AF').replace(/ /g, '%20')

  if (ABSOLUTE_SCHEME.test(u)) return u
  if (u.startsWith('//')) return `https:${u}`
  return `${base}${u.startsWith('/') ? '' : '/'}${u}`
}

/** Pick the first non-empty cover-like field from a book/article record. */
export function pickCover(item: {
  thumbnail?: string | null
  coverphoto?: string | null
  cover_url?: string | null
  thumbnail_url?: string | null
}): string {
  const candidate = item.thumbnail || item.cover_url || item.coverphoto || item.thumbnail_url || ''
  return fixUrl(candidate)
}
