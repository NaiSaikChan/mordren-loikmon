import { useMemo } from 'react'
import { Tabs } from 'expo-router'
import { View, type ColorValue } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useI18n } from '@/context/I18nContext'
import { MiniPlayer } from '@/components/MiniPlayer'
import { useTypography } from '@/context/TypographyContext'
import { useThemeColors } from '@/theme/colors'

// Approximate default react-navigation bottom tab bar height; the safe-area
// inset is added on top. Used only to float the mini player above the tab bar.
const TAB_BAR_HEIGHT = 49

type IoniconName = keyof typeof Ionicons.glyphMap

function tabIcon(name: IoniconName) {
  function TabIcon({ color, size }: { focused: boolean; color: ColorValue; size: number }) {
    return <Ionicons name={name} size={size} color={String(color)} />
  }
  return TabIcon
}

const ICONS = {
  home: tabIcon('home-outline'),
  books: tabIcon('book-outline'),
  articles: tabIcon('newspaper-outline'),
  categories: tabIcon('grid-outline'),
  library: tabIcon('library-outline'),
}

const HIDDEN = { href: null } as const

export default function TabsLayout() {
  const colors = useThemeColors()
  const { t } = useI18n()
  const { bodyFontFamily } = useTypography()
  const insets = useSafeAreaInsets()

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      tabBarActiveTintColor: colors.brand,
      tabBarInactiveTintColor: colors.mutedText,
      tabBarLabelStyle: { fontFamily: bodyFontFamily },
      tabBarAllowFontScaling: true,
      tabBarStyle: {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
      },
    }),
    [colors, bodyFontFamily],
  )

  const miniPlayerStyle = useMemo(
    () => ({ position: 'absolute' as const, left: 0, right: 0, bottom: TAB_BAR_HEIGHT + insets.bottom, pointerEvents: 'box-none' as const }),
    [insets.bottom],
  )

  return (
    <View className="flex-1 bg-surface-50 dark:bg-surface-900">
      <Tabs screenOptions={screenOptions}>
        <Tabs.Screen name="index" options={{ title: t('nav.home'), tabBarIcon: ICONS.home }} />
        <Tabs.Screen name="books" options={{ title: t('nav.books'), tabBarIcon: ICONS.books }} />
        <Tabs.Screen name="articles" options={{ title: t('nav.articles'), tabBarIcon: ICONS.articles }} />
        <Tabs.Screen name="categories" options={{ title: t('nav.categories'), tabBarIcon: ICONS.categories }} />
        <Tabs.Screen name="library" options={{ title: t('nav.library'), tabBarIcon: ICONS.library }} />
        <Tabs.Screen name="search" options={HIDDEN} />
      </Tabs>
      <View style={miniPlayerStyle}>
        <MiniPlayer />
      </View>
    </View>
  )
}
