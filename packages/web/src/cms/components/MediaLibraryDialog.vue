<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { cms } from '@loikmon/api'
import type { MediaAsset, MediaListQuery } from '@loikmon/api'
import { isImageStandard, MEDIA_STANDARDS, validateImageDimensions, type MediaAssetType, type MediaIssue } from '@loikmon/media-standards'
import MediaAssetCard from '@/cms/components/MediaAssetCard.vue'
import ModalDialog from '@/cms/components/ModalDialog.vue'
import { useToastStore } from '@/cms/stores/toast'

/**
 * Pick an asset that is already in the library — the "reuse" half of the
 * media library. Assets are filtered to the target's category; images that
 * fall below the target standard's minimum size are shown but cannot be picked.
 */
const props = defineProps<{ open: boolean; assetType: MediaAssetType }>()
const emit = defineEmits<{ close: []; select: [asset: MediaAsset] }>()

const toast = useToastStore()
const standard = computed(() => MEDIA_STANDARDS[props.assetType])

const assets = ref<MediaAsset[]>([])
const loading = ref(false)
const q = ref('')
const sameTypeOnly = ref(true)
const page = ref(1)
const hasMore = ref(false)

let searchTimer: ReturnType<typeof setTimeout> | undefined

async function load(reset = true) {
  if (reset) page.value = 1
  loading.value = true
  try {
    const params: MediaListQuery = { page: page.value, limit: 30, q: q.value || undefined, category: standard.value.category }
    if (sameTypeOnly.value) params.asset_type = props.assetType
    const { data } = await cms.media.list(params)
    assets.value = reset ? data.assets : [...assets.value, ...data.assets]
    hasMore.value = data.pagination.page * data.pagination.limit < data.pagination.total
  } catch (err) {
    toast.failure(err, 'Could not load the media library')
  } finally {
    loading.value = false
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) void load()
  },
  { immediate: true },
)
watch(sameTypeOnly, () => load())
watch(q, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => load(), 250)
})

/** The blocking dimension problem, if this image cannot serve the target standard. */
function sizeError(asset: MediaAsset): MediaIssue | null {
  const target = standard.value
  if (!isImageStandard(target) || !asset.width || !asset.height) return null
  return validateImageDimensions(target, asset.width, asset.height).find((issue) => issue.severity === 'error') ?? null
}

function disabledReason(asset: MediaAsset): string | null {
  return sizeError(asset) ? `Too small for ${standard.value.label.toLowerCase()}` : null
}

function pick(asset: MediaAsset) {
  const issue = sizeError(asset)
  if (issue) {
    toast.info('This image is too small here', issue.message)
    return
  }
  emit('select', asset)
}

function more() {
  page.value += 1
  void load(false)
}
</script>

<template>
  <ModalDialog :open="open" :title="`Choose ${standard.label.toLowerCase()}`" description="Reuse a file that is already in the media library." size="xl" @close="emit('close')">
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <input v-model="q" type="search" class="input max-w-xs" placeholder="Search by name, title or alt text" aria-label="Search the media library" />
      <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <input v-model="sameTypeOnly" type="checkbox" class="rounded text-brand-600" />
        Only {{ standard.label.toLowerCase() }} uploads
      </label>
    </div>

    <p v-if="!loading && !assets.length" class="py-12 text-center text-sm text-gray-500">
      Nothing here yet{{ sameTypeOnly ? ' — try including every ' + standard.category : '' }}.
    </p>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      <MediaAssetCard v-for="asset in assets" :key="asset.id" :asset="asset" :disabled-reason="disabledReason(asset)" @open="pick" />
    </div>

    <div class="mt-4 flex justify-center">
      <p v-if="loading" class="text-sm text-gray-500">Loading…</p>
      <button v-else-if="hasMore" type="button" class="btn-secondary h-8 px-3 text-sm" @click="more">Load more</button>
    </div>

    <template #footer>
      <button type="button" class="btn-ghost h-9 px-4 text-sm" @click="emit('close')">Cancel</button>
    </template>
  </ModalDialog>
</template>
