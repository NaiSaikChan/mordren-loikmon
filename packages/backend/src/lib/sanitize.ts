/**
 * Allow-list HTML sanitiser for rich-text written in the CMS.
 *
 * The browser already sanitises with DOMPurify before rendering; this is the
 * second half of a defence-in-depth pair, so a stored payload can never reach
 * a client that forgets to sanitise (RSS, e-mail digests, the mobile app's
 * WebView) and a compromised editor session cannot persist script.
 *
 * It is deliberately conservative: unknown elements are unwrapped (their text
 * survives), dangerous elements are dropped whole, and every attribute must be
 * on the allow-list with a safe URL scheme.
 */

const VOID_ELEMENTS = new Set(['br', 'hr', 'img', 'source', 'col', 'wbr'])

/** Dropped together with everything they contain. */
const DROPPED_ELEMENTS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'applet',
  'form',
  'input',
  'button',
  'select',
  'option',
  'textarea',
  'link',
  'meta',
  'base',
  'noscript',
  'template',
  'svg',
  'math',
])

const GLOBAL_ATTRIBUTES = new Set(['class', 'id', 'title', 'dir', 'lang'])

/** tag -> extra attributes allowed on it. */
const ALLOWED: Readonly<Record<string, readonly string[]>> = {
  p: [],
  br: [],
  hr: [],
  div: [],
  span: [],
  section: [],
  article: [],
  header: [],
  footer: [],
  h1: [],
  h2: [],
  h3: [],
  h4: [],
  h5: [],
  h6: [],
  strong: [],
  b: [],
  em: [],
  i: [],
  u: [],
  s: [],
  sub: [],
  sup: [],
  mark: [],
  small: [],
  code: [],
  pre: [],
  kbd: [],
  blockquote: ['cite'],
  ul: [],
  ol: ['start', 'type'],
  li: ['value'],
  dl: [],
  dt: [],
  dd: [],
  a: ['href', 'target', 'rel', 'name'],
  img: ['src', 'alt', 'width', 'height', 'loading', 'srcset', 'sizes'],
  figure: [],
  figcaption: [],
  audio: ['src', 'controls', 'preload'],
  table: [],
  thead: [],
  tbody: [],
  tfoot: [],
  tr: [],
  th: ['colspan', 'rowspan', 'scope'],
  td: ['colspan', 'rowspan'],
  caption: [],
  time: ['datetime'],
  abbr: [],
}

const URL_ATTRIBUTES = new Set(['href', 'src', 'srcset', 'cite'])
const SAFE_SCHEME = /^(https?:|mailto:|tel:|\/|#|data:image\/(png|jpeg|gif|webp);base64,)/i

/** Escapes markup while leaving existing character references intact. */
function escapeText(value: string): string {
  return value
    .replace(/&(?!#[0-9]{1,7};|#[xX][0-9a-fA-F]{1,6};|[a-zA-Z][a-zA-Z0-9]{1,31};)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function isSafeUrl(value: string): boolean {
  // Control characters and whitespace are stripped first: interleaving them
  // (for example "java\tscript:") is how payloads slip past a prefix check.
  const cleaned = value.replace(/[\u0000-\u0020\u007f-\u00a0]/g, '')
  return SAFE_SCHEME.test(cleaned)
}

const ATTRIBUTE_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g

function sanitizeAttributes(tag: string, raw: string): string {
  const allowedForTag = ALLOWED[tag] ?? []
  const out: string[] = []
  ATTRIBUTE_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ATTRIBUTE_RE.exec(raw)) !== null) {
    const name = match[1].toLowerCase()
    const value = match[2] ?? match[3] ?? match[4] ?? ''
    if (name.startsWith('on')) continue // every inline event handler
    if (name === 'style') continue // url(javascript:…), expression(…)
    if (!GLOBAL_ATTRIBUTES.has(name) && !allowedForTag.includes(name)) continue
    if (URL_ATTRIBUTES.has(name) && !isSafeUrl(value)) continue
    out.push(value === '' ? name : `${name}="${escapeAttribute(value)}"`)
  }
  // Links that open a new tab must not hand the opener to the target page.
  if (tag === 'a' && out.some((a) => a.startsWith('target='))) {
    const rel = out.findIndex((a) => a.startsWith('rel='))
    if (rel >= 0) out.splice(rel, 1)
    out.push('rel="noopener noreferrer nofollow"')
  }
  return out.length ? ` ${out.join(' ')}` : ''
}

/**
 * Returns HTML containing only allow-listed elements and attributes.
 * Unbalanced or unknown tags are unwrapped rather than trusted.
 */
export function sanitizeHtml(input: string): string {
  if (!input) return ''
  let html = input
    // Comments (including the conditional-comment form) never survive.
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
  for (const tag of DROPPED_ELEMENTS) {
    html = html
      .replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '')
      .replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi'), '')
  }

  const open: string[] = []
  let out = ''
  let cursor = 0
  const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^<>"']|"[^"]*"|'[^']*')*)>/g
  let match: RegExpExecArray | null

  while ((match = TAG_RE.exec(html)) !== null) {
    out += escapeText(html.slice(cursor, match.index))
    cursor = TAG_RE.lastIndex
    const closing = match[1] === '/'
    const tag = match[2].toLowerCase()
    if (!(tag in ALLOWED)) continue // unwrap: keep the text, drop the element

    if (closing) {
      const index = open.lastIndexOf(tag)
      if (index === -1) continue // stray close tag
      // Close anything left open inside it, innermost first.
      for (let i = open.length - 1; i >= index; i -= 1) out += `</${open[i]}>`
      open.splice(index)
      continue
    }

    const attributes = sanitizeAttributes(tag, match[3] ?? '')
    if (VOID_ELEMENTS.has(tag)) {
      out += `<${tag}${attributes} />`
    } else {
      out += `<${tag}${attributes}>`
      open.push(tag)
    }
  }

  out += escapeText(html.slice(cursor))
  for (let i = open.length - 1; i >= 0; i -= 1) out += `</${open[i]}>`
  return out
}

/** Collapse rich text to plain text (search indexes, e-mail, excerpts). */
export function htmlToText(input: string): string {
  return input
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/?(p|div|br|li|h[1-6]|tr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Strips every tag; for single-line fields that must never contain markup. */
export function sanitizePlainText(input: string): string {
  return htmlToText(input).replace(/\s+/g, ' ').trim()
}
