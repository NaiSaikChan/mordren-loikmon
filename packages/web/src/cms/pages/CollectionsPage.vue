<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { cms } from '@loikmon/api'
import type { CmsCollection, ItemType } from '@loikmon/api'
import DataTable from '@/cms/components/DataTable.vue'
import FilterBar from '@/cms/components/FilterBar.vue'
import FormField from '@/cms/components/FormField.vue'
import MediaPicker from '@/cms/components/MediaPicker.vue'
import ModalDialog from '@/cms/components/ModalDialog.vue'
import PageHeader from '@/cms/components/PageHeader.vue'
import PagerBar from '@/cms/components/PagerBar.vue'
import { formatDate, useConfirm } from '@/cms/composables/useCmsUi'
import { useResourceList } from '@/cms/composables/useResourceList'
import { useCmsSessionStore } from '@/cms/stores/session'
import { useToastStore } from '@/cms/stores/toast'

/**
 * Curated and featured collections.
 *
 * The item picker searches books and articles, and the chosen order is what the
 * storefront renders — the list is stored with explicit positions.
 */
const session = useCmsSessionStore()
const toast = useToastStore()
const { confirm } = useConfirm()

const { rows, pagination, page, limit, loading, error, filters, load, reset, mutate } = useResourceList<
  CmsCollection,
  { q: string }
>({
  filters: { q: '' },
  fetcher: async ({ q, page: p, limit: l }) => {
    const { data } = await cms.collections.list({ q: q || undefined, page: p, limit: l })
    return { rows: data.collections, pagination: data.pagination }
  },
})

const canCreate = computed(() => session.can('collections.create'))
const canEdit = computed(() => session.can('collections.edit'))
const canDelete = computed(() => session.can('collections.delete'))

const columns = [
  { key: 'title', label: 'Collection' },
  { key: 'items_count', label: 'Items', align: 'right' as const, width: '80px' },
  { key: 'visibility', label: 'Visibility', width: '150px' },
  { key: 'updated_at', label: 'Updated', width: '120px', hideOnMobile: true },
  { key: 'actions', label: '', align: 'right' as const, width: '170px' },
]

// ── Details ─────────────────────────────────────────────────────────────────

const modal = ref(false)
const saving = ref(false)
const form = reactive({
  id: null as number | null,
  title: '',
  description: '' as string | null,
  thumbnail_key: null as string | null,
  is_published: true,
  is_featured: false,
})

function open(collection?: CmsCollection) {
  Object.assign(form, {
    id: collection?.id ?? null,
    title: collection?.title ?? '',
    description: collection?.description ?? '',
    thumbnail_key: collection?.thumbnail_key ?? null,
    is_published: collection?.is_published ?? true,
    is_featured: collection?.is_featured ?? false,
  })
  modal.value = true
}

async function save() {
  if (!form.title.trim()) {
    toast.failure(new Error('A title is required'), 'Collection not saved')
    return
  }
  saving.value = true
  const payload = {
    title: form.title,
    description: form.description || null,
    thumbnail_key: form.thumbnail_key,
    is_published: form.is_published,
    is_featured: form.is_featured,
  }
  const result = await mutate(() => (form.id ? cms.collections.update(form.id, payload) : cms.collections.create(payload)), {
    success: form.id ? 'Collection updated' : 'Collection created',
  })
  saving.value = false
  if (result) modal.value = false
}

async function remove(collection: CmsCollection) {
  const ok = await confirm({
    title: 'Delete this collection?',
    message: `“${collection.title}” will be removed. The books and articles inside it are not affected.`,
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return
  await mutate(() => cms.collections.remove(collection.id), { success: 'Collection deleted' })
}

// ── Item picker ─────────────────────────────────────────────────────────────

interface PickerItem {
  item_type: ItemType
  item_id: number
  title: string
}

const itemsModal = ref(false)
const itemsSaving = ref(false)
const editing = ref<CmsCollection | null>(null)
const items = ref<PickerItem[]>([])
const searchType = ref<ItemType>('book')
const searchTerm = ref('')
const searchResults = ref<PickerItem[]>([])
const searching = ref(false)

async function openItems(collection: CmsCollection) {
  editing.value = collection
  itemsModal.value = true
  items.value = []
  searchResults.value = []
  searchTerm.value = ''
  try {
    const { data } = await cms.collections.get(collection.id)
    items.value = (data.collection.items ?? []).map((i) => ({ item_type: i.item_type, item_id: i.item_id, title: i.title }))
  } catch (err) {
    toast.failure(err, 'Could not load the collection items')
  }
}

let searchTimer: number | undefined
function scheduleSearch() {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => void runSearch(), 250)
}

async function runSearch() {
  if (!searchTerm.value.trim()) {
    searchResults.value = []
    return
  }
  searching.value = true
  try {
    if (searchType.value === 'book') {
      const { data } = await cms.books.list({ q: searchTerm.value, limit: 20 })
      searchResults.value = data.books.map((b) => ({ item_type: 'book' as const, item_id: b.id, title: b.title }))
    } else {
      const { data } = await cms.articles.list({ q: searchTerm.value, limit: 20 })
      searchResults.value = data.articles.map((a) => ({ item_type: 'article' as const, item_id: a.id, title: a.title }))
    }
  } catch (err) {
    toast.failure(err, 'Search failed')
  } finally {
    searching.value = false
  }
}

function addItem(item: PickerItem) {
  if (items.value.some((i) => i.item_type === item.item_type && i.item_id === item.item_id)) return
  items.value = [...items.value, item]
}

function removeItem(index: number) {
  items.value = items.value.filter((_, i) => i !== index)
}

function moveItem(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= items.value.length) return
  const next = [...items.value]
  ;[next[index], next[target]] = [next[target], next[index]]
  items.value = next
}

async function saveItems() {
  if (!editing.value) return
  itemsSaving.value = true
  try {
    await cms.collections.setItems(
      editing.value.id,
      items.value.map((i) => ({ item_type: i.item_type, item_id: i.item_id })),
    )
    itemsModal.value = false
    await load()
    toast.success('Collection items saved')
  } catch (err) {
    toast.failure(err, 'Could not save the items')
  } finally {
    itemsSaving.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title="Collections" description="Curated and featured groups of books and articles." :count="pagination?.total ?? null">
      <template #actions>
        <button v-if="canCreate" type="button" class="btn-primary h-9" @click="open()">New collection</button>
      </template>
    </PageHeader>

    <FilterBar v-model:search="filters.q" placeholder="Search collections…" :active="Boolean(filters.q)" @clear="reset" />

    <DataTable
      :rows="rows"
      :columns="columns"
      :loading="loading"
      :error="error"
      :dimmed="(row: CmsCollection) => !row.is_published"
      empty-title="No collections yet"
      empty-message="Collections appear as curated rows on the storefront."
      @retry="load"
    >
      <template #cell-title="{ row }">
        <p class="font-medium">{{ row.title }}</p>
        <p v-if="row.description" class="line-clamp-1 text-xs text-gray-500 dark:text-gray-400">
          {{ row.description.replace(/<[^>]+>/g, ' ') }}
        </p>
      </template>

      <template #cell-items_count="{ row }">{{ row.items_count ?? 0 }}</template>

      <template #cell-visibility="{ row }">
        <span :class="row.is_published ? 'badge-green' : 'badge-gray'">{{ row.is_published ? 'Published' : 'Hidden' }}</span>
        <span v-if="row.is_featured" class="badge-brand ml-1">Featured</span>
      </template>

      <template #cell-updated_at="{ row }">{{ formatDate(row.updated_at) }}</template>

      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-1">
          <button v-if="canEdit" type="button" class="btn-ghost h-7 px-2 text-xs" @click="openItems(row)">Items</button>
          <button v-if="canEdit" type="button" class="btn-ghost h-7 px-2 text-xs" @click="open(row)">Edit</button>
          <button v-if="canDelete" type="button" class="btn-ghost h-7 px-2 text-xs text-red-600" @click="remove(row)">Delete</button>
        </div>
      </template>

      <template #empty-action>
        <button v-if="canCreate" type="button" class="btn-primary" @click="open()">New collection</button>
      </template>
    </DataTable>

    <PagerBar
      :pagination="pagination"
      :limit="limit"
      :loading="loading"
      @update:page="page = $event"
      @update:limit="limit = $event"
    />

    <!-- Details -->
    <ModalDialog
      :open="modal"
      :title="form.id ? 'Edit collection' : 'New collection'"
      :busy="saving"
      @close="modal = false"
      @submit="save"
    >
      <div class="space-y-4">
        <FormField v-slot="{ id }" label="Title" required>
          <input :id="id" v-model="form.title" type="text" class="input" maxlength="255" required />
        </FormField>

        <FormField v-slot="{ id }" label="Description">
          <textarea :id="id" v-model="form.description as string" rows="3" class="input resize-y" maxlength="2000" />
        </FormField>

        <MediaPicker v-model="form.thumbnail_key" asset-type="collection_cover" label="Cover image" />

        <div class="space-y-2">
          <label class="flex items-center gap-2 text-sm">
            <input v-model="form.is_published" type="checkbox" class="rounded text-brand-600" />
            Visible on the storefront
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="form.is_featured" type="checkbox" class="rounded text-brand-600" />
            Feature on the home page
          </label>
        </div>
      </div>

      <template #footer>
        <button type="button" class="btn-secondary" @click="modal = false">Cancel</button>
        <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save collection' }}</button>
      </template>
    </ModalDialog>

    <!-- Item picker -->
    <ModalDialog
      :open="itemsModal"
      size="lg"
      :title="`Items in “${editing?.title ?? ''}”`"
      description="The order here is the order readers see."
      :busy="itemsSaving"
      @close="itemsModal = false"
      @submit="saveItems"
    >
      <div class="grid gap-4 md:grid-cols-2">
        <section>
          <h3 class="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">In this collection ({{ items.length }})</h3>
          <ol v-if="items.length" class="space-y-1.5">
            <li
              v-for="(item, index) in items"
              :key="`${item.item_type}-${item.item_id}`"
              class="flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5 dark:border-gray-700"
            >
              <span class="badge-gray shrink-0 capitalize">{{ item.item_type }}</span>
              <span class="min-w-0 flex-1 truncate text-sm">{{ item.title }}</span>
              <button type="button" class="btn-ghost h-6 w-6 p-0 text-xs" aria-label="Move up" @click="moveItem(index, -1)">↑</button>
              <button type="button" class="btn-ghost h-6 w-6 p-0 text-xs" aria-label="Move down" @click="moveItem(index, 1)">↓</button>
              <button type="button" class="btn-ghost h-6 w-6 p-0 text-xs text-red-600" aria-label="Remove" @click="removeItem(index)">×</button>
            </li>
          </ol>
          <p v-else class="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
            Nothing added yet.
          </p>
        </section>

        <section>
          <h3 class="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Add content</h3>
          <div class="mb-2 flex gap-2">
            <select v-model="searchType" class="input h-9 w-28" aria-label="Content type" @change="scheduleSearch">
              <option value="book">Books</option>
              <option value="article">Articles</option>
            </select>
            <input
              v-model="searchTerm"
              type="search"
              class="input h-9"
              placeholder="Search by title…"
              aria-label="Search content"
              @input="scheduleSearch"
            />
          </div>

          <p v-if="searching" class="py-4 text-center text-sm text-gray-500">Searching…</p>
          <ul v-else-if="searchResults.length" class="max-h-72 space-y-1 overflow-y-auto">
            <li v-for="result in searchResults" :key="`${result.item_type}-${result.item_id}`">
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                @click="addItem(result)"
              >
                <span class="shrink-0 text-brand-600">+</span>
                <span class="min-w-0 flex-1 truncate">{{ result.title }}</span>
              </button>
            </li>
          </ul>
          <p v-else class="py-4 text-center text-sm text-gray-400">
            {{ searchTerm ? 'No matches' : 'Type to search the catalogue' }}
          </p>
        </section>
      </div>

      <template #footer>
        <button type="button" class="btn-secondary" @click="itemsModal = false">Cancel</button>
        <button type="submit" class="btn-primary" :disabled="itemsSaving">
          {{ itemsSaving ? 'Saving…' : `Save ${items.length} item${items.length === 1 ? '' : 's'}` }}
        </button>
      </template>
    </ModalDialog>
  </div>
</template>
