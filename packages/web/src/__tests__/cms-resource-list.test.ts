/**
 * `useResourceList` — the plumbing behind every CMS table.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useResourceList } from '../cms/composables/useResourceList'
import { useToastStore } from '../cms/stores/toast'

interface Row {
  id: number
  title: string
}

const page = (rows: Row[], total = rows.length) => ({
  rows,
  pagination: { page: 1, limit: 20, total, total_pages: 1, has_more: false },
})

describe('useResourceList', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => vi.useRealTimers())

  it('loads on creation', async () => {
    const fetcher = vi.fn().mockResolvedValue(page([{ id: 1, title: 'A' }]))
    const list = useResourceList<Row, { q: string }>({ fetcher, filters: { q: '' } })

    await flushPromises()

    expect(fetcher).toHaveBeenCalledWith({ q: '', page: 1, limit: 20 })
    expect(list.rows.value).toHaveLength(1)
    expect(list.loading.value).toBe(false)
  })

  it('debounces filter changes so typing does not spam the API', async () => {
    const fetcher = vi.fn().mockResolvedValue(page([]))
    const list = useResourceList<Row, { q: string }>({ fetcher, filters: { q: '' }, debounceMs: 200 })
    await flushPromises()
    fetcher.mockClear()

    list.filters.q = 'm'
    await nextTick()
    list.filters.q = 'mo'
    await nextTick()
    list.filters.q = 'mon'
    await nextTick()

    expect(fetcher).not.toHaveBeenCalled()
    vi.advanceTimersByTime(250)
    await flushPromises()

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith({ q: 'mon', page: 1, limit: 20 })
  })

  it('returns to page 1 when a filter changes', async () => {
    const fetcher = vi.fn().mockResolvedValue(page([]))
    const list = useResourceList<Row, { q: string }>({ fetcher, filters: { q: '' }, debounceMs: 0 })
    await flushPromises()

    list.page.value = 3
    await flushPromises()
    expect(list.page.value).toBe(3)

    list.filters.q = 'x'
    await nextTick()
    vi.advanceTimersByTime(10)
    await flushPromises()

    expect(list.page.value).toBe(1)
  })

  it('discards a stale response that arrives after a newer request', async () => {
    let resolveFirst: (value: unknown) => void = () => {}
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce(page([{ id: 2, title: 'new' }]))

    const list = useResourceList<Row, { q: string }>({ fetcher, filters: { q: '' }, debounceMs: 0 })
    await nextTick()

    list.filters.q = 'second'
    await nextTick()
    vi.advanceTimersByTime(10)
    await flushPromises()

    // The first (slow) request now finishes with old data.
    resolveFirst(page([{ id: 1, title: 'stale' }]))
    await flushPromises()

    expect(list.rows.value).toEqual([{ id: 2, title: 'new' }])
  })

  it('records an error and reports it through a toast', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('boom'))
    const list = useResourceList<Row, { q: string }>({ fetcher, filters: { q: '' } })
    await flushPromises()

    expect(list.error.value).toBe('boom')
    expect(useToastStore().toasts).toHaveLength(1)
    expect(useToastStore().toasts[0].kind).toBe('error')
  })

  it('reset() restores the original filters', async () => {
    const fetcher = vi.fn().mockResolvedValue(page([]))
    const list = useResourceList<Row, { q: string; status: string }>({
      fetcher,
      filters: { q: '', status: 'published' },
      debounceMs: 0,
    })
    await flushPromises()

    list.filters.q = 'search'
    list.filters.status = 'draft'
    await nextTick()

    list.reset()
    expect(list.filters).toMatchObject({ q: '', status: 'published' })
  })

  it('tracks selection and clears rows that leave the page', async () => {
    const fetcher = vi.fn().mockResolvedValue(page([{ id: 1, title: 'A' }, { id: 2, title: 'B' }]))
    const list = useResourceList<Row, Record<string, never>>({ fetcher, filters: {} })
    await flushPromises()

    list.toggle(1)
    expect(list.selectedIds.value).toEqual([1])
    expect(list.allSelected.value).toBe(false)

    list.toggleAll()
    expect(list.selectedIds.value).toEqual([1, 2])
    expect(list.allSelected.value).toBe(true)

    list.toggleAll()
    expect(list.selectedIds.value).toEqual([])

    // A reload that no longer contains row 2 drops it from the selection.
    list.toggle(2)
    fetcher.mockResolvedValue(page([{ id: 1, title: 'A' }]))
    await list.load()
    expect(list.selectedIds.value).toEqual([])
  })

  it('mutate() refreshes on success and announces it', async () => {
    const fetcher = vi.fn().mockResolvedValue(page([]))
    const list = useResourceList<Row, Record<string, never>>({ fetcher, filters: {} })
    await flushPromises()
    fetcher.mockClear()

    const result = await list.mutate(() => Promise.resolve('done'), { success: 'Saved' })

    expect(result).toBe('done')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(useToastStore().toasts.at(-1)).toMatchObject({ kind: 'success', message: 'Saved' })
  })

  it('mutate() rolls back an optimistic change when the request fails', async () => {
    const fetcher = vi.fn().mockResolvedValue(page([]))
    const list = useResourceList<Row, Record<string, never>>({ fetcher, filters: {} })
    await flushPromises()

    const rollback = vi.fn()
    const optimistic = vi.fn()
    const result = await list.mutate(() => Promise.reject(new Error('nope')), { optimistic, rollback })

    expect(optimistic).toHaveBeenCalled()
    expect(rollback).toHaveBeenCalled()
    expect(result).toBeNull()
    expect(useToastStore().toasts.at(-1)?.kind).toBe('error')
  })
})
