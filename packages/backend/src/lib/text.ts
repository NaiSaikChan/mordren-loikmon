/** Plain-text excerpt from article HTML, used when an editor does not provide one. */
export function makeExcerpt(html: string, length = 280): string {
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text
}

/**
 * Make a legacy upload URL fetchable: legacy paths contain raw spaces,
 * Mon script and escaped slashes. Already-encoded URLs are left intact.
 */
export function normalizeLegacyUrl(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim().replace(/\\\//g, '/').replace(/\\/g, '/')
  if (!/^https?:\/\//i.test(trimmed)) return null
  try {
    return encodeURI(decodeURI(trimmed))
  } catch {
    return encodeURI(trimmed)
  }
}
