import { useCallback, useMemo, useState } from 'react'
import { FlatList, View, Text, Pressable, Linking, Platform, useWindowDimensions, type ListRenderItem } from 'react-native'
import { Image } from 'expo-image'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { useReducedMotion } from 'react-native-reanimated'
import type { Article, Book } from '@loikmon/api'
import { Screen } from '@/components/Screen'
import { ArticleCard } from '@/components/ArticleCard'
import { BookRow } from '@/components/BookRow'
import { ListSkeleton, Skeleton } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { PrimaryButton } from '@/components/PrimaryButton'
import { chunk } from '@/components/gridRows'
import { useAuthorDetail } from '@/hooks/useAuthors'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
import { useAuth } from '@/context/AuthContext'
import { pickImage } from '@/lib/url'

type AuthorTab = 'about' | 'books' | 'articles'
type Row = { kind: 'books'; key: string; books: Book[] } | { kind: 'article'; key: string; article: Article }

const AVATAR_SIZE = 112
const keyExtractor = (row: Row) => row.key

export default function AuthorDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const { t } = useI18n()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const { isLoggedIn } = useAuth()
  const { width } = useWindowDimensions()
  const reduceMotion = useReducedMotion()
  const authorId = Array.isArray(id) ? id[0] : id
  const { author, books, articles, loading, error, following, toggleFollow } = useAuthorDetail(authorId)
  const [tab, setTab] = useState<AuthorTab>('about')

  const isTablet = width >= 768
  const contentMaxWidth = isTablet ? 1080 : undefined
  const bookColumns = width >= 1100 ? 4 : width >= 560 ? 3 : 2
  const gutter = isTablet ? 24 : 16
  const imageWidth = Math.round((Math.min(width, contentMaxWidth ?? width) - gutter * 2) / bookColumns - 12)

  const stats = useMemo(() => {
    const booksCount = Number(author?.books_count ?? author?.bookscount ?? books.length ?? 0)
    const articlesCount = Number(author?.articles_count ?? author?.articlescount ?? articles.length ?? 0)
    const followersCount = Number(author?.followers_count ?? 0)
    return [
      { id: 'books', icon: '📚', text: `${booksCount} ${t('nav.books')}` },
      { id: 'articles', icon: '📰', text: `${articlesCount} ${t('nav.articles')}` },
      { id: 'followers', icon: '👥', text: t('authors.followers', { count: followersCount }) },
    ]
  }, [author, books.length, articles.length, t])

  const rows = useMemo<Row[]>(() => {
    if (tab === 'books') {
      return chunk(books, bookColumns).map((row) => ({ kind: 'books', key: `b-${row[0].id}`, books: row }))
    }
    if (tab === 'articles') return articles.map((article) => ({ kind: 'article', key: `a-${article.id}`, article }))
    return []
  }, [tab, books, articles, bookColumns])

  const renderItem = useCallback<ListRenderItem<Row>>(
    ({ item }) => (
      <View style={{ paddingHorizontal: gutter }}>
        {item.kind === 'books' ? (
          <View className="mb-3">
            <BookRow books={item.books} columns={bookColumns} imageWidth={imageWidth} gap={12} />
          </View>
        ) : (
          <ArticleCard article={item.article} />
        )}
      </View>
    ),
    [gutter, bookColumns, imageWidth],
  )

  if (loading) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title: '' }} />
        <View className="p-4">
          <Skeleton height={220} radius={24} />
        </View>
        <ListSkeleton rows={3} />
      </Screen>
    )
  }

  if (error || !author) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title: '' }} />
        <EmptyState icon="⚠️" title={t('common.error')} subtitle={error ?? t('common.notFound')} />
      </Screen>
    )
  }

  const avatar = pickImage(author, AVATAR_SIZE)
  const socials = [
    { id: 'website', label: author.website ?? '', value: author.website },
    { id: 'facebook', label: t('authors.socialFacebook'), value: author.facebook },
    { id: 'instagram', label: t('authors.socialInstagram'), value: author.instagram },
    { id: 'youtube', label: t('authors.socialYouTube'), value: author.youtube },
  ].filter((item) => item.value)

  const isFollowing = Boolean(author.is_following)
  const followLabel = isFollowing ? t('authors.unfollow') : t('authors.follow')

  const onToggleFollow = async () => {
    if (!isLoggedIn) {
      router.push('/(auth)/login')
      return
    }
    await toggleFollow().catch(() => undefined)
  }

  const tabs: { id: AuthorTab; label: string }[] = [
    { id: 'about', label: t('books.description') },
    { id: 'books', label: `${t('nav.books')} (${books.length})` },
    { id: 'articles', label: `${t('nav.articles')} (${articles.length})` },
  ]

  const header = (
    <View>
      <View style={{ paddingHorizontal: gutter, paddingTop: gutter }}>
        <View className="overflow-hidden rounded-3xl bg-white dark:bg-surface-800">
          <View className="h-28 bg-brand-500 dark:bg-brand-700" />
          <View className={`-mt-16 px-5 pb-5 ${isTablet ? 'flex-row items-end gap-6' : ''}`}>
            <View className="h-28 w-28 overflow-hidden rounded-2xl border-4 border-white bg-surface-200 dark:border-surface-900 dark:bg-surface-700">
              {avatar ? (
                <Image
                  source={avatar}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={reduceMotion ? 0 : 150}
                  accessibilityLabel={String(author.name)}
                />
              ) : (
                <View className="h-full w-full items-center justify-center">
                  <Text className="text-4xl" style={headerTextStyle}>{String(author.name?.[0] ?? '👤')}</Text>
                </View>
              )}
            </View>

            <View className={`flex-1 ${isTablet ? 'mt-0' : 'mt-4'}`}>
              <Text className="text-2xl text-surface-900 dark:text-surface-50" style={headerTextStyle} accessibilityRole="header">
                {author.name}
              </Text>
              <View className="mt-3 flex-row flex-wrap gap-4">
                {stats.map((stat) => (
                  <View key={stat.id} className="flex-row items-center gap-2" accessible accessibilityLabel={stat.text}>
                    <Text className="text-base" style={bodyTextStyle}>{stat.icon}</Text>
                    <Text className="text-sm font-semibold text-surface-700 dark:text-surface-200" style={bodyTextStyle}>
                      {stat.text}
                    </Text>
                  </View>
                ))}
              </View>
              <View className="mt-4 items-start">
                <PrimaryButton
                  label={following ? `${followLabel}…` : followLabel}
                  loading={following}
                  onPress={onToggleFollow}
                  labelStyle={headerTextStyle}
                  accessibilityState={{ selected: isFollowing }}
                />
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: gutter }} className="mt-5">
        <View className="flex-row rounded-card bg-surface-200 p-1 dark:bg-surface-800" accessibilityRole="tablist">
          {tabs.map((item) => {
            const selected = tab === item.id
            return (
              <Pressable
                key={item.id}
                onPress={() => setTab(item.id)}
                className={`min-h-touch flex-1 items-center justify-center rounded-control px-2 ${selected ? 'bg-white dark:bg-surface-700' : ''}`}
                accessibilityRole="tab"
                accessibilityLabel={item.label}
                accessibilityState={{ selected }}
              >
                <Text
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.4}
                  className={`text-center text-xs ${selected ? 'text-surface-900 dark:text-surface-50' : 'text-surface-500 dark:text-surface-400'}`}
                  style={selected ? headerTextStyle : bodyTextStyle}
                >
                  {item.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>
      <View className="h-5" />
    </View>
  )

  const about = (
    <View style={{ paddingHorizontal: gutter }} className="gap-4">
      {author.bio ? (
        <View className="rounded-card bg-white p-5 dark:bg-surface-800">
          <Text className="mb-3 text-lg text-surface-900 dark:text-surface-50" style={headerTextStyle} accessibilityRole="header">
            {t('authors.biography')}
          </Text>
          <Text className="text-base text-surface-700 dark:text-surface-200" style={bodyTextStyle}>
            {String(author.bio)}
          </Text>
        </View>
      ) : null}

      {socials.length ? (
        <View className="rounded-card bg-white p-5 dark:bg-surface-800">
          <Text className="mb-3 text-lg text-surface-900 dark:text-surface-50" style={headerTextStyle} accessibilityRole="header">
            {t('authors.followLinks')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {socials.map((social) => (
              <Pressable
                key={social.id}
                onPress={() => social.value && void Linking.openURL(String(social.value))}
                className="min-h-touch justify-center rounded-control bg-surface-100 px-3 active:opacity-70 dark:bg-surface-700"
                accessibilityRole="link"
                accessibilityLabel={social.label}
              >
                <Text className="text-sm text-surface-900 dark:text-surface-50" style={bodyTextStyle}>
                  {social.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {(author.description && author.description !== author.bio) || author.joined_date || author.created_at ? (
        <View className="rounded-card bg-white p-5 dark:bg-surface-800">
          <Text className="mb-3 text-lg text-surface-900 dark:text-surface-50" style={headerTextStyle} accessibilityRole="header">
            {t('authors.additionalInfo')}
          </Text>
          {author.description && author.description !== author.bio ? (
            <Text className="mb-4 text-base text-surface-700 dark:text-surface-200" style={bodyTextStyle}>
              {String(author.description)}
            </Text>
          ) : null}
          {author.joined_date || author.created_at ? (
            <Text className="text-sm text-surface-600 dark:text-surface-300" style={bodyTextStyle}>
              {t('authors.joined')}: {new Date(String(author.joined_date ?? author.created_at)).toLocaleDateString()}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: author.name }} />
      <FlatList
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={
          tab === 'about' ? (
            about
          ) : tab === 'books' ? (
            <EmptyState icon="📚" title={t('books.noBooks')} />
          ) : (
            <EmptyState icon="📰" title={t('articles.noArticles')} />
          )
        }
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 36, width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' }}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
      />
    </Screen>
  )
}
