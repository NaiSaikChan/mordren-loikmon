import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react'
import { getLocales } from 'expo-localization'
import { storage } from '@/services/storage'
import { translate, type Locale, AVAILABLE_LOCALES } from '@/i18n'

const LOCALE_KEY = 'locale'

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
  locales: typeof AVAILABLE_LOCALES
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

function detectDeviceLocale(): Locale {
  const tag = getLocales()[0]?.languageCode ?? 'en'
  return tag === 'mon' ? 'mon' : 'en'
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')

  useEffect(() => {
    ;(async () => {
      const saved = (await storage.get(LOCALE_KEY)) as Locale | null
      setLocaleState(saved ?? detectDeviceLocale())
    })()
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    void storage.set(LOCALE_KEY, next)
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
