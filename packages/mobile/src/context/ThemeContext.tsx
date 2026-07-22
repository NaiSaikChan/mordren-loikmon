import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react'
import { useColorScheme as useRNColorScheme } from 'react-native'
import { colorScheme as nwColorScheme } from 'nativewind'
import { storage } from '@/services/storage'

export type ThemePref = 'light' | 'dark' | 'system'

const THEME_KEY = 'theme'

interface ThemeContextValue {
  /** User preference: light | dark | system. */
  pref: ThemePref
  /** Effective scheme after resolving `system`. */
  scheme: 'light' | 'dark'
  isDark: boolean
  setPref: (pref: ThemePref) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useRNColorScheme() ?? 'light'
  const [pref, setPrefState] = useState<ThemePref>('system')

  useEffect(() => {
    ;(async () => {
      const saved = (await storage.get(THEME_KEY)) as ThemePref | null
      if (saved) setPrefState(saved)
    })()
  }, [])

  const scheme: 'light' | 'dark' = pref === 'system' ? systemScheme : pref

  // Keep NativeWind's class-based dark mode in sync with the resolved scheme.
  useEffect(() => {
    nwColorScheme.set(pref)
  }, [pref])

  const setPref = useCallback((next: ThemePref) => {
    setPrefState(next)
    void storage.set(THEME_KEY, next)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ pref, scheme, isDark: scheme === 'dark', setPref }),
    [pref, scheme, setPref],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
