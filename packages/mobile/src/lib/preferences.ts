import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Locale } from '@/i18n'

/**
 * Display preferences read once, behind the splash screen, before the first
 * frame. Previously each provider read its own key in an effect after paint,
 * so a returning user saw light→dark, English→Mon and a font swap on launch.
 */
export type ThemePref = 'light' | 'dark' | 'system'

export const PREF_KEYS = {
  theme: 'theme',
  locale: 'locale',
  bodyFont: 'ui-body-font',
  headerFont: 'ui-header-font',
} as const

export interface StoredPreferences {
  theme: ThemePref | null
  locale: Locale | null
  bodyFont: string | null
  headerFont: string | null
}

export const EMPTY_PREFERENCES: StoredPreferences = { theme: null, locale: null, bodyFont: null, headerFont: null }

const THEMES: readonly string[] = ['light', 'dark', 'system']
const LOCALES: readonly string[] = ['en', 'mon']

/** One batched storage read. Never throws: unreadable storage means defaults. */
export async function loadPreferences(): Promise<StoredPreferences> {
  try {
    const entries = await AsyncStorage.multiGet(Object.values(PREF_KEYS))
    const map = new Map(entries)
    const theme = map.get(PREF_KEYS.theme) ?? null
    const locale = map.get(PREF_KEYS.locale) ?? null
    return {
      theme: theme && THEMES.includes(theme) ? (theme as ThemePref) : null,
      locale: locale && LOCALES.includes(locale) ? (locale as Locale) : null,
      bodyFont: map.get(PREF_KEYS.bodyFont) ?? null,
      headerFont: map.get(PREF_KEYS.headerFont) ?? null,
    }
  } catch {
    return EMPTY_PREFERENCES
  }
}

/**
 * Device locale → app locale. Mon has no ISO 639-1 code: devices report the
 * ISO 639-3 code `mnw` (the old check for `mon` never matched).
 */
export function detectLocale(locales: readonly { languageCode?: string | null; languageTag?: string | null }[]): Locale {
  for (const l of locales) {
    const code = (l.languageCode ?? l.languageTag?.split('-')[0] ?? '').toLowerCase()
    if (code === 'mnw' || code === 'mon') return 'mon'
    if (code) return 'en'
  }
  return 'en'
}
