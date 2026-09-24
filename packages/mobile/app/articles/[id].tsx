import { useCallback, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import { Stack, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useReducedMotion } from 'react-native-reanimated'
import { Screen } from '@/components/Screen'
import { ListSkeleton, Skeleton } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { PrimaryButton } from '@/components/PrimaryButton'
import { PaywallCard } from '@/components/PaywallCard'
import { PriceBadge } from '@/components/PriceBadge'
import { ReviewsSection } from '@/components/Reviews'
import { useArticleDetail } from '@/hooks/useArticles'
import { useReviews } from '@/hooks/useReviews'
import { useAuth } from '@/context/AuthContext'
// Controls only: position ticks (several per second) must not re-render the article body.
import { useAudioControls } from '@/context/AudioContext'
import { useLibrary } from '@/context/LibraryContext'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
import { accessAction } from '@/lib/access'
import { articleToTrack } from '@/lib/audio'
import { firstParam, stripHtml } from '@/lib/normalize'
import { pickImage } from '@/lib/url'
import { useThemeColors } from '@/theme/colors'

export default function ArticleDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>()
  const articleId = firstParam(params.id)
  const { t } = useI18n()
  const { article, loading, error } = useArticleDetail(articleId)
  const reviews = useReviews('article', articleId)
  const { isLoggedIn } = useAuth()
  const { play, toggle, current, isPlaying } = useAudioControls()
  const { isBookmarked, toggleArticle } = useLibrary()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const colors = useThemeColors()
  const reduceMotion = useReducedMotion()
  const { width } = useWindowDimensions()
  const [activeTab, setActiveTab] = useState<'content' | 'reviews'>('content')

  const isTablet = width >= 768
  const contentMaxWidth = isTablet ? 1080 : undefined
  const bannerHeight = isTablet ? 300 : 224
  const bookmarked = article ? isBookmarked('article', article.id) : false

  const onToggleBookmark = useCallback(() => {
    if (article) toggleArticle(article)
  }, [article, toggleArticle])

  const headerRight = useCallback(
    () => (
      <Pressable
        onPress={onToggleBookmark}
        style={styles.headerButton}
        className="active:opacity-70"
        accessibilityRole="togglebutton"
        accessibilityLabel={bookmarked ? t('a11y.removeBookmark') : t('a11y.addBookmark')}
        accessibilityState={{ checked: bookmarked }}
      >
        <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={22} color={colors.brand} />
      </Pressable>
    ),
    [onToggleBookmark, bookmarked, colors.brand, t],
  )

  if (loading) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title: '' }} />
        <View style={styles.loading}>
          <Skeleton height={bannerHeight} radius={24} />
          <Skeleton height={24} width="80%" style={styles.loadingLine} />
        </View>
        <ListSkeleton rows={2} />
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

  const thumb = pickImage(article, Math.min(width, contentMaxWidth ?? width))
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
      <Stack.Screen options={{ title: '', headerRight }} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={[styles.scroll, { maxWidth: contentMaxWidth }]}>
          <View className={`${isTablet ? 'px-6 pt-6' : 'px-4 pt-4'}`}>
            <View
              className={`overflow-hidden rounded-3xl bg-surface-200 dark:bg-surface-800 ${isTablet ? 'mb-6' : 'mb-4'}`}
              style={{ height: bannerHeight }}
            >
              {thumb ? (
                <Image
                  source={thumb}
                  style={styles.fill}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={reduceMotion ? 0 : 200}
                  accessible={false}
                />
              ) : (
                <View className="h-full w-full items-center justify-center">
                  <Text className="text-5xl">📰</Text>
                </View>
              )}
            </View>

            <View className="pb-4">
              <Text className="text-2xl text-surface-900 dark:text-surface-50" style={headerTextStyle} accessibilityRole="header">
                {article.title}
              </Text>
              <View className="mt-3 flex-row flex-wrap items-center justify-start gap-2">
                {article.authorname ? (
                  <View className="items-center justify-center rounded-full bg-blue-100 px-3 py-0.5 dark:bg-blue-900">
                    <Text className="text-xs font-medium text-blue-700 dark:text-blue-200" style={bodyTextStyle}>
                      {t('common.by')} {article.authorname}
                    </Text>
                  </View>
                ) : null}
                {category ? (
                  <View className="items-center justify-center rounded-full bg-purple-100 px-3 py-0.5 dark:bg-purple-900">
                    <Text className="text-xs font-medium text-purple-700 dark:text-purple-200" style={bodyTextStyle}>
                      {category}
                    </Text>
                  </View>
                ) : null}
                {dateValue ? (
                  <View className="items-center justify-center rounded-full bg-orange-100 px-3 py-0.5 dark:bg-orange-900">
                    <Text className="text-xs font-medium text-orange-700 dark:text-orange-200" style={bodyTextStyle}>
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
                    accessibilityLabel={isCurrentTrack && isPlaying ? t('a11y.pause') : t('articles.listen')}
                    onPress={onListen}
                    labelStyle={headerTextStyle}
                  />
                </View>
              ) : null}
            </View>

            <View className="flex-row rounded-card bg-surface-200 p-1 dark:bg-surface-800" accessibilityRole="tablist">
              {([
                { id: 'content' as const, label: t('articles.content') },
                { id: 'reviews' as const, label: t('books.reviewsTab', { count: reviews.count }) },
              ] as const).map((tab) => {
                const selected = activeTab === tab.id
                return (
                  <Pressable
                    key={tab.id}
                    onPress={() => setActiveTab(tab.id)}
                    className={`min-h-touch flex-1 justify-center rounded-control px-4 ${selected ? 'bg-white dark:bg-surface-700' : ''}`}
                    accessibilityRole="tab"
                    accessibilityLabel={tab.label}
                    accessibilityState={{ selected }}
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
                  <View className="mb-5 rounded-control border border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-900">
                    <Text className="mb-2 text-base font-semibold text-surface-900 dark:text-surface-50" style={headerTextStyle} accessibilityRole="header">
                      {t('articles.preview')}
                    </Text>
                    <Text className="text-base text-surface-700 dark:text-surface-200" style={bodyTextStyle}>
                      {excerpt}
                    </Text>
                  </View>
                ) : null}
              </PaywallCard>
            ) : (
              <View className="rounded-card bg-white p-5 dark:bg-surface-800">
                <Text className="mb-3 text-lg text-surface-900 dark:text-surface-50" style={headerTextStyle} accessibilityRole="header">
                  {t('articles.content')}
                </Text>
                <Text className="text-base text-surface-700 dark:text-surface-200" style={bodyTextStyle}>
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  scroll: { paddingBottom: 32, width: '100%', alignSelf: 'center' },
  loading: { padding: 16 },
  loadingLine: { marginTop: 16 },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
})
