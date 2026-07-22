import { View } from 'react-native'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'
import { useTheme } from '@/context/ThemeContext'

/**
 * Screen wrapper providing a themed background + safe-area padding.
 * `edges` defaults to top only (the tab bar handles the bottom inset).
 *
 * Note: NativeWind v4 does not auto-interop `SafeAreaView` from
 * react-native-safe-area-context, so the background is applied via `style`.
 */
export function Screen({
  children,
  edges = ['top'],
}: {
  children: React.ReactNode
  edges?: Edge[]
}) {
  const { isDark } = useTheme()
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: isDark ? '#0f172a' : '#f8fafc' }}>
      <View className="flex-1">{children}</View>
    </SafeAreaView>
  )
}
