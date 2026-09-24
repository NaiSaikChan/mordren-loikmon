import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { reviews as reviewsApi } from '@loikmon/api'
import type { ItemType, Review, ReviewsResponse } from '@loikmon/api'

export const useReviewsStore = defineStore('reviews', () => {
  const list = ref<Review[]>([])
  const userReview = shallowRef<Review | null>(null)
  const summary = shallowRef<ReviewsResponse['summary']>({ average: 0, count: 0 })
  const loading = ref(false)
  let current: { type: ItemType; id: number } | null = null

  async function loadReviews(itemType: ItemType, itemId: string | number, page = 1) {
    current = { type: itemType, id: Number(itemId) }
    loading.value = true
    try {
      const { data } = await reviewsApi.loadReviews(itemType, itemId, page)
      list.value = data.reviews ?? []
      userReview.value = data.user_review ?? null
      summary.value = data.summary ?? { average: 0, count: list.value.length }
    } catch {
      list.value = []
      userReview.value = null
      summary.value = { average: 0, count: 0 }
    } finally {
      loading.value = false
    }
  }

  /** Creates or updates the viewer's review (plain text), then reloads the list. */
  async function submitReview(itemType: ItemType, itemId: string | number, rating: number, content: string) {
    const { data } = await reviewsApi.submitReview({
      item_type: itemType,
      item_id: Number(itemId),
      rating,
      content: content.trim() || null,
    })
    await loadReviews(itemType, itemId)
    return data.review
  }

  async function deleteReview(id: string | number) {
    await reviewsApi.deleteReview(id)
    list.value = list.value.filter((r) => String(r.id) !== String(id))
    if (userReview.value && String(userReview.value.id) === String(id)) userReview.value = null
    if (current) await loadReviews(current.type, current.id)
  }

  return { list, userReview, summary, loading, loadReviews, submitReview, deleteReview }
})
