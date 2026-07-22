/**
 * URL helpers for Loikmon media assets.
 *
 * The loikmon.org API returns cover/thumbnail URLs that may:
 *  - be relative (need the origin prepended),
 *  - contain backslashes (escaped forward slashes),
 *  - contain raw spaces or narrow no-break spaces (U+202F) that break RN <Image>.
 *
 * `fixUrl` mirrors the logic used by the web app's BookCard component so both
 * clients render the same assets consistently.
 */
/**
 * Media asset origin (host without the `/webapis/` API path).
 *
 * This is separate from the API *base* URL used for endpoints (configured in
 * `services/api.ts`): endpoints hit `.../webapis/`, whereas cover/audio assets
 * are served from the site root. `initApiClient()` calls `setMediaOrigin()` to
 * keep this aligned with a custom `EXPO_PUBLIC_API_BASE` when one is provided.
 */
export const DEFAULT_ORIGIN = 'https://loikmon.org'

let _origin = DEFAULT_ORIGIN

/** Override the media asset origin (e.g. derived from the configured API base). */
export function setMediaOrigin(origin: string): void {
  if (origin) _origin = origin.replace(/\/+$/, '')
}

/** Current media asset origin. */
export function getMediaOrigin(): string {
  return _origin
}

export function fixUrl(url: string | undefined | null, base = _origin): string {
  if (!url) return ''
  let u = String(url).replace(/\\/g, '/')
  // Encode narrow no-break space (U+202F) and regular spaces.
  u = u.replace(/\u202f/gi, '%E2%80%AF').replace(/ /g, '%20')
  if (u.startsWith('http://') || u.startsWith('https://')) return u
  return `${base}${u.startsWith('/') ? '' : '/'}${u}`
}

/** Pick the first non-empty cover-like field from a book/media record. */
export function pickCover(item: Record<string, unknown>): string {
  const candidate =
    (item.thumbnail as string) ??
    (item.coverphoto as string) ??
    (item.cover_url as string) ??
    (item.cover as string) ??
    ''
  return fixUrl(candidate)
}
