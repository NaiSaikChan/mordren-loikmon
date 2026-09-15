import type { Pagination } from '@loikmon/api'

/**
 * Small, pure helpers shared by the data hooks.
 *
 * The backend (`/api/v1`) returns typed, consistent shapes (`{ books, pagination }`,
 * `{ book }`, `{ article }`, ...), so the old defensive payload sniffing is gone.
 * What remains is list hygiene and route-param handling.
 */

/** An array, or `[]` for null/undefined/non-array values. */
export function listOf<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}

/** Removes items with duplicate `id`s (string/number insensitive), keeping the first occurrence. */
export function uniqueById<T extends { id: unknown }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = String(item.id)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Appends a page to an existing list without duplicating items that shifted between pages. */
export function appendUnique<T extends { id: unknown }>(prev: T[], next: T[]): T[] {
  return uniqueById([...prev, ...next])
}

/** Whether another page exists, from the backend's pagination block. */
export function hasMorePages(pagination: Pick<Pagination, 'has_more'> | null | undefined): boolean {
  return Boolean(pagination?.has_more)
}

/** First value of an expo-router param (`string | string[] | undefined`). */
export function firstParam(value: string | string[] | undefined | null): string | undefined {
  const v = Array.isArray(value) ? value[0] : value
  return v == null || String(v).trim() === '' ? undefined : String(v)
}

/**
 * Plain-text rendition of an HTML fragment (article bodies/excerpts).
 * Script/style blocks are removed entirely, remaining tags are stripped. The
 * result is rendered inside <Text>, so no markup can execute.
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
