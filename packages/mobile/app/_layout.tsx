import '../global.css'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { initApiClient } from '@/services/api'
import { ThemeProvider, useTheme } from '@/context/ThemeContext'
import { I18nProvider } from '@/context/I18nContext'
import { AuthProvider } from '@/context/AuthContext'
import { AudioProvider } from '@/context/AudioContext'
import { LibraryProvider } from '@/context/LibraryContext'

// Configure the shared axios client once, before any request is made.
initApiClient()

function RootNavigator() {
  const { isDark } = useTheme()
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: isDark ? '#0f172a' : '#ffffff' },
          headerTintColor: isDark ? '#f8fafc' : '#0f172a',
          contentStyle: { backgroundColor: isDark ? '#0f172a' : '#f8fafc' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="reader" options={{ title: '' }} />
      </Stack>
    </>
  )
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <LibraryProvider>
                <AudioProvider>
                  <RootNavigator />
                </AudioProvider>
              </LibraryProvider>
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
