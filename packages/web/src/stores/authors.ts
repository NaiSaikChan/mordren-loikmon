import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { authors as authorsApi } from '@loikmon/api'
import type { Author } from '@loikmon/api'

export const useAuthorsStore = defineStore('authors', () => {
  const list = ref<Author[]>([])
  const detail = shallowRef<Author | null>(null)
  const loading = ref(false)
  const totalPages = ref(1)

  async function fetchAuthors(params?: Record<string, unknown>) {
    loading.value = true
    try {
      const res = await authorsApi.fetchAuthors(params)
      const body = res.data as any
      // Handle both direct array and nested response formats
      const authors = body.authors ?? body.data?.authors ?? (Array.isArray(body) ? body : [])
      const pageNumber = Number(params?.page ?? 0)
      const shouldReplace = pageNumber <= 0

      if (shouldReplace) {
        list.value = authors
      } else {
        list.value = [...list.value, ...authors]
      }

      const nextTotalPages = Number(
        body.total_pages ??
          body.totalPages ??
          body.data?.total_pages ??
          body.data?.totalPages ??
          body.pagination?.total_pages ??
          body.pagination?.totalPages ??
          body.page_info?.total_pages ??
          body.pageInfo?.totalPages ??
          0,
      )
      const limit = Number(params?.limit ?? 0)
      const hasPotentialNextPage = limit > 0 ? authors.length >= limit : authors.length > 0

      if (nextTotalPages > 0) {
        totalPages.value = nextTotalPages
      } else if (hasPotentialNextPage || pageNumber > 0) {
        totalPages.value = Math.max(2, pageNumber + 1)
      } else {
        totalPages.value = 1
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

  return { list, detail, loading, totalPages, fetchAuthors, fetchDetail, toggleFollow }
})
