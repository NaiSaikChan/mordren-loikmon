import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { ItemType, Review } from '@loikmon/api'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { PrimaryButton } from '@/components/PrimaryButton'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
import type { useReviews } from '@/hooks/useReviews'

export function ReviewStars({
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
        const star = <Ionicons name={filled ? 'star' : 'star-outline'} size={size} color={filled ? '#f59e0b' : '#cbd5e1'} />
        if (!onChange) return <View key={value}>{star}</View>
        return (
          <Pressable key={value} onPress={() => onChange(value)} hitSlop={8} accessibilityLabel={`${value}`}>
            {star}
          </Pressable>
        )
      })}
    </View>
  )
}

function ReviewCard({ review, highlighted = false }: { review: Review; highlighted?: boolean }) {
  const { t } = useI18n()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const author = review.author_name || review.username || t('common.anonymous')
  const content = review.content || review.comment || ''

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
          {content ? (
            <Text className="mt-1 text-sm leading-6 text-surface-600 dark:text-surface-300" style={bodyTextStyle}>
              {content}
            </Text>
          ) : null}
        </View>
        <Text className="text-xs text-surface-400" style={bodyTextStyle}>
          {review.created_at ? new Date(review.created_at).toLocaleDateString() : ''}
        </Text>
      </View>
      <View className="mt-3 flex-row items-center justify-between">
        <ReviewStars rating={Number(review.rating ?? 0)} size={16} />
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

/** Write-a-review form + review list for a book or article. */
export function ReviewsSection({
  reviews,
  itemType,
}: {
  reviews: ReturnType<typeof useReviews>
  itemType: ItemType
}) {
  const { t } = useI18n()
  const { isLoggedIn } = useAuth()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const [text, setText] = useState('')
  const [rating, setRating] = useState(5)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const onSubmit = async () => {
    setMessage(null)
    try {
      await reviews.submit(rating, text)
      setText('')
      setMessage({ ok: true, text: t('books.reviewSubmitted') })
    } catch {
      setMessage({ ok: false, text: reviews.error ?? t('books.reviewSubmitFailed') })
    }
  }

  return (
    <View>
      {isLoggedIn ? (
        <View className="rounded-2xl bg-white dark:bg-surface-800 p-5">
          <Text className="mb-3 text-base text-surface-900 dark:text-surface-50" style={headerTextStyle}>
            {reviews.userReview ? t('common.edit') : t('books.writeReview')}
          </Text>
          <View className="mb-4">
            <ReviewStars rating={rating} onChange={setRating} />
          </View>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('books.reviewPlaceholder')}
            placeholderTextColor="#94a3b8"
            multiline
            maxLength={5000}
            textAlignVertical="top"
            className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 text-surface-900 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-50"
            style={[bodyTextStyle, { minHeight: 110, textAlignVertical: 'top' }]}
          />
          <View className="mt-3 flex-row items-center justify-between gap-3">
            <Text
              className={`flex-1 text-sm ${message?.ok === false ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}
              style={bodyTextStyle}
            >
              {message?.text ?? ''}
            </Text>
            <PrimaryButton
              label={reviews.submitting ? t('common.submitting') : t('books.submitReview')}
              loading={reviews.submitting}
              onPress={onSubmit}
              labelClassName="text-sm"
              labelStyle={headerTextStyle}
            />
          </View>
        </View>
      ) : (
        <View className="rounded-2xl bg-white dark:bg-surface-800 p-5 items-center">
          <Text className="mb-3 text-center text-surface-600 dark:text-surface-300" style={bodyTextStyle}>
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
        <Text className="mb-3 text-base text-surface-900 dark:text-surface-50" style={headerTextStyle}>
          {t('books.reviewsTab', { count: reviews.count })}
        </Text>
        {reviews.loading && reviews.reviews.length === 0 ? (
          <LoadingSpinner />
        ) : reviews.reviews.length > 0 ? (
          <View style={{ gap: 12 }}>
            {reviews.reviews.map((review) => (
              <ReviewCard
                key={String(review.id)}
                review={review}
                highlighted={String(reviews.userReview?.id ?? '') === String(review.id)}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            icon="💬"
            title={t('books.noReviews')}
            subtitle={itemType === 'article' ? t('articles.noReviewsHint') : t('books.noReviewsHint')}
          />
        )}
      </View>
    </View>
  )
}
