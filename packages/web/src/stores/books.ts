import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { books as booksApi } from '@loikmon/api'
import type { Book, BookChapter } from '@loikmon/api'

export const useBooksStore = defineStore('books', () => {
  const list = ref<Book[]>([])
  const detail = shallowRef<Book | null>(null)
  const chapters = ref<BookChapter[]>([])
  const related = ref<Book[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const page = ref(1)
  const hasMore = ref(true)

  async function fetchBooks(params?: Record<string, unknown>, reset = false) {
    if (reset) { list.value = []; page.value = 1; hasMore.value = true }
    if (!hasMore.value) return
    loading.value = true
    try {
      const res = await booksApi.fetchBooks({ page: page.value, ...params })
      const incoming = res.data.data?.books ?? []
      list.value = reset ? incoming : [...list.value, ...incoming]
      if (incoming.length === 0) hasMore.value = false
      else page.value++
    } catch (e: unknown) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function fetchDetail(id: string | number) {
    loading.value = true
    try {
      const res = await booksApi.getItem(id)
      detail.value = res.data.data?.book ?? null
    } finally {
      loading.value = false
    }
  }

  async function fetchChapters(bookId: string | number) {
    const res = await booksApi.getChapters(bookId)
    chapters.value = res.data.data?.chapters ?? []
  }

  async function fetchRelated(bookId: string | number) {
    const res = await booksApi.relatedBooks(bookId)
    related.value = res.data.data?.books ?? []
  }

  async function rateBook(bookId: string | number, rating: number) {
    await booksApi.rateBook(bookId, rating)
  }

  return { list, detail, chapters, related, loading, error, hasMore,
           fetchBooks, fetchDetail, fetchChapters, fetchRelated, rateBook }
})
