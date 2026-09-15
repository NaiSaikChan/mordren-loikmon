import { ScrollView, View, Text, Pressable, Image, RefreshControl } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { Book } from '@loikmon/api'
import { Screen } from '@/components/Screen'
import { SectionHeader } from '@/components/SectionHeader'
import { BookCard } from '@/components/BookCard'
import { ArticleCard } from '@/components/ArticleCard'
import { AuthorCard } from '@/components/AuthorCard'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useHome } from '@/hooks/useHome'
import { useI18n } from '@/context/I18nContext'
import { useAuth } from '@/context/AuthContext'
import { useTypography } from '@/context/TypographyContext'
import { pickCover } from '@/lib/url'

function AudioBookCard({ book }: { book: Book }) {
  const { bodyTextStyle } = useTypography()
  const cover = pickCover(book)

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/audiobook/[id]', params: { id: String(book.id) } })}
      className="mr-3 w-36"
      accessibilityRole="button"
      accessibilityLabel={book.title}
    >
      <View className="aspect-[3/4] overflow-hidden rounded-xl bg-surface-200 dark:bg-surface-800">
        {cover ? (
          <Image source={{ uri: cover }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Text className="text-4xl">🎧</Text>
          </View>
        )}
        <View className="absolute inset-0 items-center justify-center bg-black/20">
          <Ionicons name="headset" size={30} color="#ffffff" />
        </View>
      </View>
      <Text numberOfLines={1} className="mt-2 text-xs font-medium text-surface-900 dark:text-surface-50" style={bodyTextStyle}>
        {book.title}
      </Text>
      {book.authorname ? (
        <Text numberOfLines={1} className="text-[10px] text-surface-400" style={bodyTextStyle}>
          {book.authorname}
        </Text>
      ) : null}
    </Pressable>
  )
}

/** Subscription status chip: "Premium" when active, otherwise a link to the paywall. */
function PremiumChip() {
  const { t } = useI18n()
  const { entitlement } = useAuth()
  const { bodyTextStyle } = useTypography()
  const active = Boolean(entitlement?.active)

  return (
    <Pressable
      onPress={() => router.push('/subscribe')}
      className={`flex-row items-center rounded-full px-3 py-1.5 ${
        active ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-brand-50 dark:bg-brand-900/30'
      }`}
      accessibilityRole="button"
    >
      <Ionicons name={active ? 'star' : 'diamond-outline'} size={15} color={active ? '#d97706' : '#2563eb'} />
      <Text
        className={`ml-1 text-sm ${active ? 'text-amber-700 dark:text-amber-300' : 'text-brand-600 dark:text-brand-300'}`}
        style={bodyTextStyle}
      >
        {active ? t('home.premiumActive') : t('home.goPremium')}
      </Text>
    </Pressable>
  )
}

export default function HomeScreen() {
  const { t } = useI18n()
  const { user, isLoggedIn } = useAuth()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const home = useHome()

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 12 }}
        nestedScrollEnabled
        refreshControl={<RefreshControl refreshing={home.refreshing} onRefresh={home.refresh} />}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pb-1">
          <View className="flex-1 pr-2">
            <Text className="text-xl text-surface-500 dark:text-surface-400 pt-safe" style={headerTextStyle}>
              {t('home.greeting')}
            </Text>
            <Text numberOfLines={1} className="text-2xl text-surface-900 dark:text-surface-50" style={bodyTextStyle}>
              {isLoggedIn ? (user?.name ?? 'Loikmon') : 'Loikmon'}
            </Text>
          </View>
          <View className="flex-row items-center gap-3 pt-safe">
            {isLoggedIn ? (
              <PremiumChip />
            ) : (
              <Pressable
                onPress={() => router.push('/(auth)/login')}
                className="items-center justify-center rounded-full bg-brand-600 px-5 py-2"
              >
                <Text className="text-sm font-normal text-white pt-1" style={bodyTextStyle}>
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
          <Text numberOfLines={1} className="ml-2 flex-1 text-base text-surface-400" style={bodyTextStyle}>
            {t('search.placeholder')}
          </Text>
        </Pressable>

        {home.loading ? (
          <LoadingSpinner />
        ) : (
          <>
            {/* Latest books */}
            <SectionHeader title={t('home.latestBooks')} actionLabel={t('home.seeAll')} onAction={() => router.push('/books')} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingLeft: 16, paddingRight: 4, alignItems: 'flex-start' }}
            >
              {home.latestBooks.map((item) => (
                <BookCard key={String(item.id)} book={item} />
              ))}
            </ScrollView>

            {/* Audiobooks */}
            {home.audioBooks.length > 0 ? (
              <>
                <SectionHeader title={t('home.audiobooks')} actionLabel={t('home.seeAll')} onAction={() => router.push('/audio')} />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingLeft: 16, paddingRight: 4, alignItems: 'flex-start' }}
                >
                  {home.audioBooks.slice(0, 10).map((book) => (
                    <AudioBookCard key={String(book.id)} book={book} />
                  ))}
                </ScrollView>
              </>
            ) : null}

            {/* Latest articles */}
            <SectionHeader title={t('home.latestArticles')} actionLabel={t('home.seeAll')} onAction={() => router.push('/articles')} />
            <View className="px-4">
              {home.articles.slice(0, 4).map((article) => (
                <ArticleCard key={String(article.id)} article={article} />
              ))}
            </View>

            {/* Popular authors */}
            <SectionHeader title={t('home.popularAuthors')} actionLabel={t('home.seeAll')} onAction={() => router.push('/authors')} />
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
