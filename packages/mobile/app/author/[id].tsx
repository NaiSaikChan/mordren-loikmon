import { useMemo, useState } from 'react'
import { ScrollView, View, Text, Image, Pressable, Linking, useWindowDimensions } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { Screen } from '@/components/Screen'
import { BookCard } from '@/components/BookCard'
import { ArticleCard } from '@/components/ArticleCard'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { PrimaryButton } from '@/components/PrimaryButton'
import { useAuthorDetail } from '@/hooks/useAuthors'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
import { useAuth } from '@/context/AuthContext'
import { fixUrl } from '@/lib/url'

export default function AuthorDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>()
  const { t } = useI18n()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const { user, isLoggedIn } = useAuth()
  const { width } = useWindowDimensions()
  const authorId = Array.isArray(id) ? id[0] : id
  const { author, books, articles, loading, error, following, toggleFollow } = useAuthorDetail(
    authorId,
    user?.email,
  )
  const [tab, setTab] = useState<'about' | 'books' | 'articles'>('about')

  const isTablet = width >= 768
  const contentMaxWidth = isTablet ? 1080 : undefined
  const bookColumns = width >= 1100 ? 4 : width >= 768 ? 3 : width >= 560 ? 3 : 2

  const stats = useMemo(() => {
    const booksCount = Number(author?.books_count ?? author?.bookscount ?? books.length ?? 0)
    const articlesCount = Number(author?.articles_count ?? author?.articlescount ?? articles.length ?? 0)
    const followersCount = Number(author?.followers_count ?? 0)
    return [
      {
        id: 'books',
        icon: '📚',
        text: `${booksCount} ${t('nav.books')}`,
      },
      {
        id: 'articles',
        icon: '📰',
        text: `${articlesCount} ${t('nav.articles')}`,
      },
      {
        id: 'followers',
        icon: '👥',
        text: t('authors.followers', { count: followersCount }),
      },
    ]
  }, [author, books.length, articles.length, t])

  if (loading) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title: '' }} />
        <LoadingSpinner />
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

  const avatar = fixUrl(
    (author.thumbnail as string) ?? (author.avatar_url as string) ?? (author.avatar as string) ?? '',
  )
  const socials = [
    { id: 'facebook', label: 'Facebook', value: author.facebook as string | undefined },
    { id: 'instagram', label: 'Instagram', value: author.instagram as string | undefined },
    { id: 'youtube', label: 'YouTube', value: author.youtube as string | undefined },
    { id: 'email', label: 'Email', value: author.email ? `mailto:${author.email}` : undefined },
  ].filter((item) => item.value)

  const onToggleFollow = async () => {
    if (!isLoggedIn || !user?.email) {
      router.push('/(auth)/login')
      return
    }
    await toggleFollow()
  }

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: author.name }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 36, width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' }}
      >
        <View className={`${isTablet ? 'px-6 pt-6' : 'px-4 pt-4'}`}>
          <View className="overflow-hidden rounded-3xl bg-white dark:bg-surface-800">
            <View className="h-28 bg-brand-500 dark:bg-brand-700" />
            <View className={`-mt-16 px-5 pb-5 ${isTablet ? 'flex-row items-end gap-6' : ''}`}>
              <View className="h-28 w-28 overflow-hidden rounded-2xl border-4 border-white bg-surface-200 dark:border-surface-900 dark:bg-surface-700">
                {avatar ? (
                  <Image source={{ uri: avatar }} className="h-full w-full" resizeMode="cover" />
                ) : (
                  <View className="h-full w-full items-center justify-center">
                    <Text className="text-4xl">{String(author.name?.[0] ?? '👤')}</Text>
                  </View>
                )}
              </View>

              <View className={`mt-4 flex-1 ${isTablet ? 'mt-0' : ''}`}>
                <Text className="text-2xl font-bold text-surface-900 dark:text-surface-50" style={headerTextStyle}>
                  {author.name}
                </Text>
                <View className="mt-3 flex-row flex-wrap gap-4">
                  {stats.map((stat) => (
                    <View key={stat.id} className="flex-row items-center gap-2">
                      <Text className="text-base">{stat.icon}</Text>
                      <Text className="text-sm font-semibold text-surface-700 dark:text-surface-200" style={bodyTextStyle}>
                        {stat.text}
                      </Text>
                    </View>
                  ))}
                </View>
                <View className="mt-4 items-start">
                  <PrimaryButton
                    label={
                      following
                        ? `${Boolean(author.is_following) ? t('authors.unfollow') : t('authors.follow')}...`
                        : Boolean(author.is_following)
                          ? t('authors.unfollow')
                          : t('authors.follow')
                    }
                    loading={following}
                    onPress={onToggleFollow}
                    labelStyle={headerTextStyle}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>

        <View className={`${isTablet ? 'px-6' : 'px-4'} mt-5`}>
          <View className="flex-row rounded-2xl bg-surface-200 p-1 dark:bg-surface-800">
            {[
              { id: 'about' as const, label: 'About' },
              { id: 'books' as const, label: `${t('nav.books')} (${books.length})` },
              { id: 'articles' as const, label: `${t('nav.articles')} (${articles.length})` },
            ].map((item) => {
              const selected = tab === item.id
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setTab(item.id)}
                  className={`flex-1 rounded-xl px-3 py-2.5 ${selected ? 'bg-white dark:bg-surface-700' : ''}`}
                >
                  <Text
                    numberOfLines={1}
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

        {tab === 'about' ? (
          <View className={`${isTablet ? 'px-6' : 'px-4'} mt-5 gap-4`}>
            {author.bio ? (
              <View className="rounded-2xl bg-white p-5 dark:bg-surface-800">
                <Text className="mb-3 text-lg font-bold text-surface-900 dark:text-surface-50" style={headerTextStyle}>
                  Biography
                </Text>
                <Text className="leading-7 text-surface-700 dark:text-surface-200" style={bodyTextStyle}>
                  {String(author.bio)}
                </Text>
              </View>
            ) : null}

            {socials.length ? (
              <View className="rounded-2xl bg-white p-5 dark:bg-surface-800">
                <Text className="mb-3 text-lg font-bold text-surface-900 dark:text-surface-50" style={headerTextStyle}>
                  Follow
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {socials.map((social) => (
                    <Pressable
                      key={social.id}
                      onPress={() => social.value && void Linking.openURL(String(social.value))}
                      className="rounded-lg bg-surface-100 px-3 py-2 dark:bg-surface-700"
                    >
                      <Text className="text-sm text-surface-900 dark:text-surface-50" style={bodyTextStyle}>
                        {social.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {author.description || author.created_at || author.status ? (
              <View className="rounded-2xl bg-white p-5 dark:bg-surface-800">
                <Text className="mb-3 text-lg font-bold text-surface-900 dark:text-surface-50" style={headerTextStyle}>
                  Additional Information
                </Text>
                {author.description ? (
                  <Text className="mb-4 leading-7 text-surface-700 dark:text-surface-200" style={bodyTextStyle}>
                    {String(author.description)}
                  </Text>
                ) : null}
                {author.created_at ? (
                  <Text className="text-sm text-surface-600 dark:text-surface-300" style={bodyTextStyle}>
                    Joined: {new Date(String(author.created_at)).toLocaleDateString()}
                  </Text>
                ) : null}
                {author.status ? (
                  <Text className="mt-2 text-sm text-surface-600 dark:text-surface-300" style={bodyTextStyle}>
                    Status: {String(author.status)}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {tab === 'books' ? (
          <View className={`${isTablet ? 'px-6' : 'px-4'} mt-5`}>
            {books.length ? (
              <View className="flex-row flex-wrap">
                {books.map((book) => (
                  <View
                    key={String(book.id)}
                    style={{ width: `${100 / bookColumns}%`, paddingHorizontal: 6, paddingBottom: 12 }}
                  >
                    <BookCard book={book} variant="grid" />
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState icon="📚" title={t('books.noBooks')} />
            )}
          </View>
        ) : null}

        {tab === 'articles' ? (
          <View className={`${isTablet ? 'px-6' : 'px-4'} mt-5`}>
            {articles.length ? (
              <View className="gap-3">
                {articles.map((article) => (
                  <ArticleCard key={String(article.id)} article={article} />
                ))}
              </View>
            ) : (
              <EmptyState icon="📰" title={t('articles.noArticles')} />
            )}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  )
}
