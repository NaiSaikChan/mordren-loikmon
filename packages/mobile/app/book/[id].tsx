import { useCallback, useMemo, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { Image } from 'expo-image'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useReducedMotion } from 'react-native-reanimated'
import { Screen } from '@/components/Screen'
import { Skeleton } from '@/components/Skeleton'
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
import { pickImage } from '@/lib/url'
import { elevation, useThemeColors } from '@/theme/colors'

type BookDetailTab = 'details' | 'reviews'

/** The blurred hero only needs the smallest rendition (xs ≈ 150px). */
const HERO_BLUR_SOURCE_WIDTH = 50
const goBack = () => router.back()

export default function BookDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const id = firstParam(params.id)
  const { t } = useI18n()
  const { book, related, loading, error } = useBookDetail(id)
  const reviews = useReviews('book', id)
  const { isLoggedIn } = useAuth()
  const { isBookmarked, toggleBook } = useLibrary()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const colors = useThemeColors()
  const reduceMotion = useReducedMotion()
  const { width } = useWindowDimensions()
  const [activeTab, setActiveTab] = useState<BookDetailTab>('details')

  const isTablet = width >= 768
  const relatedColumns = Math.max(2, Math.min(4, Math.floor(width / 200)))
  const coverW = isTablet ? Math.min(220, Math.round(width * 0.22)) : Math.round(width * 0.38)
  const coverH = Math.round(coverW * 1.48)
  const heroH = coverH + 72
  const gutter = isTablet ? 28 : 20

  const dynamic = useMemo(
    () =>
      StyleSheet.create({
        cover: { width: coverW, height: coverH, borderRadius: 18 },
        coverFallback: {
          width: coverW,
          height: coverH,
          borderRadius: 18,
          backgroundColor: colors.placeholderFill,
          alignItems: 'center',
          justifyContent: 'center',
        },
        hero: { height: heroH, backgroundColor: colors.hero },
        gutter: { paddingHorizontal: gutter },
        relatedCell: { width: `${100 / relatedColumns}%`, padding: 8 },
      }),
    [coverW, coverH, heroH, gutter, relatedColumns, colors],
  )

  const onToggleBookmark = useCallback(() => {
    if (book) toggleBook(book)
  }, [book, toggleBook])

  if (loading) {
    return (
      <Screen edges={['top']}>
        <Stack.Screen options={{ title: '' }} />
        <View style={styles.loading}>
          <Skeleton width={coverW} height={coverH} radius={18} />
          <Skeleton height={24} width="70%" style={styles.loadingLine} />
          <Skeleton height={16} width="40%" style={styles.loadingLine} />
          <Skeleton height={48} style={styles.loadingLine} />
        </View>
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

  const cover = pickImage(book, coverW)
  const heroBlur = pickImage(book, HERO_BLUR_SOURCE_WIDTH)
  const author = book.authorname ?? ''
  const bookmarked = isBookmarked('book', book.id)
  // The server's decision for this viewer: open / sign in / subscribe.
  const action = accessAction(book.access, isLoggedIn)
  const formats = (book.formats ?? []).filter((f): f is 'epub' | 'pdf' => f === 'epub' || f === 'pdf')
  const bookmarkLabel = bookmarked ? t('a11y.removeBookmark') : t('a11y.addBookmark')
  const transition = reduceMotion ? 0 : 200

  const openReader = (format: 'epub' | 'pdf') => {
    if (action === 'login') return router.push('/(auth)/login')
    if (action === 'subscribe') return router.push('/subscribe')
    router.push({ pathname: '/reader', params: { id: String(book.id), format, title: book.title, ...(book.updated_at ? { version: String(book.updated_at) } : {}) } })
  }

  const openAudiobook = () => router.push({ pathname: '/audiobook/[id]', params: { id: String(book.id) } })

  const readLabel = (format: 'epub' | 'pdf') => {
    if (action === 'login') return `🔐 ${t('books.signInToRead')} (${format.toUpperCase()})`
    if (action === 'subscribe') return `🔒 ${t('books.subscribeToRead')} (${format.toUpperCase()})`
    return format === 'epub' ? `📖 ${t('books.readEpub')}` : `📄 ${t('books.readPdf')}`
  }

  // ── JSX fragments shared by phone and tablet layouts ─────────────────
  const statChips = (
    <View style={styles.chips}>
      {book.rating ? (
        <View style={styles.chip} className="bg-amber-100 dark:bg-amber-900/30" accessible accessibilityLabel={t('a11y.ratingValue', { rating: Number(book.rating).toFixed(1) })}>
          <Ionicons name="star" size={12} color={colors.starFilled} />
          <Text className="text-xs text-amber-700 dark:text-amber-400" style={bodyTextStyle}>
            {Number(book.rating).toFixed(1)}
          </Text>
        </View>
      ) : null}
      {book.pages ? (
        <View style={styles.chip} className="bg-surface-100 dark:bg-surface-700">
          <Ionicons name="document-text-outline" size={12} color={colors.mutedText} />
          <Text className="text-xs font-medium text-surface-500 dark:text-surface-400" style={bodyTextStyle}>
            {t('books.pages', { count: String(book.pages) })}
          </Text>
        </View>
      ) : null}
      <PriceBadge item={book} />
    </View>
  )

  const actionButtons = (
    <View style={styles.actions}>
      {formats.map((format) => (
        <PrimaryButton
          key={format}
          label={readLabel(format)}
          onPress={() => openReader(format)}
          disabled={action === 'subscribe'}
          labelStyle={headerTextStyle}
        />
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
    <Image
      source={cover}
      style={dynamic.cover}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={transition}
      accessibilityLabel={book.title}
    />
  ) : (
    <View style={dynamic.coverFallback}>
      <Text style={styles.coverFallbackIcon}>📚</Text>
    </View>
  )

  return (
    <Screen edges={['top']} testID="book-detail">
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* ── Phone: full-width blurred hero ───────────────── */}
          {!isTablet ? (
            <View style={[styles.hero, dynamic.hero]}>
              {heroBlur ? (
                <Image
                  source={heroBlur}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  blurRadius={22}
                  transition={transition}
                  accessible={false}
                />
              ) : null}
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
              <View style={styles.heroBar}>
                <Pressable
                  onPress={goBack}
                  style={[styles.heroButton, { backgroundColor: colors.overlayButton }]}
                  className="active:opacity-70"
                  accessibilityRole="button"
                  accessibilityLabel={t('a11y.back')}
                >
                  <Ionicons name="chevron-back" size={22} color={colors.onImage} />
                </Pressable>
                <Pressable
                  onPress={onToggleBookmark}
                  style={[styles.heroButton, { backgroundColor: colors.overlayButton }]}
                  className="active:opacity-70"
                  accessibilityRole="togglebutton"
                  accessibilityLabel={bookmarkLabel}
                  accessibilityState={{ checked: bookmarked }}
                >
                  <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={20} color={colors.onImage} />
                </Pressable>
              </View>
              <View style={styles.heroCover}>
                <View style={styles.heroShadow}>{coverImage}</View>
              </View>
            </View>
          ) : null}

          {/* ── Phone: title / author / chips / actions ──────── */}
          {!isTablet ? (
            <View style={styles.phoneInfo}>
              <Text className="text-2xl text-surface-900 dark:text-surface-50" style={headerTextStyle} accessibilityRole="header">
                {book.title}
              </Text>
              {author ? (
                <Text className="mt-1.5 text-sm font-semibold text-brand-600 dark:text-brand-400" style={bodyTextStyle}>
                  {t('common.by')} {author}
                </Text>
              ) : null}
              {statChips}
              <View style={styles.actionsGapPhone}>{actionButtons}</View>
            </View>
          ) : null}

          {/* ── Tablet: side-by-side ─────────────────────────── */}
          {isTablet ? (
            <View style={styles.tabletRow}>
              <View style={styles.tabletBar}>
                <Pressable
                  onPress={goBack}
                  style={styles.iconButton}
                  className="active:opacity-70"
                  accessibilityRole="button"
                  accessibilityLabel={t('a11y.back')}
                >
                  <Ionicons name="chevron-back" size={24} color={colors.brand} />
                </Pressable>
                <Pressable
                  onPress={onToggleBookmark}
                  style={styles.iconButton}
                  className="active:opacity-70"
                  accessibilityRole="togglebutton"
                  accessibilityLabel={bookmarkLabel}
                  accessibilityState={{ checked: bookmarked }}
                >
                  <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={22} color={colors.brand} />
                </Pressable>
              </View>
              <View style={elevation.raised}>{coverImage}</View>
              <View style={styles.flex}>
                <Text className="text-3xl text-surface-900 dark:text-surface-50" style={headerTextStyle} accessibilityRole="header">
                  {book.title}
                </Text>
                {author ? (
                  <Text className="mt-2 text-base font-semibold text-brand-600 dark:text-brand-400" style={bodyTextStyle}>
                    {t('common.by')} {author}
                  </Text>
                ) : null}
                {statChips}
                <View style={styles.actionsGapTablet}>{actionButtons}</View>
              </View>
            </View>
          ) : null}

          {/* ── Tab bar ──────────────────────────────────────── */}
          <View style={[dynamic.gutter, styles.tabBarWrap]}>
            <View className="flex-row rounded-card bg-surface-100 p-1 dark:bg-surface-800" accessibilityRole="tablist">
              {([
                { id: 'details' as const, label: t('books.detailsTab') },
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
          <View style={[dynamic.gutter, styles.tabContent]}>
            {activeTab === 'details' ? (
              <>
                {book.description ? (
                  <View className="rounded-card bg-white p-5 dark:bg-surface-800">
                    <Text className="mb-2 text-base text-surface-900 dark:text-surface-50" style={headerTextStyle} accessibilityRole="header">
                      {t('books.description')}
                    </Text>
                    <Text className="text-sm leading-7 text-surface-600 dark:text-surface-300" style={bodyTextStyle}>
                      {book.description}
                    </Text>
                  </View>
                ) : null}

                {related.length > 0 ? (
                  <View style={styles.related}>
                    <Text className="mb-3 text-base text-surface-900 dark:text-surface-50" style={headerTextStyle} accessibilityRole="header">
                      {t('books.related')}
                    </Text>
                    <View style={styles.relatedGrid}>
                      {related.map((item) => (
                        <View key={String(item.id)} style={dynamic.relatedCell}>
                          <BookCard book={item} variant="grid" imageWidth={Math.round(width / relatedColumns)} />
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: 48 },
  loading: { alignItems: 'center', padding: 24 },
  loadingLine: { marginTop: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  actions: { gap: 10 },
  coverFallbackIcon: { fontSize: 52, lineHeight: 68 },
  hero: { overflow: 'hidden', borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroBar: {
    position: 'absolute',
    top: 8,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  heroButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  heroCover: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 20, paddingBottom: 10 },
  heroShadow: {
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.65,
    shadowRadius: 22,
  },
  phoneInfo: { paddingHorizontal: 20, paddingTop: 22 },
  actionsGapPhone: { marginTop: 20 },
  actionsGapTablet: { marginTop: 24 },
  tabletRow: {
    flexDirection: 'row',
    gap: 28,
    paddingHorizontal: 28,
    paddingTop: 52,
    paddingBottom: 4,
    alignItems: 'flex-start',
  },
  tabletBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  tabBarWrap: { paddingTop: 24 },
  tabContent: { paddingTop: 16 },
  related: { marginTop: 24 },
  relatedGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -8 },
})
