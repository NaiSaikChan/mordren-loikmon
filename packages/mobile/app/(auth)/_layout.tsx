import { useMemo } from 'react'
import { Stack } from 'expo-router'
import { useTypography } from '@/context/TypographyContext'
import { useThemeColors } from '@/theme/colors'

export default function AuthLayout() {
  const colors = useThemeColors()
  const { headerFontFamily } = useTypography()
  const screenOptions = useMemo(
    () => ({
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.text,
      headerTitleStyle: { fontFamily: headerFontFamily },
      headerBackTitleStyle: { fontFamily: headerFontFamily },
      contentStyle: { backgroundColor: colors.background },
      headerShadowVisible: false,
    }),
    [colors, headerFontFamily],
  )
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="login" options={{ title: '' }} />
      <Stack.Screen name="register" options={{ title: '' }} />
      <Stack.Screen name="forgot-password" options={{ title: '' }} />
    </Stack>
  )
}
