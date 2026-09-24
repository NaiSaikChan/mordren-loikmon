import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { type TextStyle } from 'react-native'
import { useI18n } from '@/context/I18nContext'
import type { Locale } from '@/i18n'
import { storage } from '@/services/storage'
import { PREF_KEYS } from '@/lib/preferences'

export interface FontOption {
  id: string
  label: string
  family?: string
}

export const FONT_OPTIONS: FontOption[] = [
  { id: 'system', label: 'System Default' },
  { id: 'serif', label: 'Serif' },
  { id: 'Mon3Anonta1', label: 'Mon3 Anonta1', family: 'Mon3Anonta1' },
  { id: 'MUA_Office_adobe', label: 'MUA Office', family: 'MUA_Office_adobe' },
  { id: 'Pyidaungsu', label: 'Pyidaungsu', family: 'Pyidaungsu' },
  { id: 'PyidaungsuNumbers', label: 'Pyidaungsu Numbers', family: 'PyidaungsuNumbers' },
  { id: 'Style1', label: 'Style 1', family: 'Style1' },
  { id: 'Style2', label: 'Style 2', family: 'Style2' },
  { id: 'Style3', label: 'Style 3', family: 'Style3' },
  { id: 'Style4', label: 'Style 4', family: 'Style4' },
  { id: 'Style5', label: 'Style 5', family: 'Style5' },
]

// Only fonts that ship in assets/fonts (see lib/fonts). Padauk and the Noto
// Myanmar faces used to be listed here but were never bundled, so choosing them
// — or falling back to them — rendered Mon text in an unrecognised family.
export const MON_SAFE_FONT_IDS = new Set<string>([
  'Mon3Anonta1',
  'MUA_Office_adobe',
  'Pyidaungsu',
  'PyidaungsuNumbers',
])

export const MON_LOCALE_FALLBACK_FONT_ID = 'Pyidaungsu'
export const DEFAULT_FONT_ID = 'Pyidaungsu'

function validFontId(id: string | null | undefined): string {
  return id && FONT_OPTIONS.some((font) => font.id === id) ? id : DEFAULT_FONT_ID
}

export function getFontFamily(id: string): string | undefined {
  if (id === 'system') return undefined
  if (id === 'serif') return 'serif'
  return FONT_OPTIONS.find((font) => font.id === id)?.family
}

export function resolveFontIdForLocale(id: string, locale: Locale): string {
  if (locale !== 'mon') return id
  return MON_SAFE_FONT_IDS.has(id) ? id : MON_LOCALE_FALLBACK_FONT_ID
}

interface TypographyContextValue {
  bodyFont: string
  headerFont: string
  bodyFontFamily: string | undefined
  headerFontFamily: string | undefined
  bodyTextStyle: TextStyle | undefined
  headerTextStyle: TextStyle | undefined
  setBodyFont: (id: string) => void
  setHeaderFont: (id: string) => void
}

const TypographyContext = createContext<TypographyContextValue | undefined>(undefined)

/** Font families start-up must load before the first frame, for the given saved choices. */
export function requiredFontFamilies(
  saved: { bodyFont?: string | null; headerFont?: string | null },
  locale: Locale,
): string[] {
  return [saved.bodyFont, saved.headerFont]
    .map((id) => getFontFamily(resolveFontIdForLocale(validFontId(id), locale)))
    .filter((family): family is string => !!family)
}

export function TypographyProvider({
  children,
  initialBodyFont,
  initialHeaderFont,
}: {
  children: React.ReactNode
  /** Saved choices, read before the first frame (see lib/preferences). */
  initialBodyFont?: string | null
  initialHeaderFont?: string | null
}) {
  const { locale } = useI18n()
  const [bodyFont, setBodyFontState] = useState(() => validFontId(initialBodyFont))
  const [headerFont, setHeaderFontState] = useState(() => validFontId(initialHeaderFont))

  const resolvedBodyFontId = resolveFontIdForLocale(bodyFont, locale)
  const resolvedHeaderFontId = resolveFontIdForLocale(headerFont, locale)
  const bodyFontFamily = getFontFamily(resolvedBodyFontId)
  const headerFontFamily = getFontFamily(resolvedHeaderFontId)
  const bodyTextStyle = useMemo<TextStyle | undefined>(
    () => (bodyFontFamily ? { fontFamily: bodyFontFamily } : undefined),
    [bodyFontFamily],
  )
  const headerTextStyle = useMemo<TextStyle | undefined>(
    () => (headerFontFamily ? { fontFamily: headerFontFamily } : undefined),
    [headerFontFamily],
  )

  const setBodyFont = useCallback((id: string) => {
    if (!FONT_OPTIONS.some((font) => font.id === id)) return
    setBodyFontState(id)
    void storage.set(PREF_KEYS.bodyFont, id)
  }, [])

  const setHeaderFont = useCallback((id: string) => {
    if (!FONT_OPTIONS.some((font) => font.id === id)) return
    setHeaderFontState(id)
    void storage.set(PREF_KEYS.headerFont, id)
  }, [])

  const value = useMemo<TypographyContextValue>(
    () => ({
      bodyFont,
      headerFont,
      bodyFontFamily,
      headerFontFamily,
      bodyTextStyle,
      headerTextStyle,
      setBodyFont,
      setHeaderFont,
    }),
    [
      bodyFont,
      headerFont,
      bodyFontFamily,
      headerFontFamily,
      bodyTextStyle,
      headerTextStyle,
      setBodyFont,
      setHeaderFont,
    ],
  )

  return <TypographyContext.Provider value={value}>{children}</TypographyContext.Provider>
}

export function useTypography(): TypographyContextValue {
  const ctx = useContext(TypographyContext)
  if (!ctx) throw new Error('useTypography must be used within a TypographyProvider')
  return ctx
}
