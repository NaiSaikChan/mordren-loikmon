import { useState } from 'react'
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { PrimaryButton } from '@/components/PrimaryButton'
import { PaywallCard } from '@/components/PaywallCard'
import { PriceBadge } from '@/components/PriceBadge'
import { ReviewsSection } from '@/components/Reviews'
import { useArticleDetail } from '@/hooks/useArticles'
import { useReviews } from '@/hooks/useReviews'
import { useAuth } from '@/context/AuthContext'
import { useAudio } from '@/context/AudioContext'
import { useLibrary } from '@/context/LibraryContext'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
import { accessAction } from '@/lib/access'
import { articleToTrack } from '@/lib/audio'
import { firstParam, stripHtml } from '@/lib/normalize'
import { fixUrl } from '@/lib/url'

export default function ArticleDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>()
  const articleId = firstParam(params.id)
  const { t } = useI18n()
  const { article, loading, error } = useArticleDetail(articleId)
  const reviews = useReviews('article', articleId)
  const { isLoggedIn } = useAuth()
  const { play, toggle, current, isPlaying } = useAudio()
  const { isBookmarked, toggleArticle } = useLibrary()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const { width } = useWindowDimensions()
  const [activeTab, setActiveTab] = useState<'content' | 'reviews'>('content')

  const isTablet = width >= 768
  const contentMaxWidth = isTablet ? 1080 : undefined
  const bannerHeight = isTablet ? 300 : 224

  if (loading) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title: '' }} />
        <LoadingSpinner />
      </Screen>
    )
  }

  if (error || !article) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title: '' }} />
        <EmptyState icon="⚠️" title={t('common.error')} subtitle={error ?? t('articles.noArticles')} />
      </Screen>
    )
  }

  const thumb = fixUrl(article.thumbnail_url || article.thumbnail)
  const bookmarked = isBookmarked('article', article.id)
  const category = article.categoryname ?? ''
  const dateValue = article.articledate ?? article.published_at ?? article.date
  // Body and audio are only present when the server granted access.
  const action = article.locked ? accessAction(article.access, isLoggedIn) : 'open'
  const excerpt = stripHtml(article.excerpt || article.description)
  const body = stripHtml(article.content)
  const track = articleToTrack(article)
  const isCurrentTrack = Boolean(track && current?.url === track.url)

  const onListen = () => {
    if (!track) return
    if (isCurrentTrack) void toggle()
    else void play(track, [track])
  }

  return (
    <Screen edges={[]}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Pressable onPress={() => toggleArticle(article)} hitSlop={8}>
              <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={22} color="#2563eb" />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ paddingBottom: 32, width: '100%', alignSelf: 'center', maxWidth: contentMaxWidth }}>
          <View className={`${isTablet ? 'px-6 pt-6' : 'px-4 pt-4'}`}>
            <View
              className={`overflow-hidden rounded-3xl bg-surface-200 dark:bg-surface-800 shadow-sm ${isTablet ? 'mb-6' : 'mb-4'}`}
              style={{ height: bannerHeight }}
            >
              {thumb ? (
                <Image source={{ uri: thumb }} className="h-full w-full" resizeMode="cover" />
              ) : (
                <View className="h-full w-full items-center justify-center">
                  <Text className="text-5xl">📰</Text>
                </View>
              )}
            </View>

            <View className="pb-4">
              <Text className="text-2xl text-surface-900 dark:text-surface-50" style={headerTextStyle}>
                {article.title}
              </Text>
              <View className="mt-3 flex-row flex-wrap items-center justify-start gap-3">
                {article.authorname ? (
                  <View className="rounded-full bg-blue-100 dark:bg-blue-900 px-3 py-1 items-center justify-center">
                    <Text className="text-xs font-medium text-blue-700 dark:text-blue-200 pt-1" style={bodyTextStyle}>
                      {t('common.by')} {article.authorname}
                    </Text>
                  </View>
                ) : null}
                {category ? (
                  <View className="rounded-full bg-purple-100 dark:bg-purple-900 px-3 py-1 items-center justify-center">
                    <Text className="text-xs font-medium text-purple-700 dark:text-purple-200 pt-1" style={bodyTextStyle}>
                      {category}
                    </Text>
                  </View>
                ) : null}
                {dateValue ? (
                  <View className="rounded-full bg-orange-100 dark:bg-orange-900 px-3 py-1 items-center justify-center">
                    <Text className="text-xs font-medium text-orange-700 dark:text-orange-200 pt-1" style={bodyTextStyle}>
                      {new Date(dateValue).toLocaleDateString()}
                    </Text>
                  </View>
                ) : null}
                <PriceBadge item={article} />
              </View>
              {track ? (
                <View className="mt-4">
                  <PrimaryButton
                    label={`${isCurrentTrack && isPlaying ? '⏸' : '🎧'} ${t('articles.listen')}`}
                    onPress={onListen}
                    labelStyle={headerTextStyle}
                  />
                </View>
              ) : null}
            </View>

            <View className="flex-row rounded-2xl bg-surface-200 dark:bg-surface-800 p-1">
              {([
                { id: 'content' as const, label: t('articles.content') },
                { id: 'reviews' as const, label: t('books.reviewsTab', { count: reviews.count }) },
              ] as const).map((tab) => {
                const selected = activeTab === tab.id
                return (
                  <Pressable
                    key={tab.id}
                    onPress={() => setActiveTab(tab.id)}
                    className={`flex-1 rounded-xl px-4 py-2.5 ${selected ? 'bg-white dark:bg-surface-700' : ''}`}
                  >
                    <Text
                      className={`text-center text-sm font-medium ${selected ? 'text-surface-900 dark:text-surface-50' : 'text-surface-500 dark:text-surface-400'}`}
                      style={selected ? headerTextStyle : bodyTextStyle}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          <View className={`${isTablet ? 'px-6' : 'px-4'} mt-6`}>
            {activeTab === 'reviews' ? (
              <ReviewsSection reviews={reviews} itemType="article" />
            ) : action !== 'open' ? (
              <PaywallCard
                action={action}
                title={action === 'subscribe' ? t('articles.lockedTitle') : undefined}
                hint={action === 'login' ? t('articles.loginHint') : undefined}
              >
                {excerpt ? (
                  <View className="mb-5 rounded-xl border border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-900">
                    <Text className="mb-2 text-base font-semibold text-surface-900 dark:text-surface-50" style={headerTextStyle}>
                      {t('articles.preview')}
                    </Text>
                    <Text className="leading-7 text-surface-700 dark:text-surface-200" style={bodyTextStyle}>
                      {excerpt}
                    </Text>
                  </View>
                ) : null}
              </PaywallCard>
            ) : (
              <View className="rounded-2xl bg-white dark:bg-surface-800 p-5">
                <Text className="mb-3 text-lg text-surface-900 dark:text-surface-50" style={headerTextStyle}>
                  {t('articles.content')}
                </Text>
                <Text className="leading-7 text-surface-700 dark:text-surface-200" style={bodyTextStyle}>
                  {body || excerpt || t('articles.noContent')}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
