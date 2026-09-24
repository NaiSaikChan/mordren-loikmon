import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { media as mediaApi } from '@loikmon/api'
import type { Book, Pagination } from '@loikmon/api'

const PAGE_SIZE = 24

/** Audiobooks: books that have audio chapters. */
export const useMediaStore = defineStore('media', () => {
  const books = ref<Book[]>([])
  const pagination = shallowRef<Pagination | null>(null)
  const loading = ref(false)

  async function fetchAudioBooks(nextPage = false) {
    const page = nextPage ? (pagination.value?.page ?? 0) + 1 : 1
    loading.value = true
    try {
      const { data } = await mediaApi.fetchAudioBooks(page, PAGE_SIZE)
      const items = data.books ?? []
      books.value = nextPage ? [...books.value, ...items] : items
      pagination.value = data.pagination ?? null
    } finally {
      loading.value = false
    }
  }

  return { books, pagination, loading, fetchAudioBooks }
})
