import { useState } from 'react'
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { BookCard } from '@/components/BookCard'
import { PrimaryButton } from '@/components/PrimaryButton'
import { PaywallCard } from '@/components/PaywallCard'
import { PriceBadge } from '@/components/PriceBadge'
import { ReviewsSection } from '@/components/Reviews'
import { useBookDetail } from '@/hooks/useBooks'
import { useReviews } from '@/hooks/useReviews'
import { useAuth } from '@/context/AuthContext'
import { useLibrary } from '@/context/LibraryContext'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
import { accessAction } from '@/lib/access'
import { firstParam } from '@/lib/normalize'
import { pickCover } from '@/lib/url'

type BookDetailTab = 'details' | 'reviews'

export default function BookDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const id = firstParam(params.id)
  const { t } = useI18n()
  const { book, related, loading, error } = useBookDetail(id)
  const reviews = useReviews('book', id)
  const { isLoggedIn } = useAuth()
  const { isBookmarked, toggleBook } = useLibrary()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const { width } = useWindowDimensions()
  const [activeTab, setActiveTab] = useState<BookDetailTab>('details')

  const isTablet = width >= 768
  const relatedColumns = Math.max(2, Math.min(4, Math.floor(width / 200)))
  const coverW = isTablet ? Math.min(220, Math.round(width * 0.22)) : Math.round(width * 0.38)
  const coverH = Math.round(coverW * 1.48)
  const heroH = coverH + 72

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
        <EmptyState icon="⚠️" title={t('common.error')} subtitle={error ?? undefined} />
      </Screen>
    )
  }

  const cover = pickCover(book)
  const author = book.authorname ?? ''
  const bookmarked = isBookmarked('book', book.id)
  // The server's decision for this viewer: open / sign in / subscribe.
  const action = accessAction(book.access, isLoggedIn)
  const formats = (book.formats ?? []).filter((f): f is 'epub' | 'pdf' => f === 'epub' || f === 'pdf')

  const openReader = (format: 'epub' | 'pdf') => {
    if (action === 'login') return router.push('/(auth)/login')
    if (action === 'subscribe') return router.push('/subscribe')
    router.push({ pathname: '/reader', params: { id: String(book.id), format, title: book.title } })
  }

  const openAudiobook = () => router.push({ pathname: '/audiobook/[id]', params: { id: String(book.id) } })

  const readLabel = (format: 'epub' | 'pdf') => {
    if (action === 'login') return `🔐 ${t('books.signInToRead')} (${format.toUpperCase()})`
    if (action === 'subscribe') return `🔒 ${t('books.subscribeToRead')} (${format.toUpperCase()})`
    return format === 'epub' ? `📖 ${t('books.readEpub')}` : `📄 ${t('books.readPdf')}`
  }

  // ── JSX fragments shared by phone and tablet layouts ─────────────────
  const statChips = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 14 }}>
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
      {book.pages ? (
        <View
          className="bg-surface-100 dark:bg-surface-700"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}
        >
          <Ionicons name="document-text-outline" size={12} color="#64748b" />
          <Text className="text-xs font-medium text-surface-500 dark:text-surface-400" style={bodyTextStyle}>
            {t('books.pages', { count: String(book.pages) })}
          </Text>
        </View>
      ) : null}
      <PriceBadge item={book} />
    </View>
  )

  const actionButtons = (
    <View style={{ gap: 10 }}>
      {formats.map((format) => (
        <PrimaryButton key={format} label={readLabel(format)} onPress={() => openReader(format)} labelStyle={headerTextStyle} />
      ))}
      {book.has_audio ? (
        <PrimaryButton label={`🎧 ${t('books.listen')}`} variant={formats.length ? 'ghost' : 'primary'} onPress={openAudiobook} labelStyle={headerTextStyle} />
      ) : null}
      {formats.length === 0 && !book.has_audio ? (
        <Text className="text-center text-sm text-surface-500 dark:text-surface-400" style={bodyTextStyle}>
          {t('reader.notAvailable')}
        </Text>
      ) : null}
      {action !== 'open' && (formats.length > 0 || book.has_audio) ? <PaywallCard action={action} /> : null}
    </View>
  )

  const coverImage = cover ? (
    <Image source={{ uri: cover }} style={{ width: coverW, height: coverH, borderRadius: 18 }} resizeMode="cover" />
  ) : (
    <View style={{ width: coverW, height: coverH, borderRadius: 18, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 52 }}>📚</Text>
    </View>
  )

  return (
    <Screen edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
          {/* ── Phone: full-width blurred hero ───────────────── */}
          {!isTablet ? (
            <View style={{ height: heroH, overflow: 'hidden', backgroundColor: '#0f172a', borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
              {cover ? (
                <Image source={{ uri: cover }} style={{ position: 'absolute', width: '100%', height: '100%' }} blurRadius={22} resizeMode="cover" />
              ) : null}
              <View style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.52)' }} />
              <View style={{ position: 'absolute', top: 12, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 }}>
                <Pressable
                  onPress={() => router.back()}
                  hitSlop={8}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="chevron-back" size={22} color="#fff" />
                </Pressable>
                <Pressable
                  onPress={() => toggleBook(book)}
                  hitSlop={8}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={20} color="#fff" />
                </Pressable>
              </View>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 20, paddingBottom: 10 }}>
                <View style={{ elevation: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.65, shadowRadius: 22 }}>
                  {coverImage}
                </View>
              </View>
            </View>
          ) : null}

          {/* ── Phone: title / author / chips / actions ──────── */}
          {!isTablet ? (
            <View style={{ paddingHorizontal: 20, paddingTop: 22 }}>
              <Text className="text-[22px] leading-snug text-surface-900 dark:text-surface-50" style={headerTextStyle}>
                {book.title}
              </Text>
              {author ? (
                <Text className="mt-1.5 text-sm font-semibold text-brand-600 dark:text-brand-400" style={bodyTextStyle}>
                  {t('common.by')} {author}
                </Text>
              ) : null}
              {statChips}
              <View style={{ marginTop: 20 }}>{actionButtons}</View>
            </View>
          ) : null}

          {/* ── Tablet: side-by-side ─────────────────────────── */}
          {isTablet ? (
            <View style={{ flexDirection: 'row', gap: 28, paddingHorizontal: 28, paddingTop: 28, paddingBottom: 4, alignItems: 'flex-start' }}>
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 28, paddingVertical: 4 }}>
                <Pressable onPress={() => router.back()} hitSlop={8}>
                  <Ionicons name="chevron-back" size={24} color="#2563eb" />
                </Pressable>
                <Pressable onPress={() => toggleBook(book)} hitSlop={8}>
                  <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={22} color="#2563eb" />
                </Pressable>
              </View>
              <View style={{ elevation: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 18 }}>
                {coverImage}
              </View>
              <View style={{ flex: 1 }}>
                <Text className="text-3xl leading-tight text-surface-900 dark:text-surface-50" style={headerTextStyle}>
                  {book.title}
                </Text>
                {author ? (
                  <Text className="mt-2 text-base font-semibold text-brand-600 dark:text-brand-400" style={bodyTextStyle}>
                    {t('common.by')} {author}
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
                      className={`text-center text-sm font-semibold ${selected ? 'text-brand-600 dark:text-brand-400' : 'text-surface-500 dark:text-surface-400'}`}
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
                {book.description ? (
                  <View className="rounded-2xl bg-white dark:bg-surface-800 p-5">
                    <Text className="mb-2 text-base text-surface-900 dark:text-surface-50" style={headerTextStyle}>
                      {t('books.description')}
                    </Text>
                    <Text className="text-sm leading-7 text-surface-600 dark:text-surface-300" style={bodyTextStyle}>
                      {book.description}
                    </Text>
                  </View>
                ) : null}

                {related.length > 0 ? (
                  <View style={{ marginTop: 24 }}>
                    <Text className="mb-3 text-base text-surface-900 dark:text-surface-50" style={headerTextStyle}>
                      {t('books.related')}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -8 }}>
                      {related.map((item) => (
                        <View key={String(item.id)} style={{ width: `${100 / relatedColumns}%`, padding: 8 }}>
                          <BookCard book={item} variant="grid" />
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </>
            ) : (
              <ReviewsSection reviews={reviews} itemType="book" />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
