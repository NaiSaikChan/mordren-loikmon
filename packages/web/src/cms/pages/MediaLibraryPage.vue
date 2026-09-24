<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { cms } from '@loikmon/api'
import type { Id, MediaAsset, MediaAssetDetail, MediaFolder, MediaListQuery, MediaStats, Pagination } from '@loikmon/api'
import {
  BULK_UPLOAD_MAX_FILES,
  detectFormat,
  DIRECT_UPLOAD_THRESHOLD,
  formatBytes,
  MEDIA_STANDARDS,
  RESPONSIVE_VARIANTS,
  THUMBNAIL_WIDTHS,
  type MediaAssetType,
  type MediaCategory,
} from '@loikmon/media-standards'
import FilterBar from '@/cms/components/FilterBar.vue'
import FormField from '@/cms/components/FormField.vue'
import MediaAssetCard from '@/cms/components/MediaAssetCard.vue'
import MediaThumb from '@/cms/components/MediaThumb.vue'
import ModalDialog from '@/cms/components/ModalDialog.vue'
import PageHeader from '@/cms/components/PageHeader.vue'
import PagerBar from '@/cms/components/PagerBar.vue'
import StatCard from '@/cms/components/StatCard.vue'
import { formatDate, useConfirm } from '@/cms/composables/useCmsUi'
import { prepareFile, releasePreview, uploadMedia } from '@/cms/composables/useMediaUpload'
import { useCmsSessionStore } from '@/cms/stores/session'
import { useToastStore } from '@/cms/stores/toast'

/**
 * Media library: every file uploaded through the CMS, with folders, search,
 * filters, drag-and-drop bulk upload, reuse tracking and unused-file cleanup.
 * Formats, limits and asset types all come from @loikmon/media-standards.
 */
const session = useCmsSessionStore()
const toast = useToastStore()
const { confirm } = useConfirm()

const canDelete = computed(() => session.can('media.delete'))

// ── Filters & listing ───────────────────────────────────────────────────────

const LIMIT = 40
const filters = reactive({
  q: '',
  folder: 'all' as 'all' | 'root' | Id,
  category: '' as '' | MediaCategory,
  asset_type: '' as '' | MediaAssetType,
  usage: '' as '' | 'used' | 'unused',
  sort: 'latest' as NonNullable<MediaListQuery['sort']>,
  page: 1,
})

const CATEGORIES: Array<{ value: MediaCategory; label: string }> = [
  { value: 'image', label: 'Images' },
  { value: 'document', label: 'Documents' },
  { value: 'audio', label: 'Audio' },
]

/** Asset types for the type filter, narrowed to the chosen category. */
const typeOptions = computed(() =>
  (Object.entries(MEDIA_STANDARDS) as Array<[MediaAssetType, (typeof MEDIA_STANDARDS)[MediaAssetType]]>)
    .filter(([, standard]) => !filters.category || standard.category === filters.category)
    .map(([value, standard]) => ({ value, label: standard.label })),
)

const assets = ref<MediaAsset[]>([])
const pagination = ref<Pagination | null>(null)
const loading = ref(false)
const stats = ref<MediaStats | null>(null)

const filtered = computed(() => Boolean(filters.q || filters.category || filters.asset_type || filters.usage))

async function load() {
  loading.value = true
  try {
    const params: MediaListQuery = { page: filters.page, limit: LIMIT, sort: filters.sort }
    if (filters.q) params.q = filters.q
    if (filters.folder !== 'all') params.folder = filters.folder
    if (filters.category) params.category = filters.category
    if (filters.asset_type) params.asset_type = filters.asset_type
    if (filters.usage) params.usage = filters.usage
    const { data } = await cms.media.list(params)
    assets.value = data.assets
    pagination.value = data.pagination
    selected.value = new Set([...selected.value].filter((id) => data.assets.some((a) => a.id === id)))
  } catch (err) {
    toast.failure(err, 'Could not load the media library')
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    stats.value = (await cms.media.stats()).data.stats
  } catch {
    stats.value = null
  }
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => filters.q,
  () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      filters.page = 1
      void load()
    }, 250)
  },
)
watch(
  () => [filters.folder, filters.category, filters.asset_type, filters.usage, filters.sort],
  () => {
    if (filters.asset_type && filters.category && MEDIA_STANDARDS[filters.asset_type].category !== filters.category) filters.asset_type = ''
    filters.page = 1
    void load()
  },
)
watch(() => filters.page, () => void load())

function clearFilters() {
  Object.assign(filters, { q: '', category: '', asset_type: '', usage: '', page: 1 })
}

async function refresh() {
  await Promise.all([load(), loadStats(), loadFolders()])
}

// ── Folders ─────────────────────────────────────────────────────────────────

const folders = ref<MediaFolder[]>([])
const unfiledCount = ref(0)

async function loadFolders() {
  try {
    const { data } = await cms.media.folders.list()
    folders.value = data.folders
    unfiledCount.value = data.unfiled_count
  } catch (err) {
    toast.failure(err, 'Could not load the folders')
  }
}

/** Folders in tree order with their depth, for an indented list. */
const folderTree = computed(() => {
  const children = new Map<Id | null, MediaFolder[]>()
  for (const folder of folders.value) {
    const list = children.get(folder.parent_id) ?? []
    list.push(folder)
    children.set(folder.parent_id, list)
  }
  const out: Array<MediaFolder & { depth: number }> = []
  const walk = (parent: Id | null, depth: number) => {
    for (const folder of children.get(parent) ?? []) {
      out.push({ ...folder, depth })
      walk(folder.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
})

const currentFolder = computed(() => (typeof filters.folder === 'number' ? folders.value.find((f) => f.id === filters.folder) ?? null : null))

const folderModal = reactive({ open: false, id: null as Id | null, name: '', parent_id: null as Id | null, saving: false })

function openFolder(folder?: MediaFolder) {
  Object.assign(folderModal, {
    open: true,
    id: folder?.id ?? null,
    name: folder?.name ?? '',
    parent_id: folder ? folder.parent_id : (currentFolder.value?.id ?? null),
  })
}

async function saveFolder() {
  folderModal.saving = true
  try {
    const payload = { name: folderModal.name.trim(), parent_id: folderModal.parent_id }
    if (folderModal.id) await cms.media.folders.update(folderModal.id, payload)
    else {
      const { data } = await cms.media.folders.create(payload)
      filters.folder = data.folder.id
    }
    folderModal.open = false
    await loadFolders()
  } catch (err) {
    toast.failure(err, 'Could not save the folder')
  } finally {
    folderModal.saving = false
  }
}

async function deleteFolder(folder: MediaFolder) {
  const ok = await confirm({
    title: `Delete “${folder.name}”?`,
    message: 'Files inside move to the parent folder. Nothing is deleted from storage.',
    confirmLabel: 'Delete folder',
    danger: true,
  })
  if (!ok) return
  try {
    await cms.media.folders.remove(folder.id)
    if (filters.folder === folder.id) filters.folder = folder.parent_id ?? 'all'
    await refresh()
  } catch (err) {
    toast.failure(err, 'Could not delete the folder')
  }
}

// ── Selection & bulk actions ────────────────────────────────────────────────

const selected = ref(new Set<Id>())
const moveTarget = ref<'root' | Id>('root')

function toggle(asset: MediaAsset) {
  const next = new Set(selected.value)
  if (next.has(asset.id)) next.delete(asset.id)
  else next.add(asset.id)
  selected.value = next
}

function selectAll() {
  selected.value = selected.value.size === assets.value.length ? new Set() : new Set(assets.value.map((a) => a.id))
}

async function moveSelected() {
  try {
    const { data } = await cms.media.move([...selected.value], moveTarget.value === 'root' ? null : moveTarget.value)
    toast.success(`Moved ${data.moved} file${data.moved === 1 ? '' : 's'}`)
    selected.value = new Set()
    await refresh()
  } catch (err) {
    toast.failure(err, 'Could not move the files')
  }
}

async function deleteAssets(ids: Id[]) {
  const ok = await confirm({
    title: `Delete ${ids.length} file${ids.length === 1 ? '' : 's'}?`,
    message: 'The originals and every generated size are removed from storage. Files still used by content are skipped.',
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return false
  try {
    const { data } = await cms.media.bulkRemove(ids)
    if (data.in_use.length) {
      const names = data.in_use.map((item) => `${item.original_name} (${item.usages.map((u) => u.entity_label ?? u.label).join(', ')})`)
      const force = await confirm({
        title: `${data.in_use.length} file${data.in_use.length === 1 ? ' is' : 's are'} still in use`,
        message: `${names.slice(0, 5).join('; ')}${names.length > 5 ? '…' : ''}. Deleting will leave broken images on that content.`,
        confirmLabel: 'Delete anyway',
        danger: true,
      })
      if (force) {
        const forced = await cms.media.bulkRemove(
          data.in_use.map((item) => item.id),
          { force: true },
        )
        data.deleted.push(...forced.data.deleted)
      }
    }
    if (data.deleted.length) toast.success(`Deleted ${data.deleted.length} file${data.deleted.length === 1 ? '' : 's'}`)
    selected.value = new Set()
    await refresh()
    return true
  } catch (err) {
    toast.failure(err, 'Could not delete the files')
    return false
  }
}

// ── Upload (button + drag and drop) ─────────────────────────────────────────

interface QueueItem {
  name: string
  state: 'waiting' | 'uploading' | 'done' | 'failed'
  message?: string
}

const uploadInput = ref<HTMLInputElement | null>(null)
const uploadType = ref<'auto' | MediaAssetType>('auto')
const queue = ref<QueueItem[]>([])
const uploading = ref(false)
const dragDepth = ref(0)

/** A free-form type for library uploads, chosen from the file's own format. */
function autoType(file: File): MediaAssetType | null {
  const format = detectFormat(file.type, file.name)
  if (!format) return null
  if (format.id === 'pdf') return 'book_pdf'
  if (format.id === 'epub') return 'book_epub'
  if (format.category === 'audio') return 'audio_chapter'
  return format.vector ? 'brand_logo' : 'library_image'
}

async function uploadFiles(fileList: FileList | File[]) {
  const files = [...fileList]
  if (!files.length || uploading.value) return
  uploading.value = true
  queue.value = files.map((file) => ({ name: file.name, state: 'waiting' }))
  const folderId = typeof filters.folder === 'number' ? filters.folder : null

  // Validate in the browser first; batch what passes through the bulk endpoint.
  const batch: Array<{ index: number; file: File; type: MediaAssetType }> = []
  for (const [index, file] of files.entries()) {
    const type = uploadType.value === 'auto' ? autoType(file) : uploadType.value
    if (!type) {
      queue.value[index] = { name: file.name, state: 'failed', message: 'Unsupported file format' }
      continue
    }
    const prepared = await prepareFile(type, file)
    releasePreview(prepared)
    if (!prepared.validation.ok) {
      queue.value[index] = { name: file.name, state: 'failed', message: prepared.validation.errors[0]!.message }
      continue
    }
    if (MEDIA_STANDARDS[type].category !== 'image' && file.size > DIRECT_UPLOAD_THRESHOLD) {
      // Too large for the API: straight to storage, one at a time.
      queue.value[index] = { name: file.name, state: 'uploading' }
      try {
        await uploadMedia(type, file, { folderId })
        queue.value[index] = { name: file.name, state: 'done' }
      } catch (err) {
        queue.value[index] = { name: file.name, state: 'failed', message: (err as Error).message }
      }
      continue
    }
    batch.push({ index, file, type })
  }

  // The bulk endpoint takes one asset type per request.
  const groups = new Map<MediaAssetType, typeof batch>()
  for (const item of batch) groups.set(item.type, [...(groups.get(item.type) ?? []), item])
  for (const [type, items] of groups) {
    for (let start = 0; start < items.length; start += BULK_UPLOAD_MAX_FILES) {
      const chunk = items.slice(start, start + BULK_UPLOAD_MAX_FILES)
      chunk.forEach(({ index, file }) => (queue.value[index] = { name: file.name, state: 'uploading' }))
      try {
        const { data } = await cms.media.bulkUpload(
          chunk.map((c) => c.file),
          { assetType: type, folderId },
        )
        data.results.forEach((result, i) => {
          queue.value[chunk[i]!.index] = result.ok
            ? { name: result.name, state: 'done', message: result.reused ? 'Already in the library' : undefined }
            : { name: result.name, state: 'failed', message: result.error?.message }
        })
      } catch (err) {
        chunk.forEach(({ index, file }) => (queue.value[index] = { name: file.name, state: 'failed', message: (err as Error).message }))
      }
    }
  }

  const done = queue.value.filter((q) => q.state === 'done').length
  const failed = queue.value.filter((q) => q.state === 'failed').length
  if (done) toast.success(`Uploaded ${done} file${done === 1 ? '' : 's'}`, failed ? `${failed} failed — see the list` : undefined)
  else if (failed) toast.failure(new Error(`${failed} file${failed === 1 ? '' : 's'} could not be uploaded`), 'Upload failed')
  uploading.value = false
  await refresh()
}

function onUploadInput(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files) void uploadFiles(input.files)
  input.value = ''
}

function onDrop(event: DragEvent) {
  dragDepth.value = 0
  if (event.dataTransfer?.files?.length) void uploadFiles(event.dataTransfer.files)
}

// ── Details ─────────────────────────────────────────────────────────────────

const detail = ref<MediaAssetDetail | null>(null)
const detailForm = reactive({ title: '', alt_text: '', folder_id: null as Id | null })
const detailSaving = ref(false)

async function openDetail(asset: MediaAsset) {
  try {
    const { data } = await cms.media.get(asset.id)
    detail.value = data.asset
    Object.assign(detailForm, { title: data.asset.title ?? '', alt_text: data.asset.alt_text ?? '', folder_id: data.asset.folder_id })
  } catch (err) {
    toast.failure(err, 'Could not open this file')
  }
}

async function saveDetail() {
  if (!detail.value) return
  detailSaving.value = true
  try {
    await cms.media.update(detail.value.id, {
      title: detailForm.title.trim() || null,
      alt_text: detailForm.alt_text.trim() || null,
      folder_id: detailForm.folder_id,
    })
    detail.value = null
    toast.success('File details saved')
    await refresh()
  } catch (err) {
    toast.failure(err, 'Could not save the details')
  } finally {
    detailSaving.value = false
  }
}

async function copy(text: string | null) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Copied to the clipboard')
  } catch {
    toast.info('Copy this value', text)
  }
}

async function openPrivate(asset: MediaAsset) {
  try {
    const { data } = await cms.media.signedUrl(asset.key)
    window.open(data.url, '_blank', 'noopener,noreferrer')
  } catch (err) {
    toast.failure(err, 'Could not open the file')
  }
}

async function deleteDetail() {
  if (!detail.value) return
  if (await deleteAssets([detail.value.id])) detail.value = null
}

/** Where a usage can be edited in the CMS. */
function usageRoute(entityType: string, entityId: string) {
  const routes: Record<string, { name: string; params?: Record<string, string> }> = {
    book: { name: 'cms-book-edit', params: { id: entityId } },
    audio_chapter: { name: 'cms-audiobooks' },
    article: { name: 'cms-article-edit', params: { id: entityId } },
    author: { name: 'cms-authors' },
    category: { name: 'cms-categories' },
    collection: { name: 'cms-collections' },
    slider: { name: 'cms-sliders' },
    plan: { name: 'cms-membership' },
    coupon: { name: 'cms-coupon-detail', params: { id: entityId } },
    policy: { name: 'cms-policies' },
    user: { name: 'cms-users' },
    setting: { name: 'cms-settings' },
  }
  return routes[entityType] ?? null
}

const variantRows = computed(() => {
  const asset = detail.value
  if (!asset) return []
  const order = [...RESPONSIVE_VARIANTS, 'webp', 'og']
  return order
    .map((name) => ({ name, variant: asset.variants[name] }))
    .filter((row): row is { name: string; variant: NonNullable<typeof row.variant> } => Boolean(row.variant))
})

/** Bytes a reader saves by getting the full-size WebP instead of the original. */
const savings = computed(() => {
  const webp = detail.value?.variants.webp
  if (!detail.value || !webp || webp.bytes >= detail.value.size_bytes) return null
  return Math.round((1 - webp.bytes / detail.value.size_bytes) * 100)
})

void refresh()
</script>

<template>
  <div
    class="relative"
    @dragenter.prevent="dragDepth++"
    @dragleave.prevent="dragDepth = Math.max(0, dragDepth - 1)"
    @dragover.prevent
    @drop.prevent="onDrop"
  >
    <PageHeader
      title="Media library"
      description="Every image, document and audio file uploaded to the CMS. Drop files anywhere on this page to upload them."
      :count="pagination?.total ?? null"
    >
      <template #actions>
        <select v-model="uploadType" class="input h-9 w-auto text-sm" aria-label="Upload as">
          <option value="auto">Upload as: detect from file</option>
          <option v-for="option in Object.entries(MEDIA_STANDARDS)" :key="option[0]" :value="option[0]">
            Upload as: {{ option[1].label }}
          </option>
        </select>
        <button type="button" class="btn-primary" :disabled="uploading" @click="uploadInput?.click()">
          {{ uploading ? 'Uploading…' : 'Upload files' }}
        </button>
        <input ref="uploadInput" type="file" multiple class="sr-only" tabindex="-1" @change="onUploadInput" />
      </template>
    </PageHeader>

    <div v-if="stats" class="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Files" :value="stats.assets" />
      <StatCard label="Storage used" :value="formatBytes(stats.total_bytes)" :hint="`${formatBytes(stats.original_bytes)} originals + generated sizes`" />
      <StatCard label="Images" :value="stats.by_category.image?.count ?? 0" :hint="`${stats.by_category.document?.count ?? 0} documents · ${stats.by_category.audio?.count ?? 0} audio`" />
      <StatCard label="Unused" :value="stats.unused.count" :hint="`${formatBytes(stats.unused.bytes)} reclaimable`" />
    </div>

    <div v-if="queue.length" class="card mb-4 p-3">
      <div class="mb-2 flex items-center justify-between">
        <p class="text-sm font-medium text-gray-700 dark:text-gray-200">Uploads</p>
        <button v-if="!uploading" type="button" class="btn-ghost h-7 px-2 text-xs" @click="queue = []">Dismiss</button>
      </div>
      <ul class="max-h-48 space-y-1 overflow-y-auto text-xs" aria-live="polite">
        <li v-for="(item, i) in queue" :key="i" class="flex items-center gap-2">
          <span aria-hidden="true">{{ { waiting: '⏳', uploading: '⬆️', done: '✅', failed: '⚠️' }[item.state] }}</span>
          <span class="truncate text-gray-700 dark:text-gray-200">{{ item.name }}</span>
          <span v-if="item.message" class="truncate" :class="item.state === 'failed' ? 'text-red-600' : 'text-gray-500'">— {{ item.message }}</span>
        </li>
      </ul>
    </div>

    <div class="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <!-- Folders -->
      <aside class="card h-fit p-2" aria-label="Folders">
        <div class="mb-1 flex items-center justify-between px-2 py-1">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Folders</p>
          <button type="button" class="btn-ghost h-7 px-2 text-xs" @click="openFolder()">+ New</button>
        </div>
        <ul class="space-y-0.5 text-sm">
          <li>
            <button type="button" class="folder-row" :class="{ active: filters.folder === 'all' }" @click="filters.folder = 'all'">
              <span>🗂️ All files</span>
            </button>
          </li>
          <li>
            <button type="button" class="folder-row" :class="{ active: filters.folder === 'root' }" @click="filters.folder = 'root'">
              <span>📥 Unfiled</span><span class="text-xs text-gray-400">{{ unfiledCount }}</span>
            </button>
          </li>
          <li v-for="folder in folderTree" :key="folder.id" class="group flex items-center">
            <button
              type="button"
              class="folder-row flex-1"
              :class="{ active: filters.folder === folder.id }"
              :style="{ paddingLeft: `${0.5 + folder.depth * 0.9}rem` }"
              @click="filters.folder = folder.id"
            >
              <span class="truncate">📁 {{ folder.name }}</span><span class="text-xs text-gray-400">{{ folder.asset_count }}</span>
            </button>
            <button type="button" class="btn-ghost h-7 w-7 shrink-0 p-0 text-xs opacity-0 group-hover:opacity-100 focus:opacity-100" :aria-label="`Rename ${folder.name}`" @click="openFolder(folder)">✎</button>
            <button
              v-if="canDelete"
              type="button"
              class="btn-ghost h-7 w-7 shrink-0 p-0 text-xs text-red-600 opacity-0 group-hover:opacity-100 focus:opacity-100"
              :aria-label="`Delete ${folder.name}`"
              @click="deleteFolder(folder)"
            >
              ×
            </button>
          </li>
        </ul>
      </aside>

      <section class="min-w-0">
        <FilterBar
          v-model:search="filters.q"
          placeholder="Search by file name, title or alt text"
          :active="filtered"
          :selected-count="selected.size"
          @clear="clearFilters"
        >
          <template #filters>
            <select v-model="filters.category" class="input h-9 w-auto text-sm" aria-label="File type">
              <option value="">All types</option>
              <option v-for="c in CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
            </select>
            <select v-model="filters.asset_type" class="input h-9 w-auto text-sm" aria-label="Used as">
              <option value="">Any purpose</option>
              <option v-for="t in typeOptions" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
            <select v-model="filters.usage" class="input h-9 w-auto text-sm" aria-label="Usage">
              <option value="">Used and unused</option>
              <option value="used">In use</option>
              <option value="unused">Unused</option>
            </select>
            <select v-model="filters.sort" class="input h-9 w-auto text-sm" aria-label="Sort">
              <option value="latest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name</option>
              <option value="largest">Largest</option>
            </select>
            <button v-if="assets.length" type="button" class="btn-ghost h-9 px-3 text-xs" @click="selectAll">
              {{ selected.size === assets.length ? 'Select none' : 'Select page' }}
            </button>
          </template>

          <template #bulk>
            <select v-model="moveTarget" class="input h-8 w-auto text-xs" aria-label="Move to folder">
              <option value="root">Unfiled</option>
              <option v-for="folder in folderTree" :key="folder.id" :value="folder.id">{{ '— '.repeat(folder.depth) }}{{ folder.name }}</option>
            </select>
            <button type="button" class="btn-secondary h-8 px-3 text-xs" @click="moveSelected">Move</button>
            <button v-if="canDelete" type="button" class="btn-danger h-8 px-3 text-xs" @click="deleteAssets([...selected])">Delete</button>
          </template>
        </FilterBar>

        <div
          v-if="dragDepth > 0"
          class="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-2xl border-2 border-dashed border-brand-500 bg-brand-50/80 text-lg font-medium text-brand-700 dark:bg-brand-950/70 dark:text-brand-200"
        >
          Drop to upload{{ currentFolder ? ` into “${currentFolder.name}”` : '' }}
        </div>

        <p v-if="loading && !assets.length" class="py-16 text-center text-sm text-gray-500">Loading…</p>
        <div v-else-if="!assets.length" class="card grid place-items-center gap-2 p-12 text-center">
          <p class="text-3xl" aria-hidden="true">🖼️</p>
          <p class="text-sm text-gray-600 dark:text-gray-300">{{ filtered ? 'No files match these filters.' : 'No files here yet.' }}</p>
          <p class="text-xs text-gray-500">Drag files onto this page or use “Upload files”.</p>
        </div>
        <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6" :class="{ 'opacity-60': loading }">
          <MediaAssetCard
            v-for="asset in assets"
            :key="asset.id"
            :asset="asset"
            selectable
            :selected="selected.has(asset.id)"
            @toggle="toggle"
            @open="openDetail"
          />
        </div>

        <PagerBar :pagination="pagination" :limit="LIMIT" :loading="loading" @update:page="filters.page = $event" />
      </section>
    </div>

    <!-- Folder create / rename -->
    <ModalDialog
      :open="folderModal.open"
      :title="folderModal.id ? 'Rename folder' : 'New folder'"
      size="sm"
      :busy="folderModal.saving"
      @close="folderModal.open = false"
      @submit="saveFolder"
    >
      <div class="space-y-4">
        <FormField v-slot="{ id }" label="Name" required>
          <input :id="id" v-model="folderModal.name" type="text" class="input" maxlength="120" required />
        </FormField>
        <FormField v-slot="{ id }" label="Inside">
          <select :id="id" v-model="folderModal.parent_id" class="input">
            <option :value="null">Top level</option>
            <option v-for="folder in folderTree.filter((f) => f.id !== folderModal.id)" :key="folder.id" :value="folder.id">
              {{ '— '.repeat(folder.depth) }}{{ folder.name }}
            </option>
          </select>
        </FormField>
      </div>
      <template #footer>
        <button type="button" class="btn-secondary" @click="folderModal.open = false">Cancel</button>
        <button type="submit" class="btn-primary" :disabled="folderModal.saving || !folderModal.name.trim()">Save</button>
      </template>
    </ModalDialog>

    <!-- Details -->
    <ModalDialog
      :open="Boolean(detail)"
      :title="detail?.title || detail?.original_name || 'File'"
      :description="detail ? `${detail.asset_type_label} · uploaded ${formatDate(detail.created_at)}` : undefined"
      size="lg"
      :busy="detailSaving"
      @close="detail = null"
      @submit="saveDetail"
    >
      <div v-if="detail" class="grid gap-5 md:grid-cols-[minmax(0,1fr)_16rem]">
        <div class="space-y-4">
          <div class="grid place-items-center rounded-xl bg-gray-50 p-4 dark:bg-gray-800/60">
            <MediaThumb
              v-if="detail.category === 'image'"
              :image="detail.image"
              :alt="detail.alt_text ?? ''"
              :width="320"
              :shape="detail.display === 'circle' ? 'circle' : 'rounded'"
              :placeholder-color="detail.dominant_color"
              fit="contain"
            />
            <div v-else class="py-6 text-center">
              <p class="text-5xl" aria-hidden="true">{{ detail.category === 'audio' ? '🎧' : '📄' }}</p>
              <button type="button" class="btn-secondary mt-3 h-8 px-3 text-xs" @click="openPrivate(detail)">Open file</button>
            </div>
          </div>

          <FormField v-slot="{ id }" label="Title">
            <input :id="id" v-model="detailForm.title" type="text" class="input" maxlength="255" />
          </FormField>
          <FormField
            v-if="detail.category === 'image'"
            v-slot="{ id }"
            label="Alt text"
            help="Describe the image for screen readers and search engines."
          >
            <textarea :id="id" v-model="detailForm.alt_text" rows="2" class="input resize-y" maxlength="500" />
          </FormField>
          <FormField v-slot="{ id }" label="Folder">
            <select :id="id" v-model="detailForm.folder_id" class="input">
              <option :value="null">Unfiled</option>
              <option v-for="folder in folderTree" :key="folder.id" :value="folder.id">{{ '— '.repeat(folder.depth) }}{{ folder.name }}</option>
            </select>
          </FormField>

          <div>
            <p class="mb-1 text-sm font-medium text-gray-700 dark:text-gray-200">Used by ({{ detail.usage_count }})</p>
            <p v-if="!detail.usages.length" class="text-xs text-gray-500">Not used anywhere — safe to delete.</p>
            <ul v-else class="space-y-1 text-sm">
              <li v-for="usage in detail.usages" :key="`${usage.reference}-${usage.entity_id}`" class="flex items-center gap-2">
                <span class="badge-gray">{{ usage.label }}</span>
                <RouterLink
                  v-if="usageRoute(usage.entity_type, usage.entity_id)"
                  :to="usageRoute(usage.entity_type, usage.entity_id)!"
                  class="truncate text-brand-600 hover:underline"
                  @click="detail = null"
                >
                  {{ usage.entity_label || `#${usage.entity_id}` }}
                </RouterLink>
                <span v-else class="truncate">{{ usage.entity_label || `#${usage.entity_id}` }}</span>
              </li>
            </ul>
          </div>
        </div>

        <dl class="space-y-2 text-xs">
          <div>
            <dt class="text-gray-500">File</dt>
            <dd class="break-all text-gray-800 dark:text-gray-100">{{ detail.original_name }}</dd>
          </div>
          <div>
            <dt class="text-gray-500">Format</dt>
            <dd class="text-gray-800 dark:text-gray-100">
              {{ detail.format.toUpperCase() }}<template v-if="detail.width"> · {{ detail.width }}×{{ detail.height }}</template>
              · {{ formatBytes(detail.size_bytes) }}
            </dd>
          </div>
          <div v-if="savings !== null">
            <dt class="text-gray-500">Optimization</dt>
            <dd class="text-emerald-700 dark:text-emerald-400">WebP delivery is {{ savings }}% smaller than the original</dd>
          </div>
          <div v-if="variantRows.length">
            <dt class="text-gray-500">Generated sizes</dt>
            <dd>
              <ul class="mt-1 space-y-0.5">
                <li v-for="row in variantRows" :key="row.name" class="flex items-center justify-between gap-2">
                  <a v-if="row.variant.url" :href="row.variant.url" target="_blank" rel="noopener" class="font-mono text-brand-600 hover:underline">
                    {{ row.name }}
                  </a>
                  <span class="text-gray-500">
                    {{ row.variant.width }}×{{ row.variant.height }} · {{ formatBytes(row.variant.bytes) }}
                  </span>
                </li>
              </ul>
              <p class="mt-1 text-[11px] text-gray-400">
                Responsive widths: {{ RESPONSIVE_VARIANTS.map((v) => `${v} ${THUMBNAIL_WIDTHS[v]}px`).join(', ') }}
              </p>
            </dd>
          </div>
          <div>
            <dt class="text-gray-500">Storage key</dt>
            <dd class="flex items-start gap-1">
              <code class="break-all text-[11px] text-gray-700 dark:text-gray-300">{{ detail.key }}</code>
              <button type="button" class="btn-ghost h-6 shrink-0 px-1.5 text-[11px]" @click="copy(detail.key)">Copy</button>
            </dd>
          </div>
          <div v-if="detail.url">
            <dt class="text-gray-500">Public URL</dt>
            <dd><button type="button" class="btn-ghost h-6 px-1.5 text-[11px]" @click="copy(detail.image?.src ?? detail.url)">Copy URL</button></dd>
          </div>
        </dl>
      </div>

      <template #footer>
        <button v-if="canDelete" type="button" class="btn-danger mr-auto" :disabled="detailSaving" @click="deleteDetail">Delete</button>
        <button type="button" class="btn-secondary" @click="detail = null">Close</button>
        <button type="submit" class="btn-primary" :disabled="detailSaving">Save details</button>
      </template>
    </ModalDialog>
  </div>
</template>

<style scoped>
.folder-row {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  border-radius: 0.5rem;
  padding: 0.375rem 0.5rem;
  text-align: left;
  color: rgb(55 65 81);
}
.folder-row:hover {
  background: rgb(243 244 246);
}
.folder-row.active {
  background: rgb(238 242 255);
  color: rgb(67 56 202);
  font-weight: 500;
}
:global(.dark) .folder-row {
  color: rgb(209 213 219);
}
:global(.dark) .folder-row:hover {
  background: rgb(31 41 55);
}
:global(.dark) .folder-row.active {
  background: rgb(49 46 129 / 0.35);
  color: rgb(199 210 254);
}
</style>
