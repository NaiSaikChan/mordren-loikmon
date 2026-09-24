import { useMemo } from 'react'
import { Stack } from 'expo-router'
import { useThemeColors } from '@/theme/colors'

export default function AuthLayout() {
  const colors = useThemeColors()
  const screenOptions = useMemo(
    () => ({
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.text,
      contentStyle: { backgroundColor: colors.background },
      headerShadowVisible: false,
    }),
    [colors],
  )
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="login" options={{ title: '' }} />
      <Stack.Screen name="register" options={{ title: '' }} />
      <Stack.Screen name="forgot-password" options={{ title: '' }} />
    </Stack>
  )
}
