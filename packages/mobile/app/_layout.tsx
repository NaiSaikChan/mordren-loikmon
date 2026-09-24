import '../global.css'
import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
import { Stack, useNavigationContainerRef, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { getLocales } from 'expo-localization'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { initApiClient } from '@/services/api'
import { ThemeProvider, useTheme } from '@/context/ThemeContext'
import { I18nProvider, useI18n } from '@/context/I18nContext'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { SubscriptionProvider } from '@/context/SubscriptionContext'
import { AudioProvider } from '@/context/AudioContext'
import { LibraryProvider } from '@/context/LibraryContext'
import { requiredFontFamilies, TypographyProvider, useTypography } from '@/context/TypographyContext'
import { QueryProvider } from '@/lib/queryClient'
import { detectLocale, EMPTY_PREFERENCES, loadPreferences, type StoredPreferences } from '@/lib/preferences'
import { loadAllFonts, loadFonts } from '@/lib/fonts'
import { darkColors, lightColors } from '@/theme/colors'
import { initMonitoring, navigationIntegration, setMonitoringUser, wrapRoot } from '@/lib/monitoring'

// Keep the native splash up until preferences and the fonts they need are
// ready, so the first frame is already in the right theme, language and font.
void SplashScreen.preventAutoHideAsync().catch(() => {})
SplashScreen.setOptions({ fade: true, duration: 200 })

initMonitoring()
// Configure the shared axios client once, before any request is made.
initApiClient()

/** Upper bound on the splash wait: slow storage must never strand the user on it. */
const BOOT_TIMEOUT_MS = 2500

async function boot(): Promise<StoredPreferences> {
  const prefs = await loadPreferences()
  let deviceLocale: 'en' | 'mon' = 'en'
  try {
    deviceLocale = detectLocale(getLocales())
  } catch {
    /* expo-localization unavailable */
  }
  const locale = prefs.locale ?? deviceLocale
  // The Mon fallback face is always needed: it is what Mon text renders in
  // whenever the chosen font cannot shape Mon script.
  await loadFonts([...requiredFontFamilies(prefs, locale), 'Pyidaungsu'])
  return prefs
}

function MonitoringUser() {
  const { user } = useAuth()
  const id = user?.id ?? null
  useEffect(() => {
    setMonitoringUser(id)
  }, [id])
  return null
}

function RootNavigator() {
  const { isDark } = useTheme()
  const colors = isDark ? darkColors : lightColors
  const { headerFontFamily } = useTypography()
  const { t } = useI18n()
  const segments = useSegments() as string[]
  const lead = segments[0] ?? ''
  const currentTabSegment = lead === '(tabs)' ? (segments[1] ?? '') : lead
  const tabsBackTitle =
    currentTabSegment === 'books' || currentTabSegment === 'book'
      ? t('nav.books')
      : currentTabSegment === 'articles'
        ? t('nav.articles')
        : currentTabSegment === 'category'
          ? t('nav.categories')
          : currentTabSegment === 'library'
            ? t('nav.library')
            : t('nav.home')
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: isDark ? colors.background : colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: headerFontFamily },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: tabsBackTitle }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="reader" options={{ title: '' }} />
        <Stack.Screen name="subscribe" options={{ title: t('subscribe.title') }} />
        <Stack.Screen name="audio" options={{ title: '' }} />
        <Stack.Screen name="audiobook/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="category/[id]" options={{ headerShown: false }} />
      </Stack>
    </>
  )
}

function RootLayout() {
  const [prefs, setPrefs] = useState<StoredPreferences | null>(null)
  const navigationRef = useNavigationContainerRef()

  useEffect(() => {
    if (navigationRef) navigationIntegration.registerNavigationContainer(navigationRef)
  }, [navigationRef])

  useEffect(() => {
    let settled = false
    const finish = (value: StoredPreferences) => {
      if (settled) return
      settled = true
      setPrefs(value)
    }
    const timeout = setTimeout(() => finish(EMPTY_PREFERENCES), BOOT_TIMEOUT_MS)
    boot()
      .then(finish, () => finish(EMPTY_PREFERENCES))
      .finally(() => clearTimeout(timeout))
    return () => clearTimeout(timeout)
  }, [])

  // Hide the splash on the first laid-out frame, then warm the remaining
  // fonts (font-picker previews) once the UI is idle.
  const onLayoutRootView = useCallback(() => {
    void SplashScreen.hideAsync().catch(() => {})
    requestIdleCallback(() => {
      void loadAllFonts()
    })
  }, [])

  if (!prefs) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <SafeAreaProvider>
          <QueryProvider>
            <ThemeProvider initialPref={prefs.theme}>
              <I18nProvider initialLocale={prefs.locale}>
                <TypographyProvider initialBodyFont={prefs.bodyFont} initialHeaderFont={prefs.headerFont}>
                  <AuthProvider>
                    <MonitoringUser />
                    <SubscriptionProvider>
                      <LibraryProvider>
                        <AudioProvider>
                          <RootNavigator />
                        </AudioProvider>
                      </LibraryProvider>
                    </SubscriptionProvider>
                  </AuthProvider>
                </TypographyProvider>
              </I18nProvider>
            </ThemeProvider>
          </QueryProvider>
        </SafeAreaProvider>
      </View>
    </GestureHandlerRootView>
  )
}

export default wrapRoot(RootLayout)
