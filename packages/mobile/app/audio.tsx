import { FlatList, View, Text, Image, Pressable } from 'react-native'
import { Stack, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { Book } from '@loikmon/api'
import { Screen } from '@/components/Screen'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { PriceBadge } from '@/components/PriceBadge'
import { useBooks } from '@/hooks/useBooks'
import { useAudio } from '@/context/AudioContext'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
import { pickCover } from '@/lib/url'

function AudioRow({ book }: { book: Book }) {
  const { current, isPlaying } = useAudio()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const cover = pickCover(book)
  const isCurrent = current?.sourceType === 'book' && String(current.sourceBookId) === String(book.id)

  // Chapters (and their lock state) are loaded by the player screen from `books.getChapters`.
  const onPress = () => router.push({ pathname: '/audiobook/[id]', params: { id: String(book.id) } })

  return (
    <Pressable onPress={onPress} className="mb-3 flex-row items-center rounded-xl bg-white dark:bg-surface-800 p-3">
      <View className="h-14 w-14 overflow-hidden rounded-lg bg-surface-200 dark:bg-surface-700">
        {cover ? (
          <Image source={{ uri: cover }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Text className="text-2xl" style={headerTextStyle}>🎵</Text>
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
      <Ionicons name={isCurrent && isPlaying ? 'pause-circle' : 'play-circle'} size={34} color="#2563eb" />
    </Pressable>
  )
}

export default function AudioScreen() {
  const { t } = useI18n()
  const { items, loading, refreshing, refresh, loadMore } = useBooks({ has_audio: true, sort: 'latest' })

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: t('nav.music') }} />
      {loading && items.length === 0 ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <AudioRow book={item} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.5}
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          ListEmptyComponent={<EmptyState icon="🎵" title={t('music.noMusic')} />}
        />
      )}
    </Screen>
  )
}
