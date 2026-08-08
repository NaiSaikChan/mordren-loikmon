import { ScrollView, View, Text, Pressable, Image } from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { SectionHeader } from '@/components/SectionHeader'
import { BookCard } from '@/components/BookCard'
import { ArticleCard } from '@/components/ArticleCard'
import { AuthorCard } from '@/components/AuthorCard'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { SearchBar } from '@/components/SearchBar'
import { useBooks } from '@/hooks/useBooks'
import { useArticles } from '@/hooks/useArticles'
import { useAuthors } from '@/hooks/useAuthors'
import { useI18n } from '@/context/I18nContext'
import { useAuth } from '@/context/AuthContext'
import { useTypography } from '@/context/TypographyContext'
import { useAudio } from '@/context/AudioContext'
import { useBookAudioChapters } from '@/hooks/useBookAudioChapters'
import type { AudioTrack } from '@/lib/audio'

function AudioBookCard({ track }: { track: AudioTrack }) {
  const { play, current, isPlaying, toggle } = useAudio()
  const isCurrent = current && current.url === track.url

  return (
    <Pressable
      onPress={() => {
        if (isCurrent) {
          void toggle()
        } else {
          void play(track)
        }
      }}
      className="mr-3 w-36"
    >
      <View className="aspect-[3/4] overflow-hidden rounded-xl bg-surface-200 dark:bg-surface-800">
        {track.cover ? (
          <Image source={{ uri: track.cover }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Text className="text-4xl">🎧</Text>
          </View>
        )}
        <View className="absolute inset-0 items-center justify-center bg-black/20">
          <Ionicons
            name={isCurrent && isPlaying ? 'pause' : 'play'}
            size={32}
            color="#ffffff"
          />
        </View>
      </View>
      <Text
        numberOfLines={1}
        className="mt-2 text-xs font-medium text-surface-900 dark:text-surface-50"
      >
        {track.title}
      </Text>
      {track.artist ? (
        <Text numberOfLines={1} className="text-[10px] text-surface-400">
          {track.artist}
        </Text>
      ) : null}
    </Pressable>
  )
}

export default function HomeScreen() {
  const { t } = useI18n()
  const { user, isLoggedIn } = useAuth()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const books = useBooks()
  const articles = useArticles()
  const authors = useAuthors()
  const { tracks: featuredAudioTracks } = useBookAudioChapters(undefined, t('home.audiobooks'))
  const [searchText, setSearchText] = useState('')

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 12 }}
        nestedScrollEnabled
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pb-1">
          <View>
            <Text className="text-xl text-surface-500 dark:text-surface-400 pt-safe" style={headerTextStyle}>
              {t('home.greeting')}
            </Text>
            <Text className="text-2xl font-bold text-surface-900 dark:text-surface-50" style={headerTextStyle}>
              {isLoggedIn ? (user?.name ?? 'Loikmon') : 'Loikmon'}
            </Text>
          </View>
          <View className="flex-row items-center gap-3 pt-safe">
            {isLoggedIn ? (
              <Pressable
                onPress={() => router.push('/purchases')}
                className="flex-row items-center rounded-full bg-brand-50 dark:bg-brand-900/30 px-3 py-1.5"
              >
                <Ionicons name="server-outline" size={16} color="#2563eb" />
                <Text className="ml-1 text-sm text-brand-600 dark:text-brand-300">
                  {Number(user?.coins ?? 0)}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push('/(auth)/login')}
                className="items-center justify-center rounded-full bg-brand-600 px-5 py-2"
              >
                <Text
                  className="text-sm font-normal text-white pt-1"
                  style={bodyTextStyle}
                >
                  {t('auth.login')}
                </Text>
              </Pressable>
            )}
            <Pressable onPress={() => router.push('/settings')} hitSlop={8}>
              <Ionicons name="settings-outline" size={24} color="#94a3b8" />
            </Pressable>
          </View>
        </View>

        {/* Search */}
        <Pressable
          onPress={() => router.push('/search')}
          className="mx-4 mt-3 flex-row items-center rounded-xl bg-white dark:bg-surface-800 px-3 py-2.5"
        >
          <Ionicons name="search" size={18} color="#94a3b8" />
          <Text
            numberOfLines={1}
            className="ml-2 flex-1 text-base text-surface-400"
            style={bodyTextStyle}
          >
            {t('search.placeholder')}
          </Text>
        </Pressable>

        {/* Latest books */}
        <SectionHeader
          title={t('home.latestBooks')}
          actionLabel={t('home.seeAll')}
          onAction={() => router.push('/books')}
        />
        {books.loading ? (
          <LoadingSpinner />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: 16, paddingRight: 4, alignItems: 'flex-start' }}
          >
            {books.items.slice(0, 12).map((item) => (
              <BookCard key={String(item.id)} book={item} />
            ))}
          </ScrollView>
        )}

        {/* Featured audiobooks */}
        {featuredAudioTracks.length > 0 ? (
          <SectionHeader title={t('home.audiobooks')} />
        ) : null}
        {featuredAudioTracks.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: 16, paddingRight: 4, alignItems: 'flex-start' }}
          >
            {featuredAudioTracks.slice(0, 10).map((track) => (
              <AudioBookCard key={String(track.id)} track={track} />
            ))}
          </ScrollView>
        ) : null}

        {/* Latest articles */}
        <SectionHeader
          title={t('home.latestArticles')}
          actionLabel={t('home.seeAll')}
          onAction={() => router.push('/articles')}
        />
        <View className="px-4">
          {articles.items.slice(0, 4).map((article) => (
            <ArticleCard key={String(article.id)} article={article} />
          ))}
        </View>

        {/* Popular authors */}
        <SectionHeader
          title={t('home.popularAuthors')}
          actionLabel={t('home.seeAll')}
          onAction={() => router.push('/authors')}
        />
        <View className="px-4">
          {authors.items.slice(0, 4).map((author) => (
            <AuthorCard key={String(author.id)} author={author} />
          ))}
        </View>
      </ScrollView>
    </Screen>
  )
}
