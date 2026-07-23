import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { type TextStyle } from 'react-native'
import { useI18n } from '@/context/I18nContext'
import { storage } from '@/services/storage'

const BODY_FONT_KEY = 'ui-body-font'
const HEADER_FONT_KEY = 'ui-header-font'

export interface FontOption {
  id: string
  label: string
  family?: string
}

export const FONT_OPTIONS: FontOption[] = [
  { id: 'system', label: 'System Default' },
  { id: 'serif', label: 'Serif' },
  { id: 'Padauk', label: 'Padauk', family: 'Padauk' },
  { id: 'Noto Sans Myanmar', label: 'Noto Sans Myanmar', family: 'Noto Sans Myanmar' },
  { id: 'Noto Serif Myanmar', label: 'Noto Serif Myanmar', family: 'Noto Serif Myanmar' },
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

export const MON_SAFE_FONT_IDS = new Set<string>([
  'system',
  'serif',
  'Padauk',
  'Noto Sans Myanmar',
  'Noto Serif Myanmar',
  'Mon3Anonta1',
  'MUA_Office_adobe',
  'Pyidaungsu',
  'PyidaungsuNumbers',
])

export function getFontFamily(id: string): string | undefined {
  if (id === 'system') return undefined
  if (id === 'serif') return 'serif'
  return FONT_OPTIONS.find((font) => font.id === id)?.family
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

export function TypographyProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useI18n()
  const [bodyFont, setBodyFontState] = useState('Pyidaungsu')
  const [headerFont, setHeaderFontState] = useState('Pyidaungsu')

  useEffect(() => {
    ;(async () => {
      const [savedBody, savedHeader] = await Promise.all([
        storage.get(BODY_FONT_KEY),
        storage.get(HEADER_FONT_KEY),
      ])
      if (savedBody && FONT_OPTIONS.some((font) => font.id === savedBody)) {
        setBodyFontState(savedBody)
      }
      if (savedHeader && FONT_OPTIONS.some((font) => font.id === savedHeader)) {
        setHeaderFontState(savedHeader)
      }
    })()
  }, [])

  const resolvedBodyFontId =
    locale === 'mon' && !MON_SAFE_FONT_IDS.has(bodyFont) ? 'Mon3Anonta1' : bodyFont
  const resolvedHeaderFontId =
    locale === 'mon' && !MON_SAFE_FONT_IDS.has(headerFont) ? 'Mon3Anonta1' : headerFont
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
    void storage.set(BODY_FONT_KEY, id)
  }, [])

  const setHeaderFont = useCallback((id: string) => {
    if (!FONT_OPTIONS.some((font) => font.id === id)) return
    setHeaderFontState(id)
    void storage.set(HEADER_FONT_KEY, id)
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
