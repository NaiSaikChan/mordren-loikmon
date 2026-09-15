import { useCallback, useEffect, useMemo, useState } from 'react'
import { errorMessage, reviews as reviewsApi } from '@loikmon/api'
import type { ItemType, Review } from '@loikmon/api'
import { useAuth } from '@/context/AuthContext'
import { uniqueById } from '@/lib/normalize'

/** Reviews of a book or article (plain text) plus the viewer's own review. */
export function useReviews(itemType: ItemType, itemId: string | number | undefined) {
  const { user } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [userReview, setUserReview] = useState<Review | null>(null)
  const [summary, setSummary] = useState<{ average: number; count: number }>({ average: 0, count: 0 })
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (itemId == null || String(itemId) === '') return
    setLoading(true)
    try {
      const { data } = await reviewsApi.loadReviews(itemType, itemId)
      setReviews(data.reviews)
      setUserReview(data.user_review)
      setSummary(data.summary)
    } catch {
      setReviews([])
      setUserReview(null)
    } finally {
      setLoading(false)
    }
  }, [itemType, itemId])

  useEffect(() => {
    void load()
  }, [load, user?.id])

  const submit = useCallback(
    async (rating: number, content: string) => {
      if (itemId == null) return
      setSubmitting(true)
      setError(null)
      try {
        await reviewsApi.submitReview({ item_type: itemType, item_id: Number(itemId), rating, content: content.trim() || null })
        await load()
      } catch (err) {
        setError(errorMessage(err, 'Failed to submit review'))
        throw err
      } finally {
        setSubmitting(false)
      }
    },
    [itemType, itemId, load],
  )

  /** The viewer's review first, then the others. */
  const displayed = useMemo(() => uniqueById([...(userReview ? [userReview] : []), ...reviews]), [reviews, userReview])

  return { reviews: displayed, userReview, summary, count: Math.max(summary.count, displayed.length), loading, submitting, error, submit, reload: load }
}
