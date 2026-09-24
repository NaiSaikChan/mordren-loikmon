import React, { createContext, useContext, useCallback, useMemo, useState } from 'react'
import { getLocales } from 'expo-localization'
import { storage } from '@/services/storage'
import { translate, type Locale, AVAILABLE_LOCALES } from '@/i18n'
import { detectLocale, PREF_KEYS } from '@/lib/preferences'

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
  locales: typeof AVAILABLE_LOCALES
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

function detectDeviceLocale(): Locale {
  try {
    return detectLocale(getLocales())
  } catch {
    return 'en'
  }
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode
  /** Saved locale, read before the first frame; device locale when unset. */
  initialLocale?: Locale | null
}) {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale ?? detectDeviceLocale())

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    void storage.set(PREF_KEYS.locale, next)
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale],
  )

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t, locales: AVAILABLE_LOCALES }),
    [locale, setLocale, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider')
  return ctx
}
