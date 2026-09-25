import { memo, useCallback } from 'react'
import { FlatList, View, Text, Pressable, type ListRenderItem } from 'react-native'
import { Image } from 'expo-image'
import { Stack, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { Book } from '@loikmon/api'
import { Screen } from '@/components/Screen'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { PriceBadge } from '@/components/PriceBadge'
import { RequireAuth } from '@/components/RequireAuth'
import { useBooks } from '@/hooks/useBooks'
import { useAudioControls } from '@/context/AudioContext'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
import { useTheme } from '@/context/ThemeContext'
import { pickImage } from '@/lib/url'

/** Rendered size of a row's cover, in points. */
const COVER_SIZE = 56

const AudioRow = memo(function AudioRow({ book }: { book: Book }) {
  // Controls only: rows never re-render as the playing position ticks.
  const { current, isPlaying, toggle } = useAudioControls()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const { isDark } = useTheme()
  const { t } = useI18n()
  const cover = pickImage(book, COVER_SIZE)
  const isCurrent = current?.sourceType === 'book' && String(current.sourceBookId) === String(book.id)
  const accent = isDark ? '#d4a843' : '#c9922a'
  const muted = isDark ? '#94a3b8' : '#64748b'

  // Chapters (and their lock state) are loaded by the player screen from `books.getChapters`.
  const onPress = () => router.push({ pathname: '/audiobook/[id]', params: { id: String(book.id) } })

  // The toggle sits beside (not inside) the row button so screen readers can reach both.
  return (
    <View className="mb-3 flex-row items-center rounded-xl bg-white p-3 dark:bg-surface-800">
      <Pressable
        onPress={onPress}
        className="min-h-11 flex-1 flex-row items-center"
        accessibilityRole="button"
        accessibilityLabel={book.authorname ? `${book.title}, ${book.authorname}` : book.title}
      >
        <View className="h-14 w-14 overflow-hidden rounded-lg bg-surface-200 dark:bg-surface-700">
          {cover ? (
            <Image
              source={{ uri: cover }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
              recyclingKey={String(book.id)}
              accessible={false}
            />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Ionicons name="headset-outline" size={22} color={accent} />
            </View>
          )}
        </View>
        <View className="ml-3 flex-1">
          <Text numberOfLines={1} className="text-sm text-surface-900 dark:text-surface-50" style={headerTextStyle}>
            {book.title}
          </Text>
          <Text numberOfLines={1} className="text-xs text-surface-400" style={bodyTextStyle}>
            {book.authorname ?? ''}
          </Text>
          <View className="mt-1">
            <PriceBadge item={book} />
          </View>
        </View>
        {isCurrent ? null : <Ionicons name="chevron-forward" size={22} color={muted} />}
      </Pressable>
      {isCurrent ? (
        <Pressable
          onPress={() => void toggle()}
          hitSlop={6}
          className="h-11 w-11 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? t('audio.pause') : t('audio.play')}
        >
          <Ionicons name={isPlaying ? 'pause-circle' : 'play-circle'} size={34} color={accent} />
        </Pressable>
      ) : null}
    </View>
  )
})

const keyExtractor = (item: Book) => String(item.id)
const renderItem: ListRenderItem<Book> = ({ item }) => <AudioRow book={item} />

export default function AudioScreen() {
  return (
    <RequireAuth>
      <AudioContent />
    </RequireAuth>
  )
}

function AudioContent() {
  const { t } = useI18n()
  const { items, loading, refreshing, refresh, loadMore } = useBooks({ has_audio: true, sort: 'latest' })
  const onEndReached = useCallback(() => void loadMore(), [loadMore])
  const onRefresh = useCallback(() => void refresh(), [refresh])

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: t('nav.music') }} />
      {loading && items.length === 0 ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          data={items}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={<EmptyState icon="🎵" title={t('music.noMusic')} />}
        />
      )}
    </Screen>
  )
}
