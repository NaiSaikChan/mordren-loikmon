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
import { books as booksApi } from '@loikmon/api'
import { Screen } from '@/components/Screen'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { BookCard } from '@/components/BookCard'
import { PrimaryButton } from '@/components/PrimaryButton'
import { useBookDetail } from '@/hooks/useBooks'
import { useAuth } from '@/context/AuthContext'
import { useLibrary } from '@/context/LibraryContext'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
import { useIsOwned } from '@/hooks/useIsOwned'
import { useBookAudioChapters } from '@/hooks/useBookAudioChapters'
import { useAudio } from '@/context/AudioContext'
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

// Review content is stored as Base64 (encoded by the mobile app before submission)
function decodeBase64(str: string): string {
  const input = String(str ?? '').trim()
  if (!input) return ''

  const normalized = input.replace(/\s+/g, '')
  const looksBase64 =
    normalized.length >= 8 &&
    normalized.length % 4 === 0 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(normalized)

  if (!looksBase64) return str

  const decodeUtf8 = (base64Text: string): string | null => {
    try {
      if (typeof atob === 'function') {
        const binary = atob(base64Text)
        const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))

        if (typeof TextDecoder !== 'undefined') {
          return new TextDecoder('utf-8').decode(bytes)
        }

        return decodeURIComponent(
          Array.from(bytes)
            .map((b) => `%${b.toString(16).padStart(2, '0')}`)
            .join(''),
        )
      }
    } catch {
      // fall through to Buffer path
    }

    try {
      if (typeof Buffer !== 'undefined') {
        return Buffer.from(base64Text, 'base64').toString('utf8')
      }
    } catch {
      // noop
    }

    return null
  }

  try {
    const once = decodeUtf8(normalized)
    if (!once) return str

    // Some legacy payloads may be encoded twice.
    const maybeSecondPass = once.replace(/\s+/g, '')
    const looksBase64Again =
      maybeSecondPass.length >= 8 &&
      maybeSecondPass.length % 4 === 0 &&
      /^[A-Za-z0-9+/]+={0,2}$/.test(maybeSecondPass)

    if (looksBase64Again) {
      const twice = decodeUtf8(maybeSecondPass)
      if (twice) return twice
    }

    return once
  } catch {
    return str
  }
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
  const { t } = useI18n()
  const author = review.author_name ?? review.username ?? t('common.anonymous')
  const content = decodeBase64(review.content ?? review.comment ?? '')
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
              {t('common.you')}
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
  const { owned: canRead, reload: reloadOwnership } = useIsOwned(id, 'book')
  const { tracks: audioTracks, hasAudio } = useBookAudioChapters(
    book?.id,
    book?.title,
  )
  const { play } = useAudio()
  const { width } = useWindowDimensions()
  const [purchasing, setPurchasing] = useState(false)
  const [activeTab, setActiveTab] = useState<BookDetailTab>('details')
  const [bookCoupon, setBookCoupon] = useState('')
  const [bookCouponMsg, setBookCouponMsg] = useState('')
  const [bookCouponLoading, setBookCouponLoading] = useState(false)
  const [bookCouponSuccess, setBookCouponSuccess] = useState(false)
  const [showCoupon, setShowCoupon] = useState(false)
  const [reviews, setReviews] = useState<Review[]>([])
  const [userReview, setUserReview] = useState<Review | null>(null)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewMessage, setReviewMessage] = useState('')
  const [newReview, setNewReview] = useState('')
  const [newRating, setNewRating] = useState(5)

  const isTablet = width >= 768
  const relatedColumns = Math.max(2, Math.min(4, Math.floor(width / 200)))
  const coverW = isTablet ? Math.min(220, Math.round(width * 0.22)) : Math.round(width * 0.38)
  const coverH = Math.round(coverW * 1.48)
  const heroH = coverH + 72
  const cover = book ? pickCover(book as unknown as Record<string, unknown>) : ''
  const author = book ? (book.authorname as string) ?? (book.author as string) ?? '' : ''
  const free = book ? isFree(book as unknown as Record<string, unknown>) : false
  const epubSource = book ? ((book.epub as string) ?? '') : ''
  const pdfSource = book ? ((book.pdf as string) ?? (book.pdffile as string) ?? '') : ''
  const price = Number(book?.amount ?? book?.price ?? 0)
  const bookmarked = book ? isBookmarked('book', book.id) : false

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
      <Screen edges={['top']}>
        <Stack.Screen options={{ title: '' }} />
        <LoadingSpinner />
      </Screen>
    )
  }

  if (error || !book) {
    return (
      <Screen edges={['top']}>
        <Stack.Screen options={{ title: '' }} />
        <EmptyState icon="⚠️" title={t('common.error')} />
      </Screen>
    )
  }

  const onListenAudio = () => {
    if (audioTracks.length === 0) return
    // Pre-load audio then open the full-screen audiobook player
    void play(audioTracks[0], audioTracks)
    router.push({ pathname: '/audiobook/[id]', params: { id: String(id) } })
  }

  const audioButton = hasAudio ? (
    <PrimaryButton
      label={`🎧 ${t('books.listen')}`}
      onPress={() => onListenAudio()}
      labelStyle={headerTextStyle}
    />
  ) : null

  const openReader = async (source: string, format?: 'epub' | 'pdf') => {
    if (!source) {
      Alert.alert(t('reader.notAvailable'))
      return
    }

    try {
      await booksApi.updateTotalViews(id)
    } catch {
      // Keep reader usable even if tracking endpoint fails.
    }

    router.push({
      pathname: '/reader',
      params: {
        url: source,
        title: book.title,
        id: String(book.id),
        format: format ?? undefined,
      },
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
        const preferred = epubSource || pdfSource
        void openReader(preferred, epubSource ? 'epub' : 'pdf')
      }
    } catch {
      Alert.alert(t('common.error'))
    } finally {
      setPurchasing(false)
    }
  }

  const onRedeemBookCoupon = async () => {
    if (!isLoggedIn || !user?.email) {
      router.push('/(auth)/login')
      return
    }
    const code = bookCoupon.trim()
    if (!code) return
    setBookCouponLoading(true)
    setBookCouponMsg('')
    setBookCouponSuccess(false)
    try {
      const res = await purchasesApi.redeemCoupon(user.email, code, id)
      const body = res.data as Record<string, unknown>
      if (body.status === 'ok') {
        setBookCouponSuccess(true)
        setBookCouponMsg(String(body.message ?? body.msg ?? t('books.couponSuccess')))
        setBookCoupon('')
        // Refresh purchases list so canRead flips immediately
        await reloadOwnership()
        const coinRes = await purchasesApi.getUserCoins(user.email).catch(() => ({ data: {} }))
        const coins = Number((coinRes.data as Record<string, unknown>).coins ?? user.coins ?? 0)
        await refreshUser({ ...user, coins })
      } else {
        setBookCouponMsg(String(body.message ?? body.msg ?? t('books.couponInvalid')))
      }
    } catch (e: unknown) {
      setBookCouponMsg(e instanceof Error ? e.message : t('books.couponError'))
    } finally {
      setBookCouponLoading(false)
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
      setReviewMessage(t('books.reviewSubmitted'))
      setActiveTab('reviews')
    } catch {
      setReviewMessage(t('books.reviewSubmitFailed'))
    } finally {
      setSubmittingReview(false)
    }
  }

  const reviewCount = displayedReviews.length

  // ── JSX fragments shared by phone and tablet layouts ─────────────────
  const statChips = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
      {book.rating ? (
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
            backgroundColor: 'rgba(245,158,11,0.12)',
          }}
        >
          <Ionicons name="star" size={12} color="#f59e0b" />
          <Text className="text-xs text-amber-600 dark:text-amber-400" style={bodyTextStyle}>
            {Number(book.rating).toFixed(1)}
          </Text>
        </View>
      ) : null}
      {(book.pages || book.pagecount) ? (
        <View
          className="bg-surface-100 dark:bg-surface-700"
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
          }}
        >
          <Ionicons name="document-text-outline" size={12} color="#64748b" />
          <Text className="text-xs font-medium text-surface-500 dark:text-surface-400" style={bodyTextStyle}>
            {t('books.pages', { count: String(book.pages ?? book.pagecount) })}
          </Text>
        </View>
      ) : null}
      {free ? (
        <View
          style={{
            borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
            backgroundColor: 'rgba(16,185,129,0.12)',
          }}
        >
          <Text className="text-xs text-emerald-600 dark:text-emerald-400" style={bodyTextStyle}>
            {t('books.free')}
          </Text>
        </View>
      ) : (
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
            backgroundColor: 'rgba(37,99,235,0.1)',
          }}
        >
          <Ionicons name="server-outline" size={12} color="#2563eb" />
          <Text className="text-xs text-brand-600 dark:text-brand-400" style={bodyTextStyle}>
            {price} {t('purchases.coins')}
          </Text>
        </View>
      )}
    </View>
  )

  const actionButtons = (
    <View style={{ gap: 10 }}>
      {free || canRead ? (
        <>
          {epubSource ? (
            <PrimaryButton
              label={`📖 ${t('books.readEpub')}`}
              onPress={() => void openReader(epubSource, 'epub')}
              labelStyle={headerTextStyle}
            />
          ) : null}
          {pdfSource ? (
            <PrimaryButton
              label={`📄 ${t('books.readPdf')}`}
              onPress={() => void openReader(pdfSource, 'pdf')}
              labelStyle={headerTextStyle}
            />
          ) : null}
          {audioButton}
        </>
      ) : isLoggedIn ? (
        <>
          <PrimaryButton
            label={`${t('books.purchase')} ${price} ${t('purchases.coins')}`}
            loading={purchasing}
            onPress={onPurchase}
            labelStyle={headerTextStyle}
          />
          <Pressable
            onPress={() => setShowCoupon((v) => !v)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 8,
            }}
          >
            <Text
              className="text-s font-semibold text-surface-400 dark:text-surface-500"
              style={bodyTextStyle}
            >
              🎫 {t('books.couponPrompt')}
            </Text>
            <Ionicons
              name={showCoupon ? 'chevron-up' : 'chevron-down'}
              size={14}
              color="#94a3b8"
            />
          </Pressable>
          {showCoupon ? (
            <View className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 p-3">
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={bookCoupon}
                  onChangeText={(v) => {
                    setBookCoupon(v)
                    setBookCouponMsg('')
                  }}
                  placeholder={t('books.couponPlaceholder')}
                  autoCapitalize="characters"
                  placeholderTextColor="#94a3b8"
                  className="flex-1 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 py-2.5 text-sm text-surface-900 dark:text-surface-50"
                />
                <Pressable
                  onPress={() => void onRedeemBookCoupon()}
                  disabled={!bookCoupon.trim() || bookCouponLoading}
                  style={{
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 80,
                    backgroundColor:
                      bookCoupon.trim() && !bookCouponLoading ? '#2563eb' : '#93c5fd',
                  }}
                >
                  <Text className="text-sm text-white" style={bodyTextStyle}>
                    {bookCouponLoading ? '…' : t('purchases.redeemAction')}
                  </Text>
                </Pressable>
              </View>
              {bookCouponMsg ? (
                <Text
                  className={`mt-2 text-xs ${bookCouponSuccess ? 'text-emerald-500' : 'text-red-400'}`}
                  style={bodyTextStyle}
                >
                  {bookCouponMsg}
                </Text>
              ) : null}
            </View>
          ) : null}
        </>
      ) : (
        <PrimaryButton
          label={`${t('books.purchase')} ${price} ${t('purchases.coins')}`}
          onPress={() => router.push('/(auth)/login')}
          labelStyle={headerTextStyle}
        />
      )}
    </View>
  )

  return (
    <Screen edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>

          {/* ── Phone: full-width blurred hero ───────────────── */}
          {!isTablet ? (
            <View
              style={{
                height: heroH,
                overflow: 'hidden',
                backgroundColor: '#0f172a',
                borderBottomLeftRadius: 28,
                borderBottomRightRadius: 28,
              }}
            >
              {cover ? (
                <Image
                  source={{ uri: cover }}
                  style={{ position: 'absolute', width: '100%', height: '100%' }}
                  blurRadius={22}
                  resizeMode="cover"
                />
              ) : null}
              <View
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backgroundColor: 'rgba(0,0,0,0.52)',
                }}
              />
              {/* Back and bookmark floating over the blurred hero */}
              <View
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 16,
                  right: 16,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  zIndex: 10,
                }}
              >
                <Pressable
                  onPress={() => router.back()}
                  hitSlop={8}
                  style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: 'rgba(0,0,0,0.35)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="chevron-back" size={22} color="#fff" />
                </Pressable>
                <Pressable
                  onPress={() => toggleBook(book)}
                  hitSlop={8}
                  style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: 'rgba(0,0,0,0.35)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                    size={20}
                    color="#fff"
                  />
                </Pressable>
              </View>
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingTop: 20,
                  paddingBottom: 10,
                }}
              >
                <View
                  style={{
                    elevation: 24,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 14 },
                    shadowOpacity: 0.65,
                    shadowRadius: 22,
                  }}
                >
                  {cover ? (
                    <Image
                      source={{ uri: cover }}
                      style={{ width: coverW, height: coverH, borderRadius: 18 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={{
                        width: coverW,
                        height: coverH,
                        borderRadius: 18,
                        backgroundColor: '#1e293b',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 52 }}>📚</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ) : null}

          {/* ── Phone: title / author / chips / actions ──────── */}
          {!isTablet ? (
            <View style={{ paddingHorizontal: 20, paddingTop: 22 }}>
              <Text
                className="text-[22px] leading-snug text-surface-900 dark:text-surface-50"
                style={headerTextStyle}
              >
                {book.title}
              </Text>
              {author ? (
                <Text
                  className="mt-1.5 text-sm font-semibold text-brand-600 dark:text-brand-400"
                  style={bodyTextStyle}
                >
                  {t('common.by')} {author}
                </Text>
              ) : null}
              {statChips}
              <View style={{ marginTop: 20 }}>{actionButtons}</View>
            </View>
          ) : null}

          {/* ── Tablet: side-by-side ─────────────────────────── */}
          {isTablet ? (
            <View
              style={{
                flexDirection: 'row',
                gap: 28,
                paddingHorizontal: 28,
                paddingTop: 28,
                paddingBottom: 4,
                alignItems: 'flex-start',
              }}
            >
              {/* Tablet nav: back left, bookmark right */}
              <View
                style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingHorizontal: 28,
                  paddingVertical: 4,
                }}
              >
                <Pressable onPress={() => router.back()} hitSlop={8}>
                  <Ionicons name="chevron-back" size={24} color="#2563eb" />
                </Pressable>
                <Pressable onPress={() => toggleBook(book)} hitSlop={8}>
                  <Ionicons
                    name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                    size={22}
                    color="#2563eb"
                  />
                </Pressable>
              </View>
              <View
                style={{
                  elevation: 18,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.3,
                  shadowRadius: 18,
                }}
              >
                {cover ? (
                  <Image
                    source={{ uri: cover }}
                    style={{ width: coverW, height: coverH, borderRadius: 18 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: coverW,
                      height: coverH,
                      borderRadius: 18,
                      backgroundColor: '#1e293b',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 52 }}>📚</Text>
                  </View>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  className="text-3xl leading-tight text-surface-900 dark:text-surface-50"
                  style={headerTextStyle}
                >
                  {book.title}
                </Text>
                {author ? (
                  <Text
                    className="mt-2 text-base font-semibold text-brand-600 dark:text-brand-400"
                    style={bodyTextStyle}
                  >
                    by {author}
                  </Text>
                ) : null}
                {statChips}
                <View style={{ marginTop: 24 }}>{actionButtons}</View>
              </View>
            </View>
          ) : null}

          {/* ── Tab bar ──────────────────────────────────────── */}
          <View style={{ paddingHorizontal: isTablet ? 28 : 20, paddingTop: 24 }}>
            <View className="flex-row rounded-2xl bg-surface-100 dark:bg-surface-800 p-1">
              {([
                { id: 'details' as const, label: t('books.detailsTab') },
                { id: 'reviews' as const, label: t('books.reviewsTab', { count: reviewCount }) },
              ] as const).map((tab) => {
                const selected = activeTab === tab.id
                return (
                  <Pressable
                    key={tab.id}
                    onPress={() => setActiveTab(tab.id)}
                    className={`flex-1 rounded-xl px-4 py-2.5 ${selected ? 'bg-white dark:bg-surface-700' : ''}`}
                  >
                    <Text
                      className={`text-center text-sm font-semibold ${
                        selected
                          ? 'text-brand-600 dark:text-brand-400'
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

          {/* ── Tab content ──────────────────────────────────── */}
          <View style={{ paddingHorizontal: isTablet ? 28 : 20, paddingTop: 16 }}>
            {activeTab === 'details' ? (
              <>
                {book.description || book.about ? (
                  <View className="rounded-2xl bg-white dark:bg-surface-800 p-5">
                    <Text
                      className="mb-2 text-base text-surface-900 dark:text-surface-50"
                      style={headerTextStyle}
                    >
                      {t('books.description')}
                    </Text>
                    <Text
                      className="text-sm leading-7 text-surface-600 dark:text-surface-300"
                      style={bodyTextStyle}
                    >
                      {String(book.description ?? book.about)}
                    </Text>
                  </View>
                ) : null}

                {related.length > 0 ? (
                  <View style={{ marginTop: 24 }}>
                    <Text
                      className="mb-3 text-base text-surface-900 dark:text-surface-50"
                      style={headerTextStyle}
                    >
                      {t('books.related')}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -8 }}>
                      {related.map((item) => (
                        <View
                          key={String(item.id)}
                          style={{ width: `${100 / relatedColumns}%`, padding: 8 }}
                        >
                          <BookCard book={item} variant="grid" />
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                {isLoggedIn ? (
                  <View className="rounded-2xl bg-white dark:bg-surface-800 p-5">
                    <Text
                      className="mb-3 text-base text-surface-900 dark:text-surface-50"
                      style={headerTextStyle}
                    >
                      {t('books.writeReview')}
                    </Text>
                    <View className="mb-4">
                      <ReviewStars rating={newRating} onChange={setNewRating} />
                    </View>
                    <TextInput
                      value={newReview}
                      onChangeText={setNewReview}
                      placeholder={t('books.reviewPlaceholder')}
                      placeholderTextColor="#94a3b8"
                      multiline
                      textAlignVertical="top"
                      className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-surface-900 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-50"
                      style={[bodyTextStyle, { minHeight: 110, textAlignVertical: 'top' }]}
                    />
                    <View className="mt-3 flex-row items-center justify-between gap-3">
                      <Text
                        className="flex-1 text-sm text-emerald-600 dark:text-emerald-400"
                        style={bodyTextStyle}
                      >
                        {reviewMessage}
                      </Text>
                      <PrimaryButton
                        label={submittingReview ? t('purchases.submitting') : t('books.submitReview')}
                        loading={submittingReview}
                        onPress={onSubmitReview}
                        labelClassName="text-sm"
                        labelStyle={headerTextStyle}
                      />
                    </View>
                  </View>
                ) : (
                  <View className="rounded-2xl bg-white dark:bg-surface-800 p-5 items-center">
                    <Text
                      className="mb-3 text-center text-surface-600 dark:text-surface-300"
                      style={bodyTextStyle}
                    >
                      {t('books.loginToReview')}
                    </Text>
                    <PrimaryButton
                      label={t('auth.login')}
                      onPress={() => router.push('/(auth)/login')}
                      labelClassName="text-sm"
                      labelStyle={headerTextStyle}
                    />
                  </View>
                )}

                <View style={{ marginTop: 20 }}>
                  <Text
                    className="mb-3 text-base text-surface-900 dark:text-surface-50"
                    style={headerTextStyle}
                  >
                    {t('books.reviewsTab', { count: reviewCount })}
                  </Text>
                  {reviewsLoading ? (
                    <LoadingSpinner />
                  ) : reviewCount > 0 ? (
                    <View style={{ gap: 12 }}>
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
                      title={t('books.noReviews')}
                      subtitle={t('books.noReviewsHint')}
                    />
                  )}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
