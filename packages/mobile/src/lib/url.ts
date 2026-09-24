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

/** Minimal shape of the backend's `ResponsiveImage` (see @loikmon/media-standards). */
export interface ImageVariants {
  src?: string | null
  original?: string | null
  variants?: Partial<Record<string, string>> | null
}

/** Pixel widths of the responsive WebP renditions, smallest first. */
const VARIANT_WIDTHS: readonly [name: string, width: number][] = [
  ['xs', 150],
  ['sm', 300],
  ['md', 600],
  ['lg', 1200],
]

/**
 * Smallest responsive rendition at least `displayWidth × pixelRatio` wide, so
 * a 44pt avatar downloads a 150px WebP instead of the full-size original.
 * Returns '' when the image has no usable URL.
 */
export function pickVariant(image: ImageVariants | null | undefined, displayWidth: number, pixelRatio = 3): string {
  if (!image) return ''
  const variants = image.variants ?? {}
  const needed = displayWidth * pixelRatio
  const fit = VARIANT_WIDTHS.find(([name, width]) => width >= needed && variants[name])
  const largest = [...VARIANT_WIDTHS].reverse().find(([name]) => variants[name])
  const chosen = fit ?? largest
  return fixUrl((chosen && variants[chosen[0]]) || image.src || image.original || '')
}

/**
 * Best image URL for a record rendered `displayWidth` points wide: a sized
 * responsive variant when the backend provides one, else the legacy fields.
 */
export function pickImage(
  item: {
    cover_image?: ImageVariants | null
    thumbnail_image?: ImageVariants | null
    avatar_image?: ImageVariants | null
    thumbnail?: string | null
    coverphoto?: string | null
    cover_url?: string | null
    thumbnail_url?: string | null
    avatar?: string | null
    avatar_url?: string | null
  },
  displayWidth: number,
  pixelRatio = 3,
): string {
  const responsive = item.cover_image ?? item.thumbnail_image ?? item.avatar_image
  const sized = pickVariant(responsive, displayWidth, pixelRatio)
  if (sized) return sized
  return pickCover(item) || fixUrl(item.avatar_url || item.avatar || '')
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
