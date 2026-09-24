import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { authors as authorsApi, errorCode } from '@loikmon/api'
import type { Article, Author, Book, Id, Pagination } from '@loikmon/api'

export const useAuthorsStore = defineStore('authors', () => {
  const list        = ref<Author[]>([])
  const pagination  = shallowRef<Pagination | null>(null)
  const detail      = shallowRef<Author | null>(null)
  const books       = ref<Book[]>([])
  const articles    = ref<Article[]>([])
  const loading     = ref(false)
  const detailError = ref<string | null>(null)

  /** One 1-based page of authors (replaces the list). */
  async function fetchAuthors(params: { page?: number; limit?: number; q?: string } = {}) {
    loading.value = true
    try {
      const { data } = await authorsApi.fetchAuthors(params)
      list.value = data.authors ?? []
      pagination.value = data.pagination ?? null
      return data
    } finally {
      loading.value = false
    }
  }

  /** Author profile with their books and articles. */
  async function fetchDetail(id: Id | string) {
    loading.value = true
    detailError.value = null
    try {
      const { data } = await authorsApi.getAuthor(id)
      detail.value = data.author ?? null
      books.value = data.books ?? []
      articles.value = data.articles ?? []
    } catch (err) {
      detail.value = null
      books.value = []
      articles.value = []
      detailError.value = errorCode(err)
    } finally {
      loading.value = false
    }
    return detail.value
  }

  function patchAuthor(id: Id | string, patch: Partial<Author>) {
    if (detail.value && String(detail.value.id) === String(id)) detail.value = { ...detail.value, ...patch }
    list.value = list.value.map((a) => (String(a.id) === String(id) ? { ...a, ...patch } : a))
  }

  /** Follow or unfollow depending on the current state. Requires a signed-in user. */
  async function toggleFollow(id: Id | string) {
    const current =
      detail.value && String(detail.value.id) === String(id)
        ? detail.value
        : list.value.find((a) => String(a.id) === String(id))
    const { data } = await authorsApi.followUnfollow(id, Boolean(current?.is_following))
    patchAuthor(id, { is_following: data.is_following, followers_count: data.followers_count })
    return data.is_following
  }

  return { list, pagination, detail, books, articles, loading, detailError, fetchAuthors, fetchDetail, toggleFollow }
})
