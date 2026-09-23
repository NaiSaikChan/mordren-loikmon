import { FlatList, RefreshControl, Text, View, Pressable, Image } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { useCategories } from '@/hooks/useCategories'
import { getCategoryIcon } from '@/lib/categoryIcons'
import { fixUrl } from '@/lib/url'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
import type { Category } from '@loikmon/api'

function CategoryRow({ cat }: { cat: Category }) {
  const { t } = useI18n()
  const { headerTextStyle, bodyTextStyle } = useTypography()
  const thumbnail = fixUrl(cat.thumbnail_image?.src || cat.thumbnail)

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/category/[id]', params: { id: String(cat.id) } })}
      className="flex-row items-center gap-3 bg-white dark:bg-surface-800 px-4 py-3 active:opacity-70"
      accessibilityRole="button"
      accessibilityLabel={String(cat.name)}
    >
      <View className="w-11 h-11 rounded-xl bg-brand-50 dark:bg-brand-900/30 items-center justify-center overflow-hidden">
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} className="w-full h-full" resizeMode="cover" />
        ) : (
          <Text style={[headerTextStyle, { fontSize: 22 }]}>{getCategoryIcon(cat.id)}</Text>
        )}
      </View>
      <View className="flex-1">
        <Text
          numberOfLines={1}
          className="text-base font-semibold text-surface-900 dark:text-surface-50"
          style={headerTextStyle}
        >
          {cat.name}
        </Text>
        {cat.books_count > 0 || cat.articles_count > 0 ? (
          <Text className="text-xs text-surface-400 mt-0.5" style={bodyTextStyle}>
            {cat.books_count > 0 ? `${cat.books_count} ${t('books.title')}` : ''}
            {cat.books_count > 0 && cat.articles_count > 0 ? ' · ' : ''}
            {cat.articles_count > 0 ? `${cat.articles_count} ${t('articles.title')}` : ''}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
    </Pressable>
  )
}

export default function CategoriesScreen() {
  const { t } = useI18n()
  const { headerTextStyle } = useTypography()
  const { items, loading, refresh } = useCategories()

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
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <CategoryRow cat={item} />}
        ItemSeparatorComponent={() => <View className="h-px bg-surface-100 dark:bg-surface-700 ml-16" />}
        contentContainerStyle={{ paddingVertical: 8, paddingBottom: 24 }}
        ListEmptyComponent={<EmptyState icon="📂" title={t('common.notFound')} />}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      />
    </Screen>
  )
}
