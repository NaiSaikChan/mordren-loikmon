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
      list.value = body.authors ?? body.data?.authors ?? (Array.isArray(body) ? body : [])
    } finally {
      loading.value = false
    }
  }

  async function fetchDetail(id: string | number) {
    loading.value = true
    try {
      const res = await authorsApi.getAuthor(id)
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
