import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { authors as authorsApi } from '@loikmon/api'
import type { Author } from '@loikmon/api'

export const useAuthorsStore = defineStore('authors', () => {
  const list = ref<Author[]>([])
  const detail = shallowRef<Author | null>(null)
  const loading = ref(false)

  async function fetchAuthors(params?: Record<string, unknown>) {
    loading.value = true
    try {
      const res = await authorsApi.fetchAuthors(params)
      const body = res.data as any
      // Handle both direct array and nested response formats
      const authors = body.authors ?? body.data?.authors ?? (Array.isArray(body) ? body : [])
      // Append on pagination (if page > 0), otherwise replace
      if (params?.page && params.page !== '0') {
        list.value = [...list.value, ...authors]
      } else {
        list.value = authors
      }
    } finally {
      loading.value = false
    }
  }

  async function fetchDetail(id: string | number, email?: string) {
    loading.value = true
    try {
      const res = await authorsApi.getAuthor(id, email)
      const body = res.data as any
      detail.value = body.author ?? body.data?.author ?? null
    } finally {
      loading.value = false
    }
  }

  async function toggleFollow(id: string | number) {
    const res = await authorsApi.followUnfollow(id)
    const body = res.data as any
    if (detail.value && detail.value.id === id) {
      detail.value = { ...detail.value, is_following: body.is_following ?? body.data?.is_following }
    }
  }

  return { list, detail, loading, fetchAuthors, fetchDetail, toggleFollow }
})
