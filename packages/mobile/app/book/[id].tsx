import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
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
import { BookCard } from '@/components/BookCard'
import { PrimaryButton } from '@/components/PrimaryButton'
import { useBookDetail } from '@/hooks/useBooks'
import { useAuth } from '@/context/AuthContext'
import { useLibrary } from '@/context/LibraryContext'
import { usePurchases } from '@/hooks/usePurchases'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
import { pickCover } from '@/lib/url'
import { isFree } from '@/lib/normalize'

type BookDetailTab = 'details' | 'reviews'

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

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t } = useI18n()
  const { book, related, loading, error } = useBookDetail(id)
  const { user, isLoggedIn, refreshUser } = useAuth()
  const { isBookmarked, toggleBook } = useLibrary()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const { books: purchasedBooks } = usePurchases()
  const { width } = useWindowDimensions()
  const [purchasing, setPurchasing] = useState(false)
  const [activeTab, setActiveTab] = useState<BookDetailTab>('details')
  const [reviews, setReviews] = useState<Review[]>([])
  const [userReview, setUserReview] = useState<Review | null>(null)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewMessage, setReviewMessage] = useState('')
  const [newReview, setNewReview] = useState('')
  const [newRating, setNewRating] = useState(5)

  const isTablet = width >= 768
  const relatedColumns = Math.max(2, Math.min(4, Math.floor(width / 260)))
  const coverWidth = isTablet ? Math.min(240, Math.max(180, Math.round(width * 0.22))) : 128
  const coverHeight = Math.round(coverWidth * 1.5)
  const cover = book ? pickCover(book as unknown as Record<string, unknown>) : ''
  const author = book ? (book.authorname as string) ?? (book.author as string) ?? '' : ''
  const free = book ? isFree(book as unknown as Record<string, unknown>) : false
  const source = book ? (book.pdf as string) ?? (book.pdffile as string) ?? (book.epub as string) ?? '' : ''
  const price = Number(book?.amount ?? book?.price ?? 0)
  const bookmarked = book ? isBookmarked('book', book.id) : false

  const canRead = useMemo(() => {
    if (free) return true
    if (!book) return false
    return purchasedBooks.some((item) => String(item.id) === String(book.id))
  }, [book, free, purchasedBooks])

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
      const res = await reviewsApi.loadRecentReviews(id, 'book', user?.email)
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

  if (loading) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title: '' }} />
        <LoadingSpinner />
      </Screen>
    )
  }

  if (error || !book) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title: '' }} />
        <EmptyState icon="⚠️" title={t('common.error')} />
      </Screen>
    )
  }

  const openReader = () => {
    if (!source) {
      Alert.alert(t('reader.notAvailable'))
      return
    }
    router.push({
      pathname: '/reader',
      params: { url: source, title: book.title },
    })
  }

  const onPurchase = async () => {
    if (!isLoggedIn || !user?.email) {
      router.push('/(auth)/login')
      return
    }
    setPurchasing(true)
    try {
      const res = await purchasesApi.purchaseBook(user.email, book.id, price)
      const body = res.data as Record<string, unknown>
      if (body.status === 'error' || body.status === 'fail') {
        Alert.alert(t('common.error'), String(body.message ?? ''))
      } else {
        const coinRes = await purchasesApi.getUserCoins(user.email).catch(() => ({ data: {} }))
        const coins = Number((coinRes.data as Record<string, unknown>).coins ?? user.coins ?? 0)
        await refreshUser({ ...user, coins })
        Alert.alert(t('purchases.approved'))
        openReader()
      }
    } catch {
      Alert.alert(t('common.error'))
    } finally {
      setPurchasing(false)
    }
  }

  const onSubmitReview = async () => {
    if (!isLoggedIn || !user?.email) {
      router.push('/(auth)/login')
      return
    }
    if (!newReview.trim()) return

    setSubmittingReview(true)
    setReviewMessage('')
    try {
      const res = await reviewsApi.submitReview({
        itmid: id,
        type: 'book',
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

  const reviewCount = displayedReviews.length

  return (
    <Screen edges={[]}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Pressable onPress={() => toggleBook(book)} hitSlop={8}>
              <Ionicons
                name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                size={22}
                color="#2563eb"
              />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingBottom: 32,
            width: '100%',
            alignSelf: 'center',
            maxWidth: isTablet ? 1080 : undefined,
          }}
        >
          <View className={`${isTablet ? 'px-6 pt-6' : 'px-4 pt-4'}`}>
            <View className={`flex-row ${isTablet ? 'gap-6' : 'gap-4'}`}>
              <View
                className="overflow-hidden rounded-2xl bg-surface-200 dark:bg-surface-800 shadow-sm"
                style={{ width: coverWidth, height: coverHeight }}
              >
                {cover ? (
                  <Image source={{ uri: cover }} className="h-full w-full" resizeMode="cover" />
                ) : (
                  <View className="h-full w-full items-center justify-center">
                    <Text className="text-4xl">📚</Text>
                  </View>
                )}
              </View>

              <View className="flex-1 justify-center space-x-1">
                <Text className="text-xl font-bold text-surface-900 dark:text-surface-50 pt-1" style={headerTextStyle}>
                  {book.title}
                </Text>
                {author ? (
                  <Text className="mt-1 text-base text-brand-600 dark:text-brand-400 pt-1" style={bodyTextStyle}>
                    {t('common.by')} {author}
                  </Text>
                ) : null}

                <View className="mt-3 flex-row flex-wrap items-center gap-3">
                  {book.rating ? (
                    <Text className="text-sm text-yellow-500" style={bodyTextStyle}>
                      ⭐ {Number(book.rating).toFixed(1)}
                    </Text>
                  ) : null}
                  {book.pages || book.pagecount ? (
                    <Text className="text-sm text-surface-400" style={bodyTextStyle}>
                      {t('books.pages', { count: String(book.pages ?? book.pagecount) })}
                    </Text>
                  ) : null}
                  <Text className="text-sm font-semibold text-brand-600 dark:text-brand-400" style={bodyTextStyle}>
                    {free ? t('books.free') : `${price} ${t('purchases.coins')}`}
                  </Text>
                </View>

                <View className={`mt-5 items-center justify-center ${isTablet ? 'items-start' : 'items-stretch'}`}>
                  {free || canRead ? (
                    <PrimaryButton
                      label={t('books.read')}
                      onPress={openReader}
                      labelClassName="text-xl font-bold"
                      labelStyle={headerTextStyle}
                    />
                  ) : isLoggedIn ? (
                    <PrimaryButton
                      label={`${t('books.purchase')} ${price} ${t('purchases.coins')}`}
                      loading={purchasing}
                      onPress={onPurchase}
                      labelClassName="text-xl font-bold"
                      labelStyle={headerTextStyle}
                    />
                  ) : (
                    <PrimaryButton
                      label={`${t('books.purchase')} ${price} ${t('purchases.coins')}`}
                      onPress={() => router.push('/(auth)/login')}
                      labelClassName="text-xl font-bold"
                      labelStyle={headerTextStyle}
                    />
                  )}
                </View>
              </View>
            </View>
          </View>

          <View className={`${isTablet ? 'px-6' : 'px-4'} mt-6`}>
            <View className="flex-row rounded-2xl bg-surface-200 dark:bg-surface-800 p-1">
              {([
                { id: 'details' as const, label: 'Details' },
                { id: 'reviews' as const, label: `Reviews (${reviewCount})` },
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
                        selected
                          ? 'text-surface-900 dark:text-surface-50'
                          : 'text-surface-500 dark:text-surface-400'
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

          {activeTab === 'details' ? (
            <View className={`${isTablet ? 'px-6' : 'px-4'} mt-6`}>
              {book.description || book.about ? (
                <View className="rounded-2xl bg-white dark:bg-surface-800 p-4">
                  <Text className="mb-2 text-lg font-bold text-surface-900 dark:text-surface-50" style={headerTextStyle}>
                    {t('books.description')}
                  </Text>
                  <Text className="leading-7 text-surface-600 dark:text-surface-300" style={bodyTextStyle}>
                    {String(book.description ?? book.about)}
                  </Text>
                </View>
              ) : null}

              {related.length > 0 ? (
                <View className="mt-6">
                  <Text className="mb-3 text-lg font-bold text-surface-900 dark:text-surface-50" style={headerTextStyle}>
                    {t('books.related')}
                  </Text>
                  <View className="flex-row flex-wrap -mx-2">
                    {related.map((item) => (
                      <View
                        key={String(item.id)}
                        className="p-2"
                        style={{ width: `${100 / relatedColumns}%` }}
                      >
                        <BookCard book={item} variant="grid" />
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : (
            <View className={`${isTablet ? 'px-6' : 'px-4'} mt-6`}>
              {isLoggedIn ? (
                <View className="rounded-2xl bg-white dark:bg-surface-800 p-4">
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
                <View className="rounded-2xl bg-white dark:bg-surface-800 p-4">
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
                  Reviews ({reviewCount})
                </Text>

                {reviewsLoading ? (
                  <LoadingSpinner />
                ) : reviewCount > 0 ? (
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
                    subtitle="Be the first one to share what you think about this book."
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
