import { Tabs } from 'expo-router'
import { View, type ColorValue } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/context/ThemeContext'
import { useI18n } from '@/context/I18nContext'
import { MiniPlayer } from '@/components/MiniPlayer'

// Approximate default react-navigation bottom tab bar height; the safe-area
// inset is added on top. Used only to float the mini player above the tab bar.
const TAB_BAR_HEIGHT = 49

type IoniconName = keyof typeof Ionicons.glyphMap

function tabIcon(name: IoniconName) {
  return ({ color, size }: { focused: boolean; color: ColorValue; size: number }) => (
    <Ionicons name={name} size={size} color={String(color)} />
  )
}

export default function TabsLayout() {
  const { isDark } = useTheme()
  const { t } = useI18n()
  const insets = useSafeAreaInsets()

  return (
    <View className="flex-1 bg-surface-50 dark:bg-surface-900">
      <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#2563eb',
            tabBarInactiveTintColor: isDark ? '#64748b' : '#94a3b8',
            tabBarStyle: {
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              borderTopColor: isDark ? '#1e293b' : '#e2e8f0',
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{ title: t('nav.home'), tabBarIcon: tabIcon('home-outline') }}
          />
          <Tabs.Screen
            name="books"
            options={{ title: t('nav.books'), tabBarIcon: tabIcon('book-outline') }}
          />
          <Tabs.Screen
            name="articles"
            options={{ title: t('nav.articles'), tabBarIcon: tabIcon('newspaper-outline') }}
          />
          <Tabs.Screen
            name="search"
            options={{ title: t('nav.search'), tabBarIcon: tabIcon('search-outline') }}
          />
          <Tabs.Screen
            name="library"
            options={{ title: t('nav.library'), tabBarIcon: tabIcon('library-outline') }}
          />
        </Tabs>
      <View
        style={{ position: 'absolute', left: 0, right: 0, bottom: TAB_BAR_HEIGHT + insets.bottom, pointerEvents: 'box-none' }}
      >
        <MiniPlayer />
      </View>
    </View>
  )
}
