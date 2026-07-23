import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { purchases as purchasesApi, reviews as reviewsApi, type Review } from '@loikmon/api'
import { Screen } from '@/components/Screen'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { PrimaryButton } from '@/components/PrimaryButton'
import { useArticleDetail } from '@/hooks/useArticles'
import { useAuth } from '@/context/AuthContext'
import { useLibrary } from '@/context/LibraryContext'
import { useI18n } from '@/context/I18nContext'
import { usePurchases } from '@/hooks/usePurchases'
import { useTypography } from '@/context/TypographyContext'
import { fixUrl } from '@/lib/url'

/**
 * Produces a plain-text fallback from an article's HTML body.
 * Script/style blocks are removed entirely (their contents must never surface),
 * then remaining tags are stripped. The result is rendered inside a <Text>, so
 * no markup can execute — this is purely for readability.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim()
}

function getReviewList(payload: unknown): Review[] {
  if (Array.isArray(payload)) return payload as Review[]
  if (!payload || typeof payload !== 'object') return []

  const body = payload as Record<string, unknown>
  if (Array.isArray(body.reviews)) return body.reviews as Review[]
  if (Array.isArray(body.list)) return body.list as Review[]
  if (body.data) return getReviewList(body.data)

  return []
}

function getReview(payload: unknown): Review | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const review = payload as Review
  return review.id ? review : review.content || review.comment ? review : null
}

function ReviewStars({
  rating,
  onChange,
  size = 28,
}: {
  rating: number
  onChange?: (next: number) => void
  size?: number
}) {
  return (
    <View className="flex-row gap-1">
      {Array.from({ length: 5 }).map((_, index) => {
        const value = index + 1
        const filled = value <= rating
        const star = (
          <Ionicons
            name={filled ? 'star' : 'star-outline'}
            size={size}
            color={filled ? '#f59e0b' : '#cbd5e1'}
          />
        )

        if (!onChange) {
          return <View key={value}>{star}</View>
        }

        return (
          <Pressable key={value} onPress={() => onChange(value)} hitSlop={8}>
            {star}
          </Pressable>
        )
      })}
    </View>
  )
}

function ReviewCard({
  review,
  bodyTextStyle,
  headerTextStyle,
  highlighted = false,
}: {
  review: Review
  bodyTextStyle: ReturnType<typeof useTypography>['bodyTextStyle']
  headerTextStyle: ReturnType<typeof useTypography>['headerTextStyle']
  highlighted?: boolean
}) {
  const author = review.author_name ?? review.username ?? 'Anonymous'
  const content = review.content ?? review.comment ?? ''
  const rating = Number(review.rating ?? 0)

  return (
    <View
      className={`rounded-2xl border p-4 ${
        highlighted
          ? 'border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-900/20'
          : 'border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-800'
      }`}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-surface-900 dark:text-surface-50" style={headerTextStyle}>
            {author}
          </Text>
          <Text className="mt-1 text-sm leading-6 text-surface-600 dark:text-surface-300" style={bodyTextStyle}>
            {content}
          </Text>
        </View>
        <Text className="text-xs text-surface-400" style={bodyTextStyle}>
          {review.created_at ? new Date(review.created_at).toLocaleDateString() : ''}
        </Text>
      </View>
      <View className="mt-3 flex-row items-center justify-between">
        <ReviewStars rating={rating} size={16} />
        {highlighted ? (
          <View className="rounded-full bg-brand-500 px-2 py-0.5">
            <Text className="text-[10px] font-semibold text-white" style={bodyTextStyle}>
              You
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

export default function ArticleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t } = useI18n()
  const { article, loading, error } = useArticleDetail(id)
  const { user, isLoggedIn, refreshUser } = useAuth()
  const { isBookmarked, toggleArticle } = useLibrary()
  const { articles: purchasedArticles, reload: reloadPurchases } = usePurchases()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const { width } = useWindowDimensions()
  const [activeTab, setActiveTab] = useState<'content' | 'reviews'>('content')
  const [reviews, setReviews] = useState<Review[]>([])
  const [userReview, setUserReview] = useState<Review | null>(null)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewMessage, setReviewMessage] = useState('')
  const [newReview, setNewReview] = useState('')
  const [newRating, setNewRating] = useState(5)
  const [purchasing, setPurchasing] = useState(false)
  const [purchaseMessage, setPurchaseMessage] = useState('')

  const isTablet = width >= 768
  const contentMaxWidth = isTablet ? 1080 : undefined
  const bannerHeight = isTablet ? 300 : 224

  const thumb = article ? fixUrl((article.thumbnail_url as string) ?? (article.thumbnail as string) ?? '') : ''
  const body = article ? String(article.content ?? article.body ?? article.description ?? '') : ''
  const bookmarked = article ? isBookmarked('article', article.id) : false
  const category = article ? ((article.categoryname as string) ?? (article.category as string) ?? '') : ''
  const price = Number(article?.price ?? article?.amount ?? 0)
  const isPaid = !!article && !article.is_free && price > 0
  const canRead = useMemo(() => {
    if (!article) return false
    if (!isPaid) return true
    return purchasedArticles.some((item) => String(item.id) === String(article.id))
  }, [article, isPaid, purchasedArticles])

  const displayedReviews = useMemo(() => {
    const seen = new Set<string>()
    const items: Review[] = []

    if (userReview) {
      const key = String(userReview.id)
      seen.add(key)
      items.push(userReview)
    }

    for (const review of reviews) {
      const key = String(review.id)
      if (seen.has(key)) continue
      seen.add(key)
      items.push(review)
    }

    return items
  }, [reviews, userReview])

  const loadReviews = useCallback(async () => {
    setReviewsLoading(true)
    try {
      const res = await reviewsApi.loadRecentReviews(id, 'article', user?.email)
      const body = res.data as Record<string, unknown>
      setReviews(getReviewList(body.reviews ?? body.data ?? body.list))
      setUserReview(getReview(body.userreview ?? body.userReview ?? body.data))
    } catch {
      setReviews([])
      setUserReview(null)
    } finally {
      setReviewsLoading(false)
    }
  }, [id, user?.email])

  useEffect(() => {
    void loadReviews()
  }, [loadReviews])

  const onPurchase = async () => {
    if (!article) return
    if (!isLoggedIn || !user?.email) {
      router.push('/(auth)/login')
      return
    }

    setPurchasing(true)
    setPurchaseMessage('')
    try {
      const res = await purchasesApi.purchaseArticle(user.email, article.id, price)
      const body = res.data as Record<string, unknown>
      if (body.status === 'error' || body.status === 'fail') {
        setPurchaseMessage(String(body.message ?? ''))
      } else {
        const coinRes = await purchasesApi.getUserCoins(user.email).catch(() => ({ data: {} }))
        const coins = Number((coinRes.data as Record<string, unknown>).coins ?? user.coins ?? 0)
        await refreshUser({ ...user, coins })
        await reloadPurchases()
        setPurchaseMessage('Purchase successful! You can now read this article.')
      }
    } catch {
      setPurchaseMessage('Purchase failed. Please check your coin balance.')
    } finally {
      setPurchasing(false)
    }
  }

  const onSubmitReview = async () => {
    if (!article || !newReview.trim()) return
    if (!isLoggedIn || !user?.email) {
      router.push('/(auth)/login')
      return
    }

    setSubmittingReview(true)
    setReviewMessage('')
    try {
      const res = await reviewsApi.submitReview({
        itmid: article.id,
        type: 'article',
        content: newReview,
        rating: newRating,
        email: user.email,
      })
      const body = res.data as Record<string, unknown>
      const created = getReview(body.review ?? body.data ?? body.userreview)
      if (created) {
        setUserReview(created)
        setReviews((prev) => {
          const next = prev.filter((item) => String(item.id) !== String(created.id))
          return [created, ...next]
        })
      } else {
        await loadReviews()
      }
      setNewReview('')
      setReviewMessage('Review submitted!')
      setActiveTab('reviews')
    } catch {
      setReviewMessage('Failed to submit review')
    } finally {
      setSubmittingReview(false)
    }
  }

  if (error || !article) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title: '' }} />
        <EmptyState icon="⚠️" title={t('common.error')} />
      </Screen>
    )
  }

  if (loading) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title: '' }} />
        <LoadingSpinner />
      </Screen>
    )
  }

  return (
    <Screen edges={[]}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Pressable onPress={() => toggleArticle(article)} hitSlop={8}>
              <Ionicons
                name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                size={22}
                color="#2563eb"
              />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{
            paddingBottom: 32,
            width: '100%',
            alignSelf: 'center',
            maxWidth: contentMaxWidth,
          }}
        >
          <View className={`${isTablet ? 'px-6 pt-6' : 'px-4 pt-4'}`}>
            <View className={`overflow-hidden rounded-3xl bg-surface-200 dark:bg-surface-800 shadow-sm ${isTablet ? 'mb-6' : 'mb-4'}`} style={{ height: bannerHeight }}>
              {thumb ? (
                <Image source={{ uri: thumb }} className="h-full w-full" resizeMode="cover" />
              ) : (
                <View className="h-full w-full items-center justify-center">
                  <Text className="text-5xl">📰</Text>
                </View>
              )}
            </View>

            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-2xl font-bold text-surface-900 dark:text-surface-50" style={headerTextStyle}>
                  {article.title}
                </Text>
                <View className="mt-3 flex-row flex-wrap items-center gap-3">
                  {article.author ? (
                    <Text className="text-sm text-surface-500 dark:text-surface-400" style={bodyTextStyle}>
                      {t('common.by')} {String(article.author)}
                    </Text>
                  ) : null}
                  {category ? (
                    <Text className="text-sm text-brand-600 dark:text-brand-400" style={bodyTextStyle}>
                      {category}
                    </Text>
                  ) : null}
                  {article.created_at || article.date ? (
                    <Text className="text-sm text-surface-400" style={bodyTextStyle}>
                      {new Date(String(article.created_at ?? article.date ?? '')).toLocaleDateString()}
                    </Text>
                  ) : null}
                  {isPaid ? (
                    <Text className="text-sm font-semibold text-brand-600 dark:text-brand-400" style={bodyTextStyle}>
                      🪙 {price} coins
                    </Text>
                  ) : (
                    <Text className="text-sm font-semibold text-emerald-600 dark:text-emerald-400" style={bodyTextStyle}>
                      Free
                    </Text>
                  )}
                </View>
              </View>
            </View>

            <View className="mt-5 rounded-2xl bg-surface-200 dark:bg-surface-800 p-1">
              {([
                { id: 'content' as const, label: 'Content' },
                { id: 'reviews' as const, label: `Reviews (${displayedReviews.length})` },
              ] as const).map((tab) => {
                const selected = activeTab === tab.id
                return (
                  <Pressable
                    key={tab.id}
                    onPress={() => setActiveTab(tab.id)}
                    className={`flex-1 rounded-xl px-4 py-2.5 ${selected ? 'bg-white dark:bg-surface-700' : ''}`}
                  >
                    <Text
                      className={`text-center text-sm font-medium ${
                        selected ? 'text-surface-900 dark:text-surface-50' : 'text-surface-500 dark:text-surface-400'
                      }`}
                      style={selected ? headerTextStyle : bodyTextStyle}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          {activeTab === 'content' ? (
            <View className={`${isTablet ? 'px-6' : 'px-4'} mt-6`}>
              {!canRead ? (
                <View className="rounded-2xl bg-white dark:bg-surface-800 p-5">
                  <View className="items-center py-6">
                    <Text className="text-5xl">🔒</Text>
                    <Text className="mt-3 text-center text-lg font-semibold text-surface-900 dark:text-surface-50" style={headerTextStyle}>
                      This article requires purchase
                    </Text>
                    <Text className="mt-2 text-center text-sm text-surface-500 dark:text-surface-400" style={bodyTextStyle}>
                      🪙 {price} coins for full access
                    </Text>

                    <View className="mt-5 w-full items-center">
                      {isLoggedIn ? (
                        <PrimaryButton
                          label={purchasing ? `Purchasing…` : `🪙 Buy for ${price} coins`}
                          loading={purchasing}
                          onPress={onPurchase}
                          labelClassName="text-base font-bold"
                          labelStyle={headerTextStyle}
                        />
                      ) : (
                        <PrimaryButton
                          label="🔐 Login to Read"
                          onPress={() => router.push('/(auth)/login')}
                          labelClassName="text-base font-bold"
                          labelStyle={headerTextStyle}
                        />
                      )}
                    </View>

                    {purchaseMessage ? (
                      <Text
                        className={`mt-3 text-center text-sm ${purchaseMessage.includes('successful') ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}
                        style={bodyTextStyle}
                      >
                        {purchaseMessage}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : (
                <View className="rounded-2xl bg-white dark:bg-surface-800 p-5">
                  <Text className="mb-3 text-lg font-bold text-surface-900 dark:text-surface-50" style={headerTextStyle}>
                    Content
                  </Text>
                  <Text className="leading-7 text-surface-700 dark:text-surface-200" style={bodyTextStyle}>
                    {stripHtml(body) || 'No content available.'}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View className={`${isTablet ? 'px-6' : 'px-4'} mt-6`}>
              {isLoggedIn ? (
                <View className="rounded-2xl bg-white dark:bg-surface-800 p-5">
                  <Text className="mb-3 text-lg font-bold text-surface-900 dark:text-surface-50" style={headerTextStyle}>
                    Write a Review
                  </Text>

                  <View className="mb-4">
                    <ReviewStars rating={newRating} onChange={setNewRating} />
                  </View>

                  <TextInput
                    value={newReview}
                    onChangeText={setNewReview}
                    placeholder="Share your thoughts..."
                    placeholderTextColor="#94a3b8"
                    multiline
                    textAlignVertical="top"
                    className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-surface-900 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-50"
                    style={[bodyTextStyle, { minHeight: 120, textAlignVertical: 'top' }]}
                  />

                  <View className="mt-3 flex-row items-center justify-between gap-3">
                    <Text className="flex-1 text-sm text-emerald-600 dark:text-emerald-400" style={bodyTextStyle}>
                      {reviewMessage}
                    </Text>
                    <PrimaryButton
                      label={submittingReview ? 'Submitting…' : 'Submit Review'}
                      loading={submittingReview}
                      onPress={onSubmitReview}
                      labelClassName="text-base font-bold"
                      labelStyle={headerTextStyle}
                    />
                  </View>
                </View>
              ) : (
                <View className="rounded-2xl bg-white dark:bg-surface-800 p-5">
                  <Text className="text-center text-surface-700 dark:text-surface-300" style={bodyTextStyle}>
                    Login to write a review.
                  </Text>
                  <View className="mt-3 items-center">
                    <PrimaryButton
                      label={t('auth.login')}
                      onPress={() => router.push('/(auth)/login')}
                      labelClassName="text-base font-bold"
                      labelStyle={headerTextStyle}
                    />
                  </View>
                </View>
              )}

              <View className="mt-6">
                <Text className="mb-3 text-lg font-bold text-surface-900 dark:text-surface-50" style={headerTextStyle}>
                  Reviews ({displayedReviews.length})
                </Text>

                {reviewsLoading ? (
                  <LoadingSpinner />
                ) : displayedReviews.length > 0 ? (
                  <View className="gap-3">
                    {displayedReviews.map((review) => (
                      <ReviewCard
                        key={String(review.id)}
                        review={review}
                        highlighted={String(userReview?.id ?? '') === String(review.id)}
                        bodyTextStyle={bodyTextStyle}
                        headerTextStyle={headerTextStyle}
                      />
                    ))}
                  </View>
                ) : (
                  <EmptyState
                    icon="💬"
                    title="No reviews yet"
                    subtitle="Be the first one to share what you think about this article."
                  />
                )}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
