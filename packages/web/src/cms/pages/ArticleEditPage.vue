<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { cms } from '@loikmon/api'
import type { CategoryNode, CmsArticleDetail, CmsAuthor, ContentVersionSummary, WorkflowStatus } from '@loikmon/api'
import FormField from '@/cms/components/FormField.vue'
import MediaPicker from '@/cms/components/MediaPicker.vue'
import PageHeader from '@/cms/components/PageHeader.vue'
import RichTextEditor from '@/cms/components/RichTextEditor.vue'
import StatusBadge from '@/cms/components/StatusBadge.vue'
import TagInput from '@/cms/components/TagInput.vue'
import { formatDate, formatNumber, fromLocalInput, toLocalInput, useConfirm } from '@/cms/composables/useCmsUi'
import { useCmsSessionStore } from '@/cms/stores/session'
import { useToastStore } from '@/cms/stores/toast'

/**
 * Article editor with the publishing workflow.
 *
 * An author without the publish right can still move a draft to "in review";
 * the button set reflects exactly what the session may do.
 */
const props = defineProps<{ id: string }>()

const router = useRouter()
const session = useCmsSessionStore()
const toast = useToastStore()
const { confirm } = useConfirm()

const articleId = computed(() => Number(props.id))
const article = ref<CmsArticleDetail | null>(null)
const loading = ref(true)
const saving = ref(false)
const showHistory = ref(false)
const authors = ref<CmsAuthor[]>([])
const categories = ref<CategoryNode[]>([])
const tagSuggestions = ref<string[]>([])

const canEdit = computed(() => session.canAny('articles.edit', 'own_content.manage'))
const canPublish = computed(() => session.canAny('articles.publish', 'own_content.publish'))

const form = reactive({
  title: '',
  excerpt: '' as string | null,
  content: '',
  author_id: null as number | null,
  category_id: null as number | null,
  subcategory_id: null as number | null,
  thumbnail_key: null as string | null,
  audio_key: null as string | null,
  og_image_key: null as string | null,
  is_free: false,
  published_at: '' as string | null,
  tags: [] as string[],
})

let pristine: Record<string, unknown> = {}

function hydrate(data: CmsArticleDetail) {
  article.value = data
  Object.assign(form, {
    title: data.title,
    excerpt: data.excerpt ?? '',
    content: data.content ?? '',
    author_id: data.author_id,
    category_id: data.category_id,
    subcategory_id: data.subcategory_id,
    thumbnail_key: data.thumbnail_key,
    audio_key: data.audio_key,
    og_image_key: data.og_image_key ?? null,
    is_free: data.is_free,
    published_at: toLocalInput(data.published_at),
    tags: [...data.tags],
  })
  pristine = JSON.parse(JSON.stringify(form))
}

async function load() {
  loading.value = true
  try {
    const [detail, authorList, categoryTree, tags] = await Promise.all([
      cms.articles.get(articleId.value),
      session.can('authors.view') ? cms.authors.list({ limit: 100 }) : Promise.resolve(null),
      session.can('categories.view') ? cms.categories.tree() : Promise.resolve(null),
      cms.tags.list().catch(() => null),
    ])
    hydrate(detail.data.article)
    authors.value = authorList?.data.authors ?? []
    categories.value = categoryTree?.data.categories ?? []
    tagSuggestions.value = tags?.data.tags.map((t) => t.name) ?? []
  } catch (err) {
    toast.failure(err, 'Could not open this article')
    void router.push({ name: 'cms-articles' })
  } finally {
    loading.value = false
  }
}

watch(articleId, () => void load(), { immediate: true })

const dirty = computed(() => JSON.stringify(form) !== JSON.stringify(pristine))
const wordCount = computed(() => form.content.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length)

const categoryOptions = computed(() => {
  const out: Array<{ id: number; label: string; parent_id: number | null }> = []
  const walk = (nodes: CategoryNode[], depth: number) => {
    for (const node of nodes) {
      if (node.type === 'article' || node.type === 'all') {
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
    if (key === 'published_at') patch[key] = fromLocalInput(String(value ?? ''))
    else if (key === 'excerpt') patch[key] = value === '' ? null : value
    else patch[key] = value
  }
  return patch
}

async function save() {
  if (!canEdit.value || !dirty.value) return
  saving.value = true
  try {
    const { data } = await cms.articles.update(articleId.value, changedFields())
    hydrate(data.article)
    toast.success('Article saved')
  } catch (err) {
    toast.failure(err, 'Could not save the article')
  } finally {
    saving.value = false
  }
}

async function setStatus(status: WorkflowStatus) {
  if (dirty.value) await save()
  try {
    await cms.articles.setStatus(articleId.value, status)
    await load()
    toast.success(`Status changed to ${status.replace('_', ' ')}`)
  } catch (err) {
    toast.failure(err, 'Could not change the status')
  }
}

async function restore(version: ContentVersionSummary) {
  const ok = await confirm({
    title: `Restore version ${version.version}?`,
    message: 'The current text is snapshotted first, so this can be undone.',
    confirmLabel: 'Restore',
  })
  if (!ok) return
  try {
    const { data } = await cms.articles.restore(articleId.value, version.version)
    hydrate(data.item)
    toast.success(`Restored version ${version.version}`)
  } catch (err) {
    toast.failure(err, 'Could not restore that version')
  }
}
</script>

<template>
  <div>
    <PageHeader
      :title="form.title || 'Article'"
      :description="article ? `Revision ${article.revision} · ${wordCount} words · updated ${formatDate(article.updated_at, true)}` : ''"
    >
      <template #actions>
        <RouterLink :to="{ name: 'cms-articles' }" class="btn-ghost h-9 no-underline">← All articles</RouterLink>
        <button v-if="canEdit" type="button" class="btn-secondary h-9" :disabled="!dirty || saving" @click="save">
          {{ saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved' }}
        </button>
        <button
          v-if="canEdit && !canPublish && article?.status === 'draft'"
          type="button"
          class="btn-primary h-9"
          @click="setStatus('in_review')"
        >
          Submit for review
        </button>
        <button v-if="canPublish && article?.status !== 'published'" type="button" class="btn-primary h-9" @click="setStatus('published')">
          Publish
        </button>
        <button v-else-if="canEdit && article" type="button" class="btn-secondary h-9" @click="setStatus('draft')">Unpublish</button>
      </template>
    </PageHeader>

    <div v-if="loading" class="space-y-3">
      <div class="skeleton h-10 w-full" />
      <div class="skeleton h-96 w-full" />
    </div>

    <template v-else-if="article">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge :status="article.status" />
        <span class="text-xs text-gray-500 dark:text-gray-400">{{ formatNumber(article.view_count) }} reads</span>
        <span class="text-xs text-gray-500 dark:text-gray-400">★ {{ article.rating_avg || '—' }} ({{ article.rating_count }})</span>
        <span v-if="article.review_note" class="badge-yellow">Note: {{ article.review_note }}</span>
        <button
          type="button"
          class="btn-ghost ml-auto h-7 px-2 text-xs"
          :aria-expanded="showHistory"
          @click="showHistory = !showHistory"
        >
          {{ showHistory ? 'Hide' : 'Show' }} history ({{ article.versions.length }})
        </button>
        <span v-if="dirty" class="badge-yellow">Unsaved changes</span>
      </div>

      <div v-if="showHistory" class="mb-4 card divide-y divide-gray-100 dark:divide-gray-800">
        <p v-if="!article.versions.length" class="p-4 text-sm text-gray-500 dark:text-gray-400">
          No earlier versions yet — one is recorded each time this article is saved.
        </p>
        <div v-for="version in article.versions" :key="version.id" class="flex flex-wrap items-center gap-3 p-3">
          <span class="badge-gray shrink-0">v{{ version.version }}</span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm">{{ version.change_note ?? 'Snapshot' }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ formatDate(version.created_at, true) }}</p>
          </div>
          <button v-if="canEdit" type="button" class="btn-secondary h-7 px-2.5 text-xs" @click="restore(version)">Restore</button>
        </div>
      </div>

      <form class="grid gap-4 lg:grid-cols-3" @submit.prevent="save">
        <div class="space-y-4 lg:col-span-2">
          <FormField v-slot="{ id }" label="Title" required>
            <input :id="id" v-model="form.title" type="text" class="input text-lg" maxlength="500" :disabled="!canEdit" required />
          </FormField>

          <FormField v-slot="{ id }" label="Excerpt" help="Leave empty to generate one from the first lines of the body.">
            <textarea :id="id" v-model="form.excerpt as string" rows="2" class="input resize-y" maxlength="1000" :disabled="!canEdit" />
          </FormField>

          <FormField label="Body" required>
            <RichTextEditor v-model="form.content" :min-height="440" :disabled="!canEdit" placeholder="Write the article…" />
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

            <FormField v-slot="{ id }" label="Tags">
              <TagInput :id="id" v-model="form.tags" :suggestions="tagSuggestions" />
            </FormField>
          </div>

          <div class="card space-y-3 p-4">
            <FormField
              v-slot="{ id }"
              label="Publication date"
              help="Set a future date and choose “Scheduled” to publish automatically."
            >
              <input :id="id" v-model="form.published_at as string" type="datetime-local" class="input" :disabled="!canEdit" />
            </FormField>

            <label class="flex items-center gap-2 text-sm">
              <input v-model="form.is_free" type="checkbox" class="rounded text-brand-600" :disabled="!canEdit" />
              Free for everyone
            </label>

            <button
              v-if="canPublish && form.published_at && article.status !== 'scheduled'"
              type="button"
              class="btn-secondary w-full"
              @click="setStatus('scheduled')"
            >
              Schedule publication
            </button>
          </div>

          <MediaPicker v-model="form.thumbnail_key" asset-type="article_cover" label="Cover image" :disabled="!canEdit" />
          <MediaPicker v-model="form.audio_key" asset-type="article_narration" label="Narration audio" :disabled="!canEdit" />
          <MediaPicker
            v-model="form.og_image_key"
            asset-type="og_image"
            label="Social share image (optional)"
            :disabled="!canEdit"
          />
        </aside>
      </form>
    </template>
  </div>
</template>
