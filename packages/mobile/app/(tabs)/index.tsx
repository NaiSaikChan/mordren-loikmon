import { memo, useCallback } from 'react'
import { ScrollView, View, Text, Pressable, RefreshControl } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useReducedMotion } from 'react-native-reanimated'
import type { Book } from '@loikmon/api'
import { Screen } from '@/components/Screen'
import { SectionHeader } from '@/components/SectionHeader'
import { BookCard, CARD_MAX_FONT_SCALE } from '@/components/BookCard'
import { ArticleCard } from '@/components/ArticleCard'
import { AuthorCard } from '@/components/AuthorCard'
import { ListSkeleton, Skeleton } from '@/components/Skeleton'
import { useHome } from '@/hooks/useHome'
import { useI18n } from '@/context/I18nContext'
import { useAuth } from '@/context/AuthContext'
import { useTypography } from '@/context/TypographyContext'
import { pickImage } from '@/lib/url'
import { useThemeColors } from '@/theme/colors'

const AUDIO_CARD_WIDTH = 144
const AUDIO_CARD_STYLE = { width: AUDIO_CARD_WIDTH, marginRight: 12 } as const
const CAROUSEL_CONTENT = { paddingLeft: 16, paddingRight: 4, alignItems: 'stretch' } as const
const SCROLL_CONTENT = { paddingBottom: 12 } as const

const goSettings = () => router.push('/settings')
const goLogin = () => router.push('/(auth)/login')
const goSearch = () => router.push('/search')
const goSubscribe = () => router.push('/subscribe')
const goBooks = () => router.push('/books')
const goAudio = () => router.push('/audio')
const goArticles = () => router.push('/articles')
const goAuthors = () => router.push('/authors')

const AudioBookCard = memo(function AudioBookCard({ book }: { book: Book }) {
  const { bodyTextStyle } = useTypography()
  const colors = useThemeColors()
  const reduceMotion = useReducedMotion()
  const cover = pickImage(book, AUDIO_CARD_WIDTH)
  const id = book.id
  const onPress = useCallback(
    () => router.push({ pathname: '/audiobook/[id]', params: { id: String(id) } }),
    [id],
  )

  return (
    <Pressable
      onPress={onPress}
      style={AUDIO_CARD_STYLE}
      className="active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel={[book.title, book.authorname].filter(Boolean).join(', ')}
    >
      <View className="aspect-[3/4] overflow-hidden rounded-control bg-surface-200 dark:bg-surface-800">
        {cover ? (
          <Image
            source={cover}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={String(id)}
            transition={reduceMotion ? 0 : 150}
            accessible={false}
          />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Text className="text-4xl">🎧</Text>
          </View>
        )}
        <View className="absolute inset-0 items-center justify-center bg-black/20">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-audio-500/90">
            <Ionicons name="headset" size={24} color={colors.onImage} />
          </View>
        </View>
      </View>
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={CARD_MAX_FONT_SCALE}
        className="mt-2 text-xs font-medium text-surface-900 dark:text-surface-50"
        style={bodyTextStyle}
      >
        {book.title}
      </Text>
      {book.authorname ? (
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={CARD_MAX_FONT_SCALE}
          className="text-2xs text-surface-500 dark:text-surface-400"
          style={bodyTextStyle}
        >
          {book.authorname}
        </Text>
      ) : null}
    </Pressable>
  )
})

/** Subscription status chip: "Premium" when active, otherwise a link to the paywall. */
function PremiumChip() {
  const { t } = useI18n()
  const { entitlement } = useAuth()
  const { bodyTextStyle } = useTypography()
  const colors = useThemeColors()
  const active = Boolean(entitlement?.active)
  const label = active ? t('home.premiumActive') : t('home.goPremium')

  return (
    <Pressable
      onPress={goSubscribe}
      disabled
      className={`min-h-touch flex-row items-center rounded-full px-3 active:opacity-70 ${
        active ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-brand-50 dark:bg-brand-900/30'
      }`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: true }}
    >
      <Ionicons name={active ? 'star' : 'diamond-outline'} size={15} color={active ? colors.premium : colors.brand} />
      <Text
        className={`ml-1 text-sm ${active ? 'text-amber-700 dark:text-amber-300' : 'text-brand-600 dark:text-brand-300'}`}
        style={bodyTextStyle}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function HomeSkeleton() {
  return (
    <View>
      <View className="mt-5 px-4">
        <Skeleton height={20} width={160} />
      </View>
      <View className="mt-3 flex-row px-4">
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ width: 132, marginRight: 12 }}>
            <Skeleton height={176} />
            <Skeleton height={12} width="80%" style={{ marginTop: 10 }} />
          </View>
        ))}
      </View>
      <ListSkeleton rows={3} />
    </View>
  )
}

export default function HomeScreen() {
  const { t } = useI18n()
  const { user, isLoggedIn } = useAuth()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const colors = useThemeColors()
  const home = useHome()
  const { refresh } = home
  const onRefresh = useCallback(() => void refresh(), [refresh])

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={SCROLL_CONTENT}
        nestedScrollEnabled
        refreshControl={
          <RefreshControl
            refreshing={home.refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brandSolid]}
          />
        }
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pb-1 pt-3">
          <View className="flex-1 pr-2">
            <Text className="text-xl text-surface-500 dark:text-surface-400" style={headerTextStyle}>
              {t('home.greeting')}
            </Text>
            <Text
              numberOfLines={1}
              className="text-2xl text-surface-900 dark:text-surface-50"
              style={bodyTextStyle}
              accessibilityRole="header"
            >
              {isLoggedIn ? (user?.name ?? 'Loikmon') : 'Loikmon'}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            {!isLoggedIn && (
              <Pressable
                onPress={goLogin}
                className="min-h-touch items-center justify-center rounded-full bg-brand-600 px-5 active:opacity-80"
                accessibilityRole="button"
                accessibilityLabel={t('auth.login')}
              >
                <Text className="text-sm font-normal text-white" style={bodyTextStyle}>
                  {t('auth.login')}
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={goSettings}
              className="min-h-touch min-w-touch items-center justify-center rounded-full active:opacity-60"
              accessibilityRole="button"
              accessibilityLabel={t('nav.settings')}
            >
              <Ionicons name="settings-outline" size={24} color={colors.mutedText} />
            </Pressable>
          </View>
        </View>

        {/* Search */}
        <Pressable
          onPress={goSearch}
          className="mx-4 mt-3 min-h-[48px] flex-row items-center rounded-control bg-white px-3 active:opacity-80 dark:bg-surface-800"
          accessibilityRole="button"
          accessibilityLabel={t('search.placeholder')}
        >
          <Ionicons name="search" size={18} color={colors.placeholder} />
          <Text numberOfLines={1} className="ml-2 flex-1 text-base text-surface-500 dark:text-surface-400" style={bodyTextStyle}>
            {t('search.placeholder')}
          </Text>
        </Pressable>

        {home.loading ? (
          <HomeSkeleton />
        ) : (
          <>
            {/* Latest books */}
            <SectionHeader title={t('home.latestBooks')} actionLabel={t('home.seeAll')} onAction={goBooks} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={CAROUSEL_CONTENT}>
              {home.latestBooks.map((item) => (
                <BookCard key={String(item.id)} book={item} />
              ))}
            </ScrollView>

            {/* Audiobooks */}
            {home.audioBooks.length > 0 ? (
              <>
                <SectionHeader title={t('home.audiobooks')} actionLabel={t('home.seeAll')} onAction={goAudio} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={CAROUSEL_CONTENT}>
                  {home.audioBooks.slice(0, 10).map((book) => (
                    <AudioBookCard key={String(book.id)} book={book} />
                  ))}
                </ScrollView>
              </>
            ) : null}

            {/* Latest articles */}
            <SectionHeader title={t('home.latestArticles')} actionLabel={t('home.seeAll')} onAction={goArticles} />
            <View className="px-4">
              {home.articles.slice(0, 4).map((article) => (
                <ArticleCard key={String(article.id)} article={article} />
              ))}
            </View>

            {/* Popular authors */}
            <SectionHeader title={t('home.popularAuthors')} actionLabel={t('home.seeAll')} onAction={goAuthors} />
            <View className="px-4">
              {home.authors.slice(0, 4).map((author) => (
                <AuthorCard key={String(author.id)} author={author} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  )
}
