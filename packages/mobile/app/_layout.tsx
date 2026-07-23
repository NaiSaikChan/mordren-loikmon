import '../global.css'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { initApiClient } from '@/services/api'
import { ThemeProvider, useTheme } from '@/context/ThemeContext'
import { I18nProvider } from '@/context/I18nContext'
import { AuthProvider } from '@/context/AuthContext'
import { AudioProvider } from '@/context/AudioContext'
import { LibraryProvider } from '@/context/LibraryContext'
import { TypographyProvider, useTypography } from '@/context/TypographyContext'

// Configure the shared axios client once, before any request is made.
initApiClient()

function RootNavigator() {
  const { isDark } = useTheme()
  const { headerFontFamily } = useTypography()
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: isDark ? '#0f172a' : '#ffffff' },
          headerTintColor: isDark ? '#f8fafc' : '#0f172a',
          headerTitleStyle: { fontFamily: headerFontFamily },
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
  const [fontsLoaded] = useFonts({
    Mon3Anonta1: require('../assets/fonts/Mon3Anonta1.ttf'),
    MUA_Office_adobe: require('../assets/fonts/MUA_Office_adobe.ttf'),
    Pyidaungsu: require('../assets/fonts/Pyidaungsu-2.5.4_Regular.ttf'),
    PyidaungsuBold: require('../assets/fonts/Pyidaungsu-2.5.4_Bold.ttf'),
    PyidaungsuNumbers: require('../assets/fonts/PyidaungsuNumbers-Regular.ttf'),
    Style1: require('../assets/fonts/Style1.ttf'),
    Style2: require('../assets/fonts/Style2.ttf'),
    Style3: require('../assets/fonts/Style3.ttf'),
    Style4: require('../assets/fonts/Style4.ttf'),
    Style5: require('../assets/fonts/Style5.ttf'),
  })

  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <TypographyProvider>
              <AuthProvider>
                <LibraryProvider>
                  <AudioProvider>
                    <RootNavigator />
                  </AudioProvider>
                </LibraryProvider>
              </AuthProvider>
            </TypographyProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
