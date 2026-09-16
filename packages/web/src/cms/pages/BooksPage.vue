<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { cms } from '@loikmon/api'
import type { CmsBook, WorkflowStatus } from '@loikmon/api'
import DataTable from '@/cms/components/DataTable.vue'
import FilterBar from '@/cms/components/FilterBar.vue'
import PageHeader from '@/cms/components/PageHeader.vue'
import PagerBar from '@/cms/components/PagerBar.vue'
import StatusBadge from '@/cms/components/StatusBadge.vue'
import { downloadCsv, formatDate, formatNumber, useConfirm } from '@/cms/composables/useCmsUi'
import { useResourceList } from '@/cms/composables/useResourceList'
import { useCmsSessionStore } from '@/cms/stores/session'
import { useToastStore } from '@/cms/stores/toast'

const router = useRouter()
const session = useCmsSessionStore()
const toast = useToastStore()
const { confirm } = useConfirm()

const STATUSES: WorkflowStatus[] = ['draft', 'in_review', 'scheduled', 'published', 'archived']

const {
  rows, pagination, page, limit, loading, error, filters,
  selection, selectedIds, allSelected, load, reset, toggle, toggleAll, clearSelection, mutate,
} = useResourceList<CmsBook, { q: string; status: WorkflowStatus | ''; sort: 'updated' | 'latest' | 'title' | 'popular' }>({
  filters: { q: '', status: '', sort: 'updated' },
  fetcher: async ({ q, status, sort, page: p, limit: l }) => {
    const { data } = await cms.books.list({ q: q || undefined, status: status || undefined, sort, page: p, limit: l })
    return { rows: data.books, pagination: data.pagination }
  },
})

const canCreate = computed(() => session.canAny('books.create', 'own_content.manage'))
const canEdit = computed(() => session.canAny('books.edit', 'own_content.manage'))
const canDelete = computed(() => session.canAny('books.delete', 'own_content.manage'))
const filtersActive = computed(() => Boolean(filters.q || filters.status))

const columns = [
  { key: 'title', label: 'Title' },
  { key: 'author_name', label: 'Author', hideOnMobile: true },
  { key: 'status', label: 'Status', width: '120px' },
  { key: 'access', label: 'Access', width: '90px', hideOnMobile: true },
  { key: 'view_count', label: 'Views', align: 'right' as const, width: '90px', hideOnMobile: true },
  { key: 'updated_at', label: 'Updated', width: '120px', hideOnMobile: true },
  { key: 'actions', label: '', align: 'right' as const, width: '160px' },
]

const creating = ref(false)

/** A new book starts as an empty draft and opens straight in the editor. */
async function createDraft() {
  creating.value = true
  try {
    const authorId = session.isOwnScope ? session.authorProfiles[0]?.id : undefined
    if (session.isOwnScope && !authorId) {
      toast.failure(new Error('Your account is not linked to an author profile yet'), 'Ask an administrator to link one')
      return
    }
    const { data } = await cms.books.create({ title: 'Untitled book', status: 'draft', author_id: authorId ?? null })
    await router.push({ name: 'cms-book-edit', params: { id: data.book.id } })
  } catch (err) {
    toast.failure(err, 'Could not create the book')
  } finally {
    creating.value = false
  }
}

async function setStatus(book: CmsBook, status: WorkflowStatus) {
  await mutate(() => cms.books.setStatus(book.id, status), { success: `“${book.title}” is now ${status.replace('_', ' ')}` })
}

async function remove(book: CmsBook) {
  const ok = await confirm({
    title: 'Delete this book?',
    message: `“${book.title}” and its audiobook chapters will be removed, along with its files. This cannot be undone.`,
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return
  await mutate(() => cms.books.remove(book.id), { success: 'Book deleted' })
}

async function bulk(action: 'publish' | 'archive' | 'draft' | 'delete') {
  const ids = selectedIds.value as number[]
  if (action === 'delete') {
    const ok = await confirm({
      title: `Delete ${ids.length} book${ids.length === 1 ? '' : 's'}?`,
      message: 'Their files will be removed too. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
  }
  const result = await mutate(() => cms.books.bulk(ids, action))
  if (result) {
    const { succeeded, failed } = result.data
    if (succeeded.length) toast.success(`${succeeded.length} book${succeeded.length === 1 ? '' : 's'} updated`)
    if (failed.length) toast.failure(new Error(failed[0].message), `${failed.length} could not be updated`)
    clearSelection()
  }
}

function exportCsv() {
  downloadCsv(
    'books.csv',
    [
      { key: 'id', label: 'ID' },
      { key: 'title', label: 'Title' },
      { key: 'author_name', label: 'Author' },
      { key: 'status', label: 'Status' },
      { key: 'is_free', label: 'Free', value: (row: CmsBook) => (row.is_free ? 'yes' : 'no') },
      { key: 'view_count', label: 'Views' },
      { key: 'rating_avg', label: 'Rating' },
      { key: 'updated_at', label: 'Updated' },
    ],
    rows.value,
  )
}
</script>

<template>
  <div>
    <PageHeader
      title="Books"
      :description="session.isOwnScope ? 'Books linked to your author profile.' : 'Every book in the catalogue.'"
      :count="pagination?.total ?? null"
    >
      <template #actions>
        <button type="button" class="btn-secondary h-9" :disabled="!rows.length" @click="exportCsv">Export</button>
        <button v-if="canCreate" type="button" class="btn-primary h-9" :disabled="creating" @click="createDraft">
          {{ creating ? 'Creating…' : 'New book' }}
        </button>
      </template>
    </PageHeader>

    <FilterBar
      v-model:search="filters.q"
      placeholder="Search titles and publishers…"
      :active="filtersActive"
      :selected-count="selectedIds.length"
      @clear="reset"
    >
      <template #filters>
        <select v-model="filters.status" class="input h-9 w-auto" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option v-for="status in STATUSES" :key="status" :value="status">{{ status.replace('_', ' ') }}</option>
        </select>
        <select v-model="filters.sort" class="input h-9 w-auto" aria-label="Sort order">
          <option value="updated">Recently updated</option>
          <option value="latest">Newest first</option>
          <option value="popular">Most viewed</option>
          <option value="title">Title A–Z</option>
        </select>
      </template>

      <template #bulk>
        <button v-if="canEdit" type="button" class="btn-secondary h-8 text-xs" @click="bulk('publish')">Publish</button>
        <button v-if="canEdit" type="button" class="btn-secondary h-8 text-xs" @click="bulk('draft')">Move to draft</button>
        <button v-if="canEdit" type="button" class="btn-secondary h-8 text-xs" @click="bulk('archive')">Archive</button>
        <button v-if="canDelete" type="button" class="btn-danger h-8 text-xs" @click="bulk('delete')">Delete</button>
      </template>
    </FilterBar>

    <DataTable
      :rows="rows"
      :columns="columns"
      :loading="loading"
      :error="error"
      selectable
      :selection="selection"
      :all-selected="allSelected"
      :dimmed="(row: CmsBook) => row.status === 'archived'"
      empty-title="No books yet"
      empty-message="Create the first book, or clear the filters to see everything."
      @toggle="toggle"
      @toggle-all="toggleAll"
      @retry="load"
    >
      <template #cell-title="{ row }">
        <RouterLink :to="{ name: 'cms-book-edit', params: { id: row.id } }" class="font-medium no-underline hover:underline">
          {{ row.title }}
        </RouterLink>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ row.category_name ?? 'Uncategorised' }}
          <template v-if="row.audio_chapters_count"> · {{ row.audio_chapters_count }} chapters</template>
        </p>
      </template>

      <template #cell-author_name="{ row }">{{ row.author_name ?? '—' }}</template>
      <template #cell-status="{ row }"><StatusBadge :status="row.status" /></template>

      <template #cell-access="{ row }">
        <span :class="row.is_free ? 'badge-green' : 'badge-brand'">{{ row.is_free ? 'Free' : 'Members' }}</span>
      </template>

      <template #cell-view_count="{ row }">{{ formatNumber(row.view_count) }}</template>
      <template #cell-updated_at="{ row }">{{ formatDate(row.updated_at) }}</template>

      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-1">
          <button
            v-if="canEdit && row.status !== 'published'"
            type="button"
            class="btn-ghost h-7 px-2 text-xs"
            @click="setStatus(row, 'published')"
          >
            Publish
          </button>
          <button
            v-else-if="canEdit"
            type="button"
            class="btn-ghost h-7 px-2 text-xs"
            @click="setStatus(row, 'draft')"
          >
            Unpublish
          </button>
          <RouterLink :to="{ name: 'cms-book-edit', params: { id: row.id } }" class="btn-ghost h-7 px-2 text-xs no-underline">
            Edit
          </RouterLink>
          <button v-if="canDelete" type="button" class="btn-ghost h-7 px-2 text-xs text-red-600" @click="remove(row)">
            Delete
          </button>
        </div>
      </template>

      <template #empty-action>
        <button v-if="canCreate" type="button" class="btn-primary" @click="createDraft">New book</button>
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
