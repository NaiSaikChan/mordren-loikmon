import { defineStore } from 'pinia'
import { ref } from 'vue'
import { reviews as reviewsApi } from '@loikmon/api'
import { useAuthStore } from './auth'

export const useReviewsStore = defineStore('reviews', () => {
  const list = ref<any[]>([])
  const userReview = ref<any>(null)
  const loading = ref(false)

  async function loadReviews(itmid: string | number, type: string, page = 0) {
    loading.value = true
    try {
      const auth = useAuthStore()
      const res = await reviewsApi.loadRecentReviews(itmid, type, auth.user?.email as string)
      const body = res.data as any
      list.value = body.reviews ?? []
      userReview.value = body.userreview ?? null
    } finally { loading.value = false }
  }

  async function submitReview(itmid: string | number, type: string, content: string, rating: number) {
    const auth = useAuthStore()
    const res = await reviewsApi.submitReview({
      itmid, type, content, rating,
      email: auth.user?.email as string,
    })
    const body = res.data as any
    if (body.review) list.value = [body.review, ...list.value]
    return body
  }

  async function deleteReview(id: string | number) {
    await reviewsApi.deleteReview(id)
    list.value = list.value.filter(r => String(r.id) !== String(id))
  }

  return { list, userReview, loading, loadReviews, submitReview, deleteReview }
})
