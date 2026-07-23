import { FlatList, View, Text, Image, Pressable, Alert } from 'react-native'
import { Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { Book } from '@loikmon/api'
import { Screen } from '@/components/Screen'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { useBooks } from '@/hooks/useBooks'
import { useAudio, toTrack } from '@/context/AudioContext'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
import { pickCover } from '@/lib/url'

function AudioRow({ book }: { book: Book }) {
  const { t } = useI18n()
  const { play, current, isPlaying, toggle } = useAudio()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const cover = pickCover(book as unknown as Record<string, unknown>)
  const isCurrent = current && String(current.id) === String(book.id)

  const onPress = () => {
    if (isCurrent) {
      void toggle()
      return
    }
    const track = toTrack(book as unknown as Record<string, unknown>)
    if (!track) {
      Alert.alert(t('reader.notAvailable'))
      return
    }
    void play(track)
  }

  return (
    <Pressable
      onPress={onPress}
      className="mb-3 flex-row items-center rounded-xl bg-white dark:bg-surface-800 p-3"
    >
      <View className="h-14 w-14 overflow-hidden rounded-lg bg-surface-200 dark:bg-surface-700">
        {cover ? (
          <Image source={{ uri: cover }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Text className="text-2xl">🎵</Text>
          </View>
        )}
      </View>
      <View className="ml-3 flex-1">
        <Text
          numberOfLines={1}
          className="text-sm text-surface-900 dark:text-surface-50"
          style={headerTextStyle}
        >
          {book.title}
        </Text>
        <Text numberOfLines={1} className="text-xs text-surface-400" style={bodyTextStyle}>
          {(book.authorname as string) ?? (book.author as string) ?? ''}
        </Text>
      </View>
      <Ionicons
        name={isCurrent && isPlaying ? 'pause-circle' : 'play-circle'}
        size={34}
        color="#2563eb"
      />
    </Pressable>
  )
}

export default function AudioScreen() {
  const { t } = useI18n()
  const { items, loading, refreshing, refresh, loadMore } = useBooks({ type: 'audio' })

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
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshing={refreshing}
          onRefresh={refresh}
          ListEmptyComponent={<EmptyState icon="🎵" title={t('music.noMusic')} />}
        />
      )}
    </Screen>
  )
}
