import { FlatList, RefreshControl, Text, View, Pressable, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import { Screen } from '@/components/Screen'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { useCategories } from '@/hooks/useCategories'
import { getCategoryIcon } from '@/lib/categoryIcons'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
import type { Category } from '@loikmon/api'

const ITEM_MIN_WIDTH = 160

function CategoryItem({ cat, itemWidth }: { cat: Category; itemWidth: number }) {
  const { headerTextStyle, bodyTextStyle } = useTypography()

  return (
    <Pressable
      onPress={() => router.push(`/category/${cat.id}` as any)}
      style={{ width: itemWidth, padding: 6 }}
      accessibilityRole="button"
      accessibilityLabel={String(cat.name)}
    >
      <View className="rounded-2xl bg-white dark:bg-surface-800 p-4 items-center gap-2"
        style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}
      >
        <View className="w-14 h-14 rounded-xl bg-brand-50 dark:bg-brand-900/30 items-center justify-center">
          <Text style={[headerTextStyle, { fontSize: 30 }]}>{getCategoryIcon(cat.id)}</Text>
        </View>
        <Text
          numberOfLines={2}
          className="text-sm font-semibold text-center text-surface-900 dark:text-surface-50"
          style={headerTextStyle}
        >
          {cat.name}
        </Text>
        {(cat as any).books_count ? (
          <Text className="text-xs text-surface-400" style={bodyTextStyle}>
            {(cat as any).books_count} books
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

export default function CategoriesScreen() {
  const { t } = useI18n()
  const { headerTextStyle } = useTypography()
  const { items, loading, refresh } = useCategories()
  const { width } = useWindowDimensions()

  const columns = Math.max(2, Math.floor(width / ITEM_MIN_WIDTH))
  const itemWidth = width / columns

  if (loading && items.length === 0) return <Screen><LoadingSpinner /></Screen>

  return (
    <Screen>
      <View className="px-4 pb-1 pt-2">
        <Text
          className="text-2xl text-surface-900 dark:text-surface-50 pt-2"
          style={headerTextStyle}
          allowFontScaling={false}
        >
          {t('nav.categories')}
        </Text>
      </View>
      <FlatList
        key={`cols-${columns}`}
        data={items}
        numColumns={columns}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <CategoryItem cat={item} itemWidth={itemWidth} />}
        contentContainerStyle={{ paddingHorizontal: 6, paddingVertical: 8, paddingBottom: 24 }}
        columnWrapperStyle={columns > 1 ? {} : undefined}
        ListEmptyComponent={<EmptyState icon="📂" title={t('common.notFound')} />}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  )
}
