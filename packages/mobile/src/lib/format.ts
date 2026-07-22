export type DocFormat = 'pdf' | 'epub' | 'unknown'

/** Detects the document kind from a URL/extension. */
export function detectFormat(url: string): DocFormat {
  const clean = url.split('?')[0].toLowerCase()
  if (clean.endsWith('.pdf')) return 'pdf'
  if (clean.endsWith('.epub')) return 'epub'
  return 'unknown'
}
