import { computed, reactive, ref, watch, type Ref } from 'vue'
import type { Pagination } from '@loikmon/api'
import { useToastStore } from '@/cms/stores/toast'

export interface ResourceListOptions<TRow, TFilters extends Record<string, unknown>> {
  /** Runs the request. Receives the merged filters plus page and limit. */
  fetcher: (params: TFilters & { page: number; limit: number }) => Promise<{ rows: TRow[]; pagination?: Pagination }>
  /** Starting filter values; `reset()` returns to exactly these. */
  filters: TFilters
  limit?: number
  /** Debounce applied to filter changes, so typing in a search box is cheap. */
  debounceMs?: number
  immediate?: boolean
}

/**
 * List-page plumbing shared by every CMS table: filters, paging, selection,
 * loading and error state, and refresh-after-mutation.
 *
 * Requests are sequenced: a response that arrives after a newer request was
 * issued is discarded, so fast typing cannot leave stale rows on screen.
 */
export function useResourceList<TRow extends { id: string | number }, TFilters extends Record<string, unknown>>(
  options: ResourceListOptions<TRow, TFilters>,
) {
  const toast = useToastStore()
  const rows = ref([]) as Ref<TRow[]>
  const pagination = ref<Pagination | null>(null)
  const page = ref(1)
  const limit = ref(options.limit ?? 20)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const selection = ref<Set<string | number>>(new Set())
  const initial = { ...options.filters }
  const filters = reactive({ ...options.filters }) as TFilters

  let requestId = 0
  let debounceTimer: number | undefined

  async function load() {
    const current = ++requestId
    loading.value = true
    error.value = null
    try {
      const result = await options.fetcher({ ...(filters as TFilters), page: page.value, limit: limit.value })
      if (current !== requestId) return // a newer request is in flight
      rows.value = result.rows
      pagination.value = result.pagination ?? null
      // Drop selections for rows that are no longer listed.
      const visible = new Set(result.rows.map((r) => r.id))
      selection.value = new Set([...selection.value].filter((id) => visible.has(id)))
    } catch (err) {
      if (current !== requestId) return
      error.value = toastAndMessage(err)
    } finally {
      if (current === requestId) loading.value = false
    }
  }

  function toastAndMessage(err: unknown): string {
    toast.failure(err, 'Could not load the list')
    return err instanceof Error ? err.message : 'Could not load the list'
  }

  function scheduleLoad() {
    window.clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(() => void load(), options.debounceMs ?? 250)
  }

  watch(
    () => ({ ...(filters as Record<string, unknown>) }),
    () => {
      page.value = 1
      scheduleLoad()
    },
    { deep: true },
  )

  watch([page, limit], () => void load())

  function reset() {
    Object.assign(filters, initial)
    page.value = 1
  }

  // ── Selection ────────────────────────────────────────────────────────────

  const selectedIds = computed(() => [...selection.value])
  const allSelected = computed(() => rows.value.length > 0 && rows.value.every((r) => selection.value.has(r.id)))

  function toggle(id: string | number) {
    const next = new Set(selection.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selection.value = next
  }

  function toggleAll() {
    selection.value = allSelected.value ? new Set() : new Set(rows.value.map((r) => r.id))
  }

  function clearSelection() {
    selection.value = new Set()
  }

  /**
   * Runs a mutation, then refreshes. The optimistic patch is applied straight
   * away and rolled back if the request fails, so the table feels immediate.
   */
  async function mutate<T>(
    action: () => Promise<T>,
    hooks: { optimistic?: () => void; rollback?: () => void; success?: string; refresh?: boolean } = {},
  ): Promise<T | null> {
    hooks.optimistic?.()
    try {
      const result = await action()
      if (hooks.success) toast.success(hooks.success)
      if (hooks.refresh !== false) await load()
      return result
    } catch (err) {
      hooks.rollback?.()
      toast.failure(err)
      return null
    }
  }

  if (options.immediate !== false) void load()

  return {
    rows,
    pagination,
    page,
    limit,
    loading,
    error,
    filters,
    selection,
    selectedIds,
    allSelected,
    load,
    reset,
    toggle,
    toggleAll,
    clearSelection,
    mutate,
  }
}
