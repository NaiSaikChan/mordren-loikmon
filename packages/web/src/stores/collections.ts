import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { misc } from '@loikmon/api'
import type { Collection, Pagination } from '@loikmon/api'

const PAGE_SIZE = 18

export const useCollectionsStore = defineStore('collections', () => {
  const list = ref<Collection[]>([])
  const pagination = shallowRef<Pagination | null>(null)
  const detail = shallowRef<Collection | null>(null)
  const loading = ref(false)

  async function fetchCollections(page = 1, append = false) {
    loading.value = true
    try {
      const { data } = await misc.fetchCollections(page, PAGE_SIZE)
      const items = data.collections ?? []
      list.value = append ? [...list.value, ...items] : items
      pagination.value = data.pagination ?? null
    } finally {
      loading.value = false
    }
  }

  function fetchMore() {
    const next = (pagination.value?.page ?? 1) + 1
    return fetchCollections(next, true)
  }

  async function fetchDetail(id: string | number) {
    loading.value = true
    try {
      const { data } = await misc.fetchSingleCollection(id)
      detail.value = data.collection ?? null
    } catch {
      detail.value = null
    } finally {
      loading.value = false
    }
  }

  return { list, pagination, detail, loading, fetchCollections, fetchMore, fetchDetail }
})
