import { useCallback, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { errorMessage, reviews as reviewsApi } from '@loikmon/api'
import type { ItemType, Review, ReviewsResponse, User } from '@loikmon/api'
import { useAuth } from '@/context/AuthContext'
import { queryKeys } from '@/lib/queryClient'
import { uniqueById } from '@/lib/normalize'

export type ReviewsData = Pick<ReviewsResponse, 'reviews' | 'user_review' | 'summary'>

const EMPTY_SUMMARY = { average: 0, count: 0 }
const EMPTY_REVIEWS: Review[] = []

/** Rating summary after replacing `previous` (the viewer's old rating, if any) with `next` (null = removed). */
export function adjustSummary(
  summary: ReviewsData['summary'],
  previous: number | null,
  next: number | null,
): ReviewsData['summary'] {
  let total = summary.average * summary.count
  let count = summary.count
  if (previous != null && count > 0) {
    total -= previous
    count--
  }
  if (next != null) {
    total += next
    count++
  }
  return { average: count > 0 ? total / count : 0, count }
}

/** The viewer's review as it will look once the server accepts it. */
export function optimisticReview(existing: Review | null, user: Pick<User, 'id' | 'name'> | null, rating: number, content: string): Review {
  const now = new Date().toISOString()
  return {
    ...(existing ?? {
      id: 'pending',
      user_id: user?.id ?? '',
      username: user?.name ?? '',
      author_name: user?.name ?? '',
      avatar: null,
      created_at: now,
    }),
    rating,
    content,
    comment: content,
    updated_at: now,
  } as Review
}

/** Cache data with the viewer's review created/updated. */
export function withUserReview(data: ReviewsData, review: Review): ReviewsData {
  return {
    reviews: data.reviews.filter((r) => String(r.id) !== String(review.id)),
    user_review: review,
    summary: adjustSummary(data.summary, data.user_review?.rating ?? null, review.rating),
  }
}

/** Cache data with a review removed. */
export function withoutReview(data: ReviewsData, reviewId: string | number): ReviewsData {
  const isOwn = data.user_review != null && String(data.user_review.id) === String(reviewId)
  const removed = isOwn ? data.user_review : data.reviews.find((r) => String(r.id) === String(reviewId))
  return {
    reviews: data.reviews.filter((r) => String(r.id) !== String(reviewId)),
    user_review: isOwn ? null : data.user_review,
    summary: removed ? adjustSummary(data.summary, removed.rating, null) : data.summary,
  }
}

/**
 * Reviews of a book or article (plain text) plus the viewer's own review.
 * Submitting and deleting update the list optimistically and roll back on failure.
 */
export function useReviews(itemType: ItemType, itemId: string | number | undefined) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const id = itemId == null ? '' : String(itemId)
  const hasId = id !== ''
  const queryKey = useMemo(() => queryKeys.reviews(itemType, id, user?.id ?? ''), [itemType, id, user?.id])

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<ReviewsData> => {
      const { data } = await reviewsApi.loadReviews(itemType, id)
      return { reviews: data.reviews, user_review: data.user_review, summary: data.summary }
    },
    enabled: hasId,
  })

  /** Snapshot → optimistic update; the returned snapshot is restored on error. */
  const applyOptimistic = useCallback(
    async (update: (data: ReviewsData) => ReviewsData) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<ReviewsData>(queryKey)
      if (previous) queryClient.setQueryData<ReviewsData>(queryKey, update(previous))
      return { previous }
    },
    [queryClient, queryKey],
  )

  const rollback = useCallback(
    (context: { previous?: ReviewsData } | undefined) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
    },
    [queryClient, queryKey],
  )

  const settle = useCallback(() => queryClient.invalidateQueries({ queryKey }), [queryClient, queryKey])

  const submitMutation = useMutation({
    mutationFn: ({ rating, content }: { rating: number; content: string }) =>
      reviewsApi.submitReview({ item_type: itemType, item_id: Number(id), rating, content: content || null }),
    onMutate: ({ rating, content }) =>
      applyOptimistic((data) => withUserReview(data, optimisticReview(data.user_review, user, rating, content))),
    onError: (_err, _vars, context) => rollback(context),
    onSettled: settle,
  })

  const deleteMutation = useMutation({
    mutationFn: (reviewId: string | number) => reviewsApi.deleteReview(reviewId),
    onMutate: (reviewId) => applyOptimistic((data) => withoutReview(data, reviewId)),
    onError: (_err, _vars, context) => rollback(context),
    onSettled: settle,
  })

  const { mutateAsync: submitAsync } = submitMutation
  const submit = useCallback(
    async (rating: number, content: string) => {
      if (!hasId) return
      await submitAsync({ rating, content: content.trim() })
    },
    [hasId, submitAsync],
  )

  const { mutateAsync: deleteAsync } = deleteMutation
  /** Deletes a review (normally the viewer's own). */
  const remove = useCallback(
    async (reviewId?: string | number) => {
      const target = reviewId ?? query.data?.user_review?.id
      if (target == null) return
      await deleteAsync(target)
    },
    [deleteAsync, query.data?.user_review?.id],
  )

  const { refetch } = query
  const reload = useCallback(async () => {
    await refetch()
  }, [refetch])

  const reviews = query.data?.reviews ?? EMPTY_REVIEWS
  const userReview = query.data?.user_review ?? null
  const summary = query.data?.summary ?? EMPTY_SUMMARY

  /** The viewer's review first, then the others. */
  const displayed = useMemo(() => uniqueById([...(userReview ? [userReview] : []), ...reviews]), [reviews, userReview])

  const mutationError = submitMutation.error
    ? errorMessage(submitMutation.error, 'Failed to submit review')
    : deleteMutation.error
      ? errorMessage(deleteMutation.error, 'Failed to delete review')
      : null
  const loadError = query.error ? errorMessage(query.error, 'Failed to load reviews') : null

  return {
    reviews: displayed,
    userReview,
    summary,
    count: Math.max(summary.count, displayed.length),
    loading: query.isLoading,
    submitting: submitMutation.isPending || deleteMutation.isPending,
    error: mutationError ?? loadError,
    submit,
    remove,
    reload,
  }
}
