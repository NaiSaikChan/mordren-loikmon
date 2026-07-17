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
  const total   = shallowRef(0)

  async function fetchBooks(params?: Record<string, unknown>): Promise<number> {
    loading.value = true
    try {
      const res = await booksApi.fetchBooks(params)
      // API returns top-level array directly in many cases, or {books:[...]}
      const body = res.data as any
      const items: Book[] = body.books ?? (Array.isArray(body) ? body : [])
      const t = body.total ?? body.data?.total ?? body.count ?? body.data?.count
      if (t != null) total.value = Number(t)
      list.value = items
      return items.length
    } finally {
      loading.value = false
    }
  }

  async function fetchDetail(id: string | number) {
    loading.value = true
    try {
      const res = await booksApi.getItem(id)
      const body = res.data as any
      detail.value = body.book ?? body.data?.book ?? null
    } finally {
      loading.value = false
    }
  }

  async function fetchChapters(bookId: string | number) {
    const res = await booksApi.getChapters(bookId)
    const body = res.data as any
    chapters.value = body.chapters ?? body.data?.chapters ?? []
  }

  async function fetchRelated(bookId: string | number) {
    const res = await booksApi.relatedBooks(bookId)
    const body = res.data as any
    related.value = body.books ?? body.data?.books ?? []
  }

  async function rateBook(bookId: string | number, rating: number) {
    await booksApi.rateBook(bookId, rating)
  }

  return { list, detail, chapters, related, loading, total, fetchBooks, fetchDetail, fetchChapters, fetchRelated, rateBook }
})
