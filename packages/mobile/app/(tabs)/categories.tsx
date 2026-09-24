import { memo, useCallback } from 'react'
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
  type ListRenderItem,
  type StyleProp,
  type TextStyle,
} from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useReducedMotion } from 'react-native-reanimated'
import type { Category } from '@loikmon/api'
import { Screen } from '@/components/Screen'
import { ListSkeleton } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { CARD_MAX_FONT_SCALE } from '@/components/BookCard'
import { useCategories } from '@/hooks/useCategories'
import { getCategoryIcon } from '@/lib/categoryIcons'
import { pickImage } from '@/lib/url'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
import { useThemeColors } from '@/theme/colors'

const THUMB_SIZE = 44
const keyExtractor = (item: Category) => String(item.id)
const CONTENT = { paddingVertical: 8, paddingBottom: 24 } as const

function Separator() {
  return <View className="ml-16 h-px bg-surface-100 dark:bg-surface-700" />
}

function openCategory(id: Category['id']) {
  router.push({ pathname: '/category/[id]', params: { id: String(id) } })
}

const CategoryRow = memo(function CategoryRow({
  cat,
  countLabel,
  headerTextStyle,
  bodyTextStyle,
  chevronColor,
  reduceMotion,
}: {
  cat: Category
  countLabel: string
  headerTextStyle: StyleProp<TextStyle>
  bodyTextStyle: StyleProp<TextStyle>
  chevronColor: string
  reduceMotion: boolean
}) {
  const thumbnail = pickImage(cat, THUMB_SIZE)
  const id = cat.id
  const onPress = useCallback(() => openCategory(id), [id])

  return (
    <Pressable
      onPress={onPress}
      className="active:opacity-70"
      accessibilityRole="button"
      accessibilityLabel={countLabel ? `${cat.name}, ${countLabel}` : String(cat.name)}
    >
      <View className="min-h-[64px] flex-row items-center gap-3 bg-white px-4 py-3 dark:bg-surface-800">
        <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-control bg-brand-50 dark:bg-brand-900/30">
          {thumbnail ? (
            <Image
              source={thumbnail}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={String(id)}
              transition={reduceMotion ? 0 : 150}
              accessible={false}
            />
          ) : (
            <Text style={[headerTextStyle, { fontSize: 22, lineHeight: 30 }]}>{getCategoryIcon(id)}</Text>
          )}
        </View>
        <View className="flex-1">
          <Text
            numberOfLines={2}
            maxFontSizeMultiplier={CARD_MAX_FONT_SCALE}
            className="text-base font-semibold text-surface-900 dark:text-surface-50"
            style={headerTextStyle}
          >
            {cat.name}
          </Text>
          {countLabel ? (
            <Text
              maxFontSizeMultiplier={CARD_MAX_FONT_SCALE}
              className="text-xs text-surface-500 dark:text-surface-400"
              style={bodyTextStyle}
            >
              {countLabel}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={chevronColor} />
      </View>
    </Pressable>
  )
})

export default function CategoriesScreen() {
  const { t } = useI18n()
  const { headerTextStyle, bodyTextStyle } = useTypography()
  const colors = useThemeColors()
  const reduceMotion = useReducedMotion()
  const { items, loading, refresh } = useCategories()
  const booksLabel = t('books.title')
  const articlesLabel = t('articles.title')
  const onRefresh = useCallback(() => void refresh(), [refresh])

  const renderItem = useCallback<ListRenderItem<Category>>(
    ({ item }) => {
      const parts: string[] = []
      if (item.books_count > 0) parts.push(`${item.books_count} ${booksLabel}`)
      if (item.articles_count > 0) parts.push(`${item.articles_count} ${articlesLabel}`)
      return (
        <CategoryRow
          cat={item}
          countLabel={parts.join(' · ')}
          headerTextStyle={headerTextStyle}
          bodyTextStyle={bodyTextStyle}
          chevronColor={colors.mutedText}
          reduceMotion={reduceMotion}
        />
      )
    },
    [booksLabel, articlesLabel, headerTextStyle, bodyTextStyle, colors.mutedText, reduceMotion],
  )

  return (
    <Screen>
      <View className="px-4 pb-1 pt-3">
        <Text
          className="text-2xl text-surface-900 dark:text-surface-50"
          style={headerTextStyle}
          accessibilityRole="header"
          maxFontSizeMultiplier={1.6}
        >
          {t('nav.categories')}
        </Text>
      </View>
      {loading && items.length === 0 ? (
        <ListSkeleton thumbSize={THUMB_SIZE} rows={10} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ItemSeparatorComponent={Separator}
          contentContainerStyle={CONTENT}
          ListEmptyComponent={<EmptyState icon="📂" title={t('common.notFound')} />}
          refreshControl={
            <RefreshControl
              refreshing={loading && items.length > 0}
              onRefresh={onRefresh}
              tintColor={colors.brand}
              colors={[colors.brandSolid]}
            />
          }
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={9}
          removeClippedSubviews={Platform.OS === 'android'}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        />
      )}
    </Screen>
  )
}
