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
export const API_ORIGIN = 'https://loikmon.org'

export function fixUrl(url: string | undefined | null, base = API_ORIGIN): string {
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
