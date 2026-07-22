import { Stack } from 'expo-router'
import { useTheme } from '@/context/ThemeContext'

export default function AuthLayout() {
  const { isDark } = useTheme()
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: isDark ? '#0f172a' : '#ffffff' },
        headerTintColor: isDark ? '#f8fafc' : '#0f172a',
        contentStyle: { backgroundColor: isDark ? '#0f172a' : '#f8fafc' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="login" options={{ title: '' }} />
      <Stack.Screen name="register" options={{ title: '' }} />
      <Stack.Screen name="forgot-password" options={{ title: '' }} />
    </Stack>
  )
}
