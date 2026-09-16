<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { cms } from '@loikmon/api'
import type { CmsSlider, SliderAudience } from '@loikmon/api'
import FormField from '@/cms/components/FormField.vue'
import MediaPicker from '@/cms/components/MediaPicker.vue'
import ModalDialog from '@/cms/components/ModalDialog.vue'
import PageHeader from '@/cms/components/PageHeader.vue'
import { formatDate, fromLocalInput, toLocalInput, useConfirm } from '@/cms/composables/useCmsUi'
import { useCmsSessionStore } from '@/cms/stores/session'
import { useToastStore } from '@/cms/stores/toast'

/**
 * Home-page sliders with scheduling and audience rules.
 *
 * A slider is only shown to a reader when it is active, inside its date window
 * and its audience matches — the storefront applies exactly those three rules.
 */
const session = useCmsSessionStore()
const toast = useToastStore()
const { confirm } = useConfirm()

const AUDIENCES: Array<{ value: SliderAudience; label: string }> = [
  { value: 'all', label: 'Everyone' },
  { value: 'guests', label: 'Signed-out visitors' },
  { value: 'members', label: 'Signed-in members' },
  { value: 'subscribers', label: 'Subscribers only' },
  { value: 'non_subscribers', label: 'Non-subscribers' },
]

const sliders = ref<CmsSlider[]>([])
const loading = ref(true)
const saving = ref(false)

const canCreate = computed(() => session.can('sliders.create'))
const canEdit = computed(() => session.can('sliders.edit'))
const canDelete = computed(() => session.can('sliders.delete'))

async function load() {
  loading.value = true
  try {
    const { data } = await cms.sliders.list()
    sliders.value = data.sliders
  } catch (err) {
    toast.failure(err, 'Could not load the sliders')
  } finally {
    loading.value = false
  }
}
void load()

/** Live/scheduled/expired, derived from the same rules the storefront uses. */
function liveState(slider: CmsSlider): { label: string; tone: string } {
  const now = Date.now()
  if (!slider.is_active) return { label: 'Inactive', tone: 'badge-gray' }
  if (slider.starts_at && new Date(slider.starts_at).getTime() > now) return { label: 'Scheduled', tone: 'badge-yellow' }
  if (slider.ends_at && new Date(slider.ends_at).getTime() <= now) return { label: 'Expired', tone: 'badge-gray' }
  return { label: 'Live', tone: 'badge-green' }
}

async function move(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= sliders.value.length) return
  const next = [...sliders.value]
  ;[next[index], next[target]] = [next[target], next[index]]
  sliders.value = next
  try {
    await cms.sliders.reorder(next.map((s) => s.id))
  } catch (err) {
    toast.failure(err, 'Could not save the order')
    await load()
  }
}

async function toggleActive(slider: CmsSlider) {
  try {
    await cms.sliders.update(slider.id, { is_active: !slider.is_active })
    await load()
  } catch (err) {
    toast.failure(err, 'Could not change the visibility')
  }
}

// ── Create / edit ───────────────────────────────────────────────────────────

const modal = ref(false)
const form = reactive({
  id: null as number | null,
  title: '',
  image_key: null as string | null,
  link: '',
  is_active: true,
  starts_at: '',
  ends_at: '',
  audience: 'all' as SliderAudience,
  placement: 'home',
})

function open(slider?: CmsSlider) {
  Object.assign(form, {
    id: slider?.id ?? null,
    title: slider?.title ?? '',
    image_key: slider?.image_key ?? null,
    link: slider?.link ?? '',
    is_active: slider?.is_active ?? true,
    starts_at: toLocalInput(slider?.starts_at ?? null),
    ends_at: toLocalInput(slider?.ends_at ?? null),
    audience: slider?.audience ?? 'all',
    placement: slider?.placement ?? 'home',
  })
  modal.value = true
}

async function save() {
  if (!form.image_key) {
    toast.failure(new Error('An image is required'), 'Slider not saved')
    return
  }
  saving.value = true
  try {
    const payload = {
      title: form.title || null,
      image_key: form.image_key,
      link: form.link || null,
      is_active: form.is_active,
      starts_at: fromLocalInput(form.starts_at),
      ends_at: fromLocalInput(form.ends_at),
      audience: form.audience,
      placement: form.placement || 'home',
    }
    if (form.id) await cms.sliders.update(form.id, payload)
    else await cms.sliders.create(payload)
    modal.value = false
    await load()
    toast.success(form.id ? 'Slider updated' : 'Slider created')
  } catch (err) {
    toast.failure(err, 'Could not save the slider')
  } finally {
    saving.value = false
  }
}

async function remove(slider: CmsSlider) {
  const ok = await confirm({
    title: 'Delete this slider?',
    message: 'The banner and its image will be removed.',
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return
  try {
    await cms.sliders.remove(slider.id)
    await load()
    toast.success('Slider deleted')
  } catch (err) {
    toast.failure(err, 'Could not delete the slider')
  }
}
</script>

<template>
  <div>
    <PageHeader
      title="Sliders & banners"
      description="Scheduled home-page banners, ordered as readers see them."
      :count="sliders.length"
    >
      <template #actions>
        <button v-if="canCreate" type="button" class="btn-primary h-9" @click="open()">New slider</button>
      </template>
    </PageHeader>

    <div v-if="loading" class="grid gap-3 sm:grid-cols-2">
      <div v-for="n in 4" :key="n" class="skeleton h-40 w-full" />
    </div>

    <p v-else-if="!sliders.length" class="card p-10 text-center text-sm text-gray-500 dark:text-gray-400">
      No sliders yet. Add one to highlight a book, a collection or an announcement.
    </p>

    <ul v-else class="grid gap-3 sm:grid-cols-2">
      <li v-for="(slider, index) in sliders" :key="slider.id" class="card overflow-hidden">
        <div class="relative aspect-[21/9] bg-gray-100 dark:bg-gray-800">
          <img
            v-if="slider.image_key"
            :src="slider.image_url"
            :alt="slider.title ?? 'Slider image'"
            class="h-full w-full object-cover"
            loading="lazy"
          />
          <div class="absolute left-2 top-2 flex gap-1">
            <span :class="liveState(slider).tone">{{ liveState(slider).label }}</span>
            <span class="badge-gray">#{{ index + 1 }}</span>
          </div>
        </div>

        <div class="p-3">
          <p class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ slider.title || 'Untitled banner' }}</p>
          <p class="truncate text-xs text-gray-500 dark:text-gray-400">{{ slider.link || 'No link' }}</p>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ AUDIENCES.find((a) => a.value === slider.audience)?.label }} ·
            {{ slider.starts_at ? formatDate(slider.starts_at) : 'always' }}
            <template v-if="slider.ends_at"> → {{ formatDate(slider.ends_at) }}</template>
          </p>

          <div class="mt-3 flex flex-wrap items-center gap-1">
            <button
              v-if="canEdit"
              type="button"
              class="btn-ghost h-7 w-7 p-0 text-xs"
              :disabled="index === 0"
              aria-label="Move earlier"
              @click="move(index, -1)"
            >
              ↑
            </button>
            <button
              v-if="canEdit"
              type="button"
              class="btn-ghost h-7 w-7 p-0 text-xs"
              :disabled="index === sliders.length - 1"
              aria-label="Move later"
              @click="move(index, 1)"
            >
              ↓
            </button>
            <button v-if="canEdit" type="button" class="btn-ghost h-7 px-2 text-xs" @click="toggleActive(slider)">
              {{ slider.is_active ? 'Deactivate' : 'Activate' }}
            </button>
            <button v-if="canEdit" type="button" class="btn-ghost h-7 px-2 text-xs" @click="open(slider)">Edit</button>
            <button v-if="canDelete" type="button" class="btn-ghost h-7 px-2 text-xs text-red-600" @click="remove(slider)">
              Delete
            </button>
          </div>
        </div>
      </li>
    </ul>

    <ModalDialog
      :open="modal"
      :title="form.id ? 'Edit slider' : 'New slider'"
      :busy="saving"
      @close="modal = false"
      @submit="save"
    >
      <div class="space-y-4">
        <MediaPicker v-model="form.image_key" kind="slider" label="Banner image" />

        <FormField v-slot="{ id }" label="Title" help="Optional caption shown over the image.">
          <input :id="id" v-model="form.title" type="text" class="input" maxlength="255" />
        </FormField>

        <FormField v-slot="{ id }" label="Link" help="Where tapping the banner goes, e.g. /books/12.">
          <input :id="id" v-model="form.link" type="text" class="input" maxlength="1024" placeholder="/books/12" />
        </FormField>

        <FormField v-slot="{ id }" label="Audience" help="Who this banner is shown to.">
          <select :id="id" v-model="form.audience" class="input">
            <option v-for="audience in AUDIENCES" :key="audience.value" :value="audience.value">{{ audience.label }}</option>
          </select>
        </FormField>

        <div class="grid grid-cols-2 gap-3">
          <FormField v-slot="{ id }" label="Starts" help="Leave empty to start now.">
            <input :id="id" v-model="form.starts_at" type="datetime-local" class="input" />
          </FormField>
          <FormField v-slot="{ id }" label="Ends" help="Leave empty to run indefinitely.">
            <input :id="id" v-model="form.ends_at" type="datetime-local" class="input" />
          </FormField>
        </div>

        <label class="flex items-center gap-2 text-sm">
          <input v-model="form.is_active" type="checkbox" class="rounded text-brand-600" />
          Active
        </label>
      </div>

      <template #footer>
        <button type="button" class="btn-secondary" @click="modal = false">Cancel</button>
        <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save slider' }}</button>
      </template>
    </ModalDialog>
  </div>
</template>
