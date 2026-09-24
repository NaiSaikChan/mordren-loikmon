import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { books as booksApi, errorCode } from '@loikmon/api'
import type { Book, BookDetail, BookQuery, Pagination } from '@loikmon/api'

export const useBooksStore = defineStore('books', () => {
  const list       = ref<Book[]>([])
  const pagination = shallowRef<Pagination | null>(null)
  const total      = shallowRef(0)
  const detail     = shallowRef<BookDetail | null>(null)
  const related    = ref<Book[]>([])
  const loading    = ref(false)
  /** Error code of the last failed detail request (e.g. NOT_FOUND, NETWORK_ERROR). */
  const detailError = ref<string | null>(null)

  let listRequest = 0

  /** Server-side filtered, 1-based page of books. Responses of superseded requests are ignored. */
  async function fetchBooks(params: BookQuery = {}) {
    const id = ++listRequest
    loading.value = true
    try {
      const { data } = await booksApi.fetchBooks(params)
      if (id === listRequest) {
        list.value = data.books ?? []
        total.value = Number(data.total ?? data.pagination?.total ?? list.value.length)
        pagination.value = data.pagination ?? null
      }
      return data
    } finally {
      if (id === listRequest) loading.value = false
    }
  }

  async function fetchDetail(id: string | number) {
    loading.value = true
    detailError.value = null
    try {
      const { data } = await booksApi.getBook(id)
      detail.value = data.book ?? null
    } catch (err) {
      detail.value = null
      detailError.value = errorCode(err)
    } finally {
      loading.value = false
    }
    return detail.value
  }

  async function fetchRelated(bookId: string | number) {
    try {
      const { data } = await booksApi.relatedBooks(bookId)
      related.value = (data.books ?? []).filter((b) => String(b.id) !== String(bookId))
    } catch {
      related.value = []
    }
  }

  function setInLibrary(inLibrary: boolean) {
    if (detail.value) detail.value = { ...detail.value, in_library: inLibrary }
  }

  return { list, pagination, total, detail, related, loading, detailError, fetchBooks, fetchDetail, fetchRelated, setInLibrary }
})
