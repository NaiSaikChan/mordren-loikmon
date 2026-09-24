import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react'
import { useColorScheme as useRNColorScheme } from 'react-native'
import { colorScheme as nwColorScheme } from 'nativewind'
import { storage } from '@/services/storage'
import { PREF_KEYS, type ThemePref } from '@/lib/preferences'

export type { ThemePref }

interface ThemeContextValue {
  /** User preference: light | dark | system. */
  pref: ThemePref
  /** Effective scheme after resolving `system`. */
  scheme: 'light' | 'dark'
  isDark: boolean
  setPref: (pref: ThemePref) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({
  children,
  initialPref,
}: {
  children: React.ReactNode
  /** Saved preference, read before the first frame (see lib/preferences). */
  initialPref?: ThemePref | null
}) {
  const rawScheme = useRNColorScheme()
  const systemScheme: 'light' | 'dark' = rawScheme === 'dark' ? 'dark' : 'light'
  const [pref, setPrefState] = useState<ThemePref>(initialPref ?? 'system')

  const scheme: 'light' | 'dark' = pref === 'system' ? systemScheme : pref

  // Keep NativeWind's class-based dark mode in sync with the resolved scheme.
  useEffect(() => {
    nwColorScheme.set(pref)
  }, [pref])

  const setPref = useCallback((next: ThemePref) => {
    setPrefState(next)
    void storage.set(PREF_KEYS.theme, next)
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
