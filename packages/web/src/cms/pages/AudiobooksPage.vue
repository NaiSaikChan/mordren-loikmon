<script setup lang="ts">
import { computed } from 'vue'
import { cms } from '@loikmon/api'
import type { CmsBook } from '@loikmon/api'
import DataTable from '@/cms/components/DataTable.vue'
import FilterBar from '@/cms/components/FilterBar.vue'
import PageHeader from '@/cms/components/PageHeader.vue'
import PagerBar from '@/cms/components/PagerBar.vue'
import StatusBadge from '@/cms/components/StatusBadge.vue'
import { formatDate, formatNumber } from '@/cms/composables/useCmsUi'
import { useResourceList } from '@/cms/composables/useResourceList'
import { useCmsSessionStore } from '@/cms/stores/session'

/**
 * Audiobook view over the same books table: the books that do (or do not yet)
 * have narration. Chapter management itself lives in the book editor, so there
 * is one place where a book's audio is edited.
 */
const session = useCmsSessionStore()

const { rows, pagination, page, limit, loading, error, filters, load, reset } = useResourceList<
  CmsBook,
  { q: string; has_audio: 'with' | 'without' | ''; sort: 'updated' | 'latest' | 'title' | 'popular' }
>({
  filters: { q: '', has_audio: 'with', sort: 'updated' },
  fetcher: async ({ q, has_audio, sort, page: p, limit: l }) => {
    const { data } = await cms.books.list({
      q: q || undefined,
      has_audio: has_audio === '' ? undefined : has_audio === 'with',
      sort,
      page: p,
      limit: l,
    })
    return { rows: data.books, pagination: data.pagination }
  },
})

const filtersActive = computed(() => Boolean(filters.q) || filters.has_audio !== 'with')

const columns = [
  { key: 'title', label: 'Book' },
  { key: 'author_name', label: 'Author', hideOnMobile: true },
  { key: 'audio_chapters_count', label: 'Chapters', align: 'right' as const, width: '100px' },
  { key: 'status', label: 'Status', width: '120px' },
  { key: 'view_count', label: 'Views', align: 'right' as const, width: '90px', hideOnMobile: true },
  { key: 'updated_at', label: 'Updated', width: '120px', hideOnMobile: true },
  { key: 'actions', label: '', align: 'right' as const, width: '130px' },
]
</script>

<template>
  <div>
    <PageHeader
      title="Audiobooks"
      description="Books with narration. Open a book to add, reorder or replace its chapters."
      :count="pagination?.total ?? null"
    />

    <FilterBar v-model:search="filters.q" placeholder="Search books…" :active="filtersActive" @clear="reset">
      <template #filters>
        <select v-model="filters.has_audio" class="input h-9 w-auto" aria-label="Audio filter">
          <option value="with">With narration</option>
          <option value="without">Without narration</option>
          <option value="">All books</option>
        </select>
        <select v-model="filters.sort" class="input h-9 w-auto" aria-label="Sort order">
          <option value="updated">Recently updated</option>
          <option value="popular">Most listened</option>
          <option value="title">Title A–Z</option>
        </select>
      </template>
    </FilterBar>

    <DataTable
      :rows="rows"
      :columns="columns"
      :loading="loading"
      :error="error"
      :empty-title="filters.has_audio === 'with' ? 'No audiobooks yet' : 'Nothing matches'"
      empty-message="Open a book and add chapters on its Audiobook tab."
      @retry="load"
    >
      <template #cell-title="{ row }">
        <RouterLink :to="{ name: 'cms-book-edit', params: { id: row.id } }" class="font-medium no-underline hover:underline">
          {{ row.title }}
        </RouterLink>
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ row.category_name ?? 'Uncategorised' }}</p>
      </template>

      <template #cell-author_name="{ row }">{{ row.author_name ?? '—' }}</template>

      <template #cell-audio_chapters_count="{ row }">
        <span :class="row.audio_chapters_count ? 'badge-brand' : 'badge-gray'">{{ row.audio_chapters_count ?? 0 }}</span>
      </template>

      <template #cell-status="{ row }"><StatusBadge :status="row.status" /></template>
      <template #cell-view_count="{ row }">{{ formatNumber(row.view_count) }}</template>
      <template #cell-updated_at="{ row }">{{ formatDate(row.updated_at) }}</template>

      <template #cell-actions="{ row }">
        <RouterLink
          :to="{ name: 'cms-book-edit', params: { id: row.id } }"
          class="btn-secondary h-7 px-2.5 text-xs no-underline"
        >
          {{ session.canAny('audiobooks.edit', 'own_content.manage') ? 'Manage chapters' : 'View' }}
        </RouterLink>
      </template>
    </DataTable>

    <PagerBar
      :pagination="pagination"
      :limit="limit"
      :loading="loading"
      @update:page="page = $event"
      @update:limit="limit = $event"
    />
  </div>
</template>
