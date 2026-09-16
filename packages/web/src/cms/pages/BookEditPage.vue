<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { cms } from '@loikmon/api'
import type { CategoryNode, CmsAuthor, CmsBookDetail, CmsChapter, ContentVersionSummary, WorkflowStatus } from '@loikmon/api'
import FormField from '@/cms/components/FormField.vue'
import MediaPicker from '@/cms/components/MediaPicker.vue'
import ModalDialog from '@/cms/components/ModalDialog.vue'
import PageHeader from '@/cms/components/PageHeader.vue'
import RichTextEditor from '@/cms/components/RichTextEditor.vue'
import StatusBadge from '@/cms/components/StatusBadge.vue'
import TagInput from '@/cms/components/TagInput.vue'
import { formatDate, formatDuration, formatNumber, toLocalInput, useConfirm } from '@/cms/composables/useCmsUi'
import { useCmsSessionStore } from '@/cms/stores/session'
import { useToastStore } from '@/cms/stores/toast'

/**
 * Book editor: details, files, audiobook chapters and version history.
 *
 * Saving sends only the fields that actually changed, so two editors working on
 * different tabs of the same book do not overwrite each other's work.
 */
const props = defineProps<{ id: string }>()

const router = useRouter()
const session = useCmsSessionStore()
const toast = useToastStore()
const { confirm } = useConfirm()

const bookId = computed(() => Number(props.id))
const tabs = ['details', 'files', 'audiobook', 'history'] as const
type Tab = (typeof tabs)[number]
const tab = ref<Tab>('details')

const book = ref<CmsBookDetail | null>(null)
const loading = ref(true)
const saving = ref(false)
const authors = ref<CmsAuthor[]>([])
const categories = ref<CategoryNode[]>([])
const tagSuggestions = ref<string[]>([])

const canEdit = computed(() => session.canAny('books.edit', 'own_content.manage'))
const canPublish = computed(() => session.canAny('books.publish', 'own_content.publish'))

const form = reactive({
  title: '',
  description: '' as string | null,
  author_id: null as number | null,
  category_id: null as number | null,
  subcategory_id: null as number | null,
  language: 'mnw',
  pages: null as number | null,
  publisher: '' as string | null,
  published_at: '' as string | null,
  cover_key: null as string | null,
  pdf_key: null as string | null,
  epub_key: null as string | null,
  is_free: false,
  is_recommended: false,
  is_top: false,
  tags: [] as string[],
})

/** Snapshot of the loaded row, used to send only what changed. */
let pristine: Record<string, unknown> = {}

function hydrate(data: CmsBookDetail) {
  book.value = data
  Object.assign(form, {
    title: data.title,
    description: data.description ?? '',
    author_id: data.author_id,
    category_id: data.category_id,
    subcategory_id: data.subcategory_id,
    language: data.language,
    pages: data.pages,
    publisher: data.publisher ?? '',
    published_at: data.published_at ? String(data.published_at).slice(0, 10) : '',
    cover_key: data.cover_key,
    pdf_key: data.pdf_key,
    epub_key: data.epub_key,
    is_free: data.is_free,
    is_recommended: data.is_recommended,
    is_top: data.is_top,
    tags: [...data.tags],
  })
  pristine = JSON.parse(JSON.stringify(form))
}

async function load() {
  loading.value = true
  try {
    const [detail, authorList, categoryTree, tags] = await Promise.all([
      cms.books.get(bookId.value),
      session.can('authors.view') ? cms.authors.list({ limit: 100 }) : Promise.resolve(null),
      session.can('categories.view') ? cms.categories.tree() : Promise.resolve(null),
      cms.tags.list().catch(() => null),
    ])
    hydrate(detail.data.book)
    authors.value = authorList?.data.authors ?? []
    categories.value = categoryTree?.data.categories ?? []
    tagSuggestions.value = tags?.data.tags.map((t) => t.name) ?? []
  } catch (err) {
    toast.failure(err, 'Could not open this book')
    void router.push({ name: 'cms-books' })
  } finally {
    loading.value = false
  }
}

watch(bookId, () => void load(), { immediate: true })

const dirty = computed(() => JSON.stringify(form) !== JSON.stringify(pristine))

/** Flat category list for the selects, with indentation showing the tree. */
const categoryOptions = computed(() => {
  const out: Array<{ id: number; label: string; parent_id: number | null }> = []
  const walk = (nodes: CategoryNode[], depth: number) => {
    for (const node of nodes) {
      if (node.type === 'book' || node.type === 'all') {
        out.push({ id: node.id, label: `${'— '.repeat(depth)}${node.name}`, parent_id: node.parent_id })
      }
      walk(node.children, depth + 1)
    }
  }
  walk(categories.value, 0)
  return out
})

const subcategoryOptions = computed(() =>
  form.category_id ? categoryOptions.value.filter((c) => c.parent_id === form.category_id) : categoryOptions.value,
)

function changedFields(): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(form)) {
    if (JSON.stringify(value) === JSON.stringify(pristine[key])) continue
    if (key === 'published_at') patch[key] = value ? String(value) : null
    else if (key === 'publisher' || key === 'description') patch[key] = value === '' ? null : value
    else patch[key] = value
  }
  return patch
}

async function save() {
  if (!canEdit.value || !dirty.value) return
  saving.value = true
  try {
    const { data } = await cms.books.update(bookId.value, changedFields())
    hydrate(data.book)
    toast.success('Book saved')
  } catch (err) {
    toast.failure(err, 'Could not save the book')
  } finally {
    saving.value = false
  }
}

async function setStatus(status: WorkflowStatus) {
  if (dirty.value) await save()
  try {
    await cms.books.setStatus(bookId.value, status)
    await load()
    toast.success(`Status changed to ${status.replace('_', ' ')}`)
  } catch (err) {
    toast.failure(err, 'Could not change the status')
  }
}

// ── Audiobook chapters ──────────────────────────────────────────────────────

const chapterModal = ref(false)
const chapterSaving = ref(false)
const chapterForm = reactive({ id: null as number | null, title: '', audio_key: '', duration_seconds: null as number | null, is_preview: false })

function openChapter(chapter?: CmsChapter) {
  Object.assign(chapterForm, {
    id: chapter?.id ?? null,
    title: chapter?.title ?? '',
    audio_key: chapter?.audio_key ?? '',
    duration_seconds: chapter?.duration_seconds ?? null,
    is_preview: chapter?.is_preview ?? false,
  })
  chapterModal.value = true
}

async function saveChapter() {
  if (!chapterForm.title.trim() || !chapterForm.audio_key) {
    toast.failure(new Error('A title and an audio file are required'), 'Chapter not saved')
    return
  }
  chapterSaving.value = true
  try {
    const payload = {
      title: chapterForm.title,
      audio_key: chapterForm.audio_key,
      duration_seconds: chapterForm.duration_seconds,
      is_preview: chapterForm.is_preview,
    }
    if (chapterForm.id) await cms.chapters.update(chapterForm.id, payload)
    else await cms.chapters.create(bookId.value, payload)
    chapterModal.value = false
    await load()
    toast.success('Chapter saved')
  } catch (err) {
    toast.failure(err, 'Could not save the chapter')
  } finally {
    chapterSaving.value = false
  }
}

async function deleteChapter(chapter: CmsChapter) {
  const ok = await confirm({
    title: 'Delete this chapter?',
    message: `“${chapter.title}” and its audio file will be removed.`,
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return
  try {
    await cms.chapters.remove(chapter.id)
    await load()
    toast.success('Chapter deleted')
  } catch (err) {
    toast.failure(err, 'Could not delete the chapter')
  }
}

/** Simple keyboard-friendly reordering — no drag library needed. */
async function moveChapter(index: number, direction: -1 | 1) {
  const chapters = [...(book.value?.chapters ?? [])]
  const target = index + direction
  if (target < 0 || target >= chapters.length) return
  ;[chapters[index], chapters[target]] = [chapters[target], chapters[index]]
  if (book.value) book.value.chapters = chapters
  try {
    await cms.chapters.reorder(bookId.value, chapters.map((c) => c.id))
  } catch (err) {
    toast.failure(err, 'Could not reorder the chapters')
    await load()
  }
}

const totalDuration = computed(() => (book.value?.chapters ?? []).reduce((sum, c) => sum + (c.duration_seconds ?? 0), 0))

// ── Version history ─────────────────────────────────────────────────────────

async function restore(version: ContentVersionSummary) {
  const ok = await confirm({
    title: `Restore version ${version.version}?`,
    message: 'The current content is snapshotted first, so this can be undone by restoring the newer version.',
    confirmLabel: 'Restore',
  })
  if (!ok) return
  try {
    const { data } = await cms.books.restore(bookId.value, version.version)
    hydrate(data.item)
    toast.success(`Restored version ${version.version}`)
  } catch (err) {
    toast.failure(err, 'Could not restore that version')
  }
}
</script>

<template>
  <div>
    <PageHeader :title="form.title || 'Book'" :description="book ? `Revision ${book.revision} · updated ${formatDate(book.updated_at, true)}` : ''">
      <template #actions>
        <RouterLink :to="{ name: 'cms-books' }" class="btn-ghost h-9 no-underline">← All books</RouterLink>
        <button v-if="canEdit" type="button" class="btn-secondary h-9" :disabled="!dirty || saving" @click="save">
          {{ saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved' }}
        </button>
        <button
          v-if="canPublish && book?.status !== 'published'"
          type="button"
          class="btn-primary h-9"
          @click="setStatus('published')"
        >
          Publish
        </button>
        <button v-else-if="canEdit && book" type="button" class="btn-secondary h-9" @click="setStatus('draft')">Unpublish</button>
      </template>
    </PageHeader>

    <div v-if="loading" class="space-y-3">
      <div class="skeleton h-10 w-full" />
      <div class="skeleton h-72 w-full" />
    </div>

    <template v-else-if="book">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge :status="book.status" />
        <span class="text-xs text-gray-500 dark:text-gray-400">{{ formatNumber(book.view_count) }} views</span>
        <span class="text-xs text-gray-500 dark:text-gray-400">★ {{ book.rating_avg || '—' }} ({{ book.rating_count }})</span>
        <span v-if="book.review_note" class="badge-yellow">Note: {{ book.review_note }}</span>
        <span v-if="dirty" class="badge-yellow ml-auto">Unsaved changes</span>
      </div>

      <div class="mb-4 flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800" role="tablist">
        <button
          v-for="name in tabs"
          :key="name"
          type="button"
          role="tab"
          class="whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors"
          :class="tab === name
            ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'"
          :aria-selected="tab === name"
          @click="tab = name"
        >
          {{ name === 'history' ? 'Version history' : name }}
        </button>
      </div>

      <!-- ── Details ─────────────────────────────────────────────────── -->
      <form v-show="tab === 'details'" class="grid gap-4 lg:grid-cols-3" @submit.prevent="save">
        <div class="space-y-4 lg:col-span-2">
          <FormField v-slot="{ id }" label="Title" required>
            <input :id="id" v-model="form.title" type="text" class="input" maxlength="500" :disabled="!canEdit" required />
          </FormField>

          <FormField label="Description" help="Shown on the book page. Formatting is sanitised on save.">
            <RichTextEditor v-model="form.description as string" :min-height="220" :disabled="!canEdit" placeholder="Describe the book…" />
          </FormField>

          <FormField v-slot="{ id }" label="Tags" help="Used for related content and search.">
            <TagInput :id="id" v-model="form.tags" :suggestions="tagSuggestions" />
          </FormField>
        </div>

        <aside class="space-y-4">
          <div class="card space-y-4 p-4">
            <FormField v-slot="{ id }" label="Author">
              <select :id="id" v-model.number="form.author_id" class="input" :disabled="!canEdit || session.isOwnScope">
                <option :value="null">Unassigned</option>
                <option v-for="author in authors" :key="author.id" :value="author.id">{{ author.name }}</option>
              </select>
            </FormField>

            <FormField v-slot="{ id }" label="Category">
              <select :id="id" v-model.number="form.category_id" class="input" :disabled="!canEdit">
                <option :value="null">Uncategorised</option>
                <option v-for="option in categoryOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
              </select>
            </FormField>

            <FormField v-slot="{ id }" label="Subcategory">
              <select :id="id" v-model.number="form.subcategory_id" class="input" :disabled="!canEdit">
                <option :value="null">None</option>
                <option v-for="option in subcategoryOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
              </select>
            </FormField>
          </div>

          <div class="card space-y-4 p-4">
            <FormField v-slot="{ id }" label="Publisher">
              <input :id="id" v-model="form.publisher as string" type="text" class="input" maxlength="255" :disabled="!canEdit" />
            </FormField>

            <div class="grid grid-cols-2 gap-3">
              <FormField v-slot="{ id }" label="Pages">
                <input :id="id" v-model.number="form.pages" type="number" min="0" class="input" :disabled="!canEdit" />
              </FormField>
              <FormField v-slot="{ id }" label="Language">
                <input :id="id" v-model="form.language" type="text" class="input" maxlength="16" :disabled="!canEdit" />
              </FormField>
            </div>

            <FormField v-slot="{ id }" label="Publication date">
              <input :id="id" v-model="form.published_at as string" type="date" class="input" :disabled="!canEdit" />
            </FormField>
          </div>

          <div class="card space-y-2 p-4">
            <p class="text-sm font-medium text-gray-700 dark:text-gray-200">Visibility</p>
            <label class="flex items-center gap-2 text-sm">
              <input v-model="form.is_free" type="checkbox" class="rounded text-brand-600" :disabled="!canEdit" />
              Free for everyone (no subscription needed)
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input v-model="form.is_recommended" type="checkbox" class="rounded text-brand-600" :disabled="!canEdit" />
              Recommended
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input v-model="form.is_top" type="checkbox" class="rounded text-brand-600" :disabled="!canEdit" />
              Featured in the top list
            </label>
          </div>
        </aside>
      </form>

      <!-- ── Files ───────────────────────────────────────────────────── -->
      <div v-show="tab === 'files'" class="grid gap-4 md:grid-cols-3">
        <MediaPicker v-model="form.cover_key" kind="cover" label="Cover image" :disabled="!canEdit" />
        <MediaPicker v-model="form.pdf_key" kind="pdf" label="PDF edition" preview="file" :disabled="!canEdit" />
        <MediaPicker v-model="form.epub_key" kind="epub" label="EPUB edition" preview="file" :disabled="!canEdit" />
        <p class="text-xs text-gray-500 md:col-span-3 dark:text-gray-400">
          Book files live in the private bucket and are only ever served through short-lived signed links to readers with access.
          Changes here are saved with the rest of the form.
        </p>
      </div>

      <!-- ── Audiobook ───────────────────────────────────────────────── -->
      <div v-show="tab === 'audiobook'">
        <div class="mb-3 flex flex-wrap items-center gap-3">
          <p class="text-sm text-gray-600 dark:text-gray-300">
            {{ book.chapters.length }} chapter{{ book.chapters.length === 1 ? '' : 's' }}
            <span v-if="totalDuration"> · {{ formatDuration(totalDuration) }} total</span>
          </p>
          <button
            v-if="session.canAny('audiobooks.create', 'own_content.manage')"
            type="button"
            class="btn-primary ml-auto h-9"
            @click="openChapter()"
          >
            Add chapter
          </button>
        </div>

        <ol v-if="book.chapters.length" class="space-y-2">
          <li
            v-for="(chapter, index) in book.chapters"
            :key="chapter.id"
            class="card flex flex-wrap items-center gap-3 p-3"
          >
            <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gray-100 text-xs font-semibold dark:bg-gray-800">
              {{ chapter.chapter_number }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ chapter.title }}</p>
              <p class="truncate text-xs text-gray-500 dark:text-gray-400">
                {{ formatDuration(chapter.duration_seconds) }}
                <span v-if="chapter.is_preview" class="badge-green ml-1">Free preview</span>
              </p>
            </div>
            <div class="flex items-center gap-1">
              <button type="button" class="btn-ghost h-7 px-2 text-xs" :disabled="index === 0" aria-label="Move up" @click="moveChapter(index, -1)">↑</button>
              <button
                type="button"
                class="btn-ghost h-7 px-2 text-xs"
                :disabled="index === book.chapters.length - 1"
                aria-label="Move down"
                @click="moveChapter(index, 1)"
              >
                ↓
              </button>
              <button type="button" class="btn-ghost h-7 px-2 text-xs" @click="openChapter(chapter)">Edit</button>
              <button type="button" class="btn-ghost h-7 px-2 text-xs text-red-600" @click="deleteChapter(chapter)">Delete</button>
            </div>
          </li>
        </ol>

        <p v-else class="card p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          This book has no audiobook chapters yet.
        </p>
      </div>

      <!-- ── History ─────────────────────────────────────────────────── -->
      <div v-show="tab === 'history'">
        <ul v-if="book.versions.length" class="space-y-2">
          <li v-for="version in book.versions" :key="version.id" class="card flex flex-wrap items-center gap-3 p-3">
            <span class="badge-gray shrink-0">v{{ version.version }}</span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm text-gray-800 dark:text-gray-100">{{ version.change_note ?? 'Snapshot' }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ formatDate(version.created_at, true) }}</p>
            </div>
            <button v-if="canEdit" type="button" class="btn-secondary h-7 px-2.5 text-xs" @click="restore(version)">Restore</button>
          </li>
        </ul>
        <p v-else class="card p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No earlier versions yet — one is recorded each time this book is saved.
        </p>
      </div>
    </template>

    <!-- Chapter editor -->
    <ModalDialog
      :open="chapterModal"
      :title="chapterForm.id ? 'Edit chapter' : 'Add chapter'"
      :busy="chapterSaving"
      @close="chapterModal = false"
      @submit="saveChapter"
    >
      <div class="space-y-4">
        <FormField v-slot="{ id }" label="Chapter title" required>
          <input :id="id" v-model="chapterForm.title" type="text" class="input" maxlength="500" required />
        </FormField>

        <FormField label="Audio file" help="MP3, M4A, AAC or OGG. Uploaded straight to storage.">
          <MediaPicker v-model="chapterForm.audio_key" kind="audio" label="Chapter audio" preview="audio" />
        </FormField>

        <div class="grid grid-cols-2 gap-3">
          <FormField v-slot="{ id }" label="Duration (seconds)">
            <input :id="id" v-model.number="chapterForm.duration_seconds" type="number" min="0" class="input" />
          </FormField>
          <FormField label="Preview" help="Playable without a subscription.">
            <label class="mt-2 flex items-center gap-2 text-sm">
              <input v-model="chapterForm.is_preview" type="checkbox" class="rounded text-brand-600" />
              Free preview chapter
            </label>
          </FormField>
        </div>
      </div>

      <template #footer>
        <button type="button" class="btn-secondary" @click="chapterModal = false">Cancel</button>
        <button type="submit" class="btn-primary" :disabled="chapterSaving">{{ chapterSaving ? 'Saving…' : 'Save chapter' }}</button>
      </template>
    </ModalDialog>
  </div>
</template>
