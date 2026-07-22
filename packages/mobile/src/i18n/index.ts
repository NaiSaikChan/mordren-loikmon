import en from './locales/en.json'
import mon from './locales/mon.json'

export type Locale = 'en' | 'mon'

export const messages = { en, mon } as const

export const AVAILABLE_LOCALES: { id: Locale; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'mon', label: 'ဘာသာမန်' },
]

/** Resolve a dotted key path (e.g. "nav.home") from a nested message object. */
export function resolveTranslationKey(obj: unknown, key: string): string | undefined {
  const parts = key.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return undefined
    }
  }
  return typeof cur === 'string' ? cur : undefined
}

/** Simple `{param}` interpolation. */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, name) =>
    name in params ? String(params[name]) : `{${name}}`,
  )
}

/**
 * Translate `key` for `locale`, falling back to English, then to the raw key.
 */
export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string {
  const primary = resolveTranslationKey(messages[locale], key)
  const fallback = resolveTranslationKey(messages.en, key)
  return interpolate(primary ?? fallback ?? key, params)
}
