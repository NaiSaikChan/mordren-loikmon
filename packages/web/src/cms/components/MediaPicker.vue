<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { cms } from '@loikmon/api'
import type { MediaAsset, MediaIssue, ResponsiveImage } from '@loikmon/api'
import {
  acceptForAssetType,
  describeStandard,
  formatBytes,
  IMAGE_STANDARDS,
  isImageAssetType,
  MEDIA_STANDARDS,
  type MediaAssetType,
} from '@loikmon/media-standards'
import MediaLibraryDialog from '@/cms/components/MediaLibraryDialog.vue'
import MediaThumb from '@/cms/components/MediaThumb.vue'
import { prepareFile, releasePreview, uploadMedia, type PreparedFile } from '@/cms/composables/useMediaUpload'
import { useToastStore } from '@/cms/stores/toast'

/**
 * Upload control for one asset slot, driven entirely by its asset standard
 * (@loikmon/media-standards): accepted formats, size limit, minimum
 * dimensions, aspect-ratio frame, circular display and preview rules.
 *
 * The file is validated in the browser first, uploaded (images are processed
 * into variants server-side), and the thumbnail is shown straight away. An
 * existing file can be reused from the media library instead.
 *
 * The bound value is the storage **key** — never a URL — because access to
 * private files is decided per request.
 */
const props = withDefaults(
  defineProps<{
    modelValue: string | null
    assetType: MediaAssetType
    /** Defaults to the standard's label. */
    label?: string
    disabled?: boolean
    /** Hide the spec line (e.g. in dense tables). */
    compact?: boolean
  }>(),
  { disabled: false, compact: false },
)

const emit = defineEmits<{ 'update:modelValue': [key: string | null]; uploaded: [key: string, asset: MediaAsset | null] }>()

const toast = useToastStore()
const standard = computed(() => MEDIA_STANDARDS[props.assetType])
const imageStandard = computed(() => (isImageAssetType(props.assetType) ? IMAGE_STANDARDS[props.assetType] : null))
const accept = computed(() => acceptForAssetType(props.assetType))
const spec = computed(() => describeStandard(props.assetType))

const inputRef = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const progress = ref(0)
const dragging = ref(false)
const libraryOpen = ref(false)

/** What is currently shown for `modelValue`. */
const display = ref<{ key: string; image: ResponsiveImage | null; url: string | null; name: string; bytes: number | null; color: string | null } | null>(null)
/** A picked file waiting for confirmation (preview-required standards, or warnings to acknowledge). */
const pending = ref<PreparedFile | null>(null)
const errors = ref<MediaIssue[]>([])
const warnings = ref<MediaIssue[]>([])

/** Thumbnail width by shape: wide banners get more room than portrait covers. */
const thumbWidth = computed(() => {
  const ratio = imageStandard.value?.aspectRatio
  if (!ratio) return 88
  const r = ratio.width / ratio.height
  return r >= 2 ? 176 : r > 1.2 ? 136 : r >= 1 ? 88 : 72
})

function showAsset(asset: MediaAsset) {
  display.value = {
    key: asset.key,
    image: asset.image,
    url: asset.url,
    name: asset.original_name,
    bytes: asset.size_bytes,
    color: asset.dominant_color,
  }
}

/** Load display data for a key that came from the record (edit forms). */
async function resolve(key: string | null) {
  if (!key) {
    display.value = null
    return
  }
  if (display.value?.key === key) return
  display.value = { key, image: null, url: null, name: key.split('/').pop() ?? key, bytes: null, color: null }
  try {
    const { data } = await cms.media.resolve([key])
    const item = data.items[0]
    if (!item || props.modelValue !== key) return
    if (item.registered) showAsset(item.asset)
    else display.value = { ...display.value, image: item.image, url: item.url }
  } catch {
    // The key is still bound; only the preview is missing.
  }
}
watch(() => props.modelValue, resolve, { immediate: true })

async function handleFile(file: File) {
  if (props.disabled || uploading.value) return
  errors.value = []
  warnings.value = []
  releasePreview(pending.value)
  pending.value = null

  const prepared = await prepareFile(props.assetType, file)
  if (!prepared.validation.ok) {
    errors.value = prepared.validation.errors
    releasePreview(prepared)
    toast.failure(new Error(prepared.validation.errors[0]!.message), 'Upload rejected')
    return
  }
  warnings.value = prepared.validation.warnings
  if (imageStandard.value?.previewRequired) {
    // Hero banners are checked in their display frame before anything is uploaded.
    pending.value = prepared
    return
  }
  await upload(prepared)
}

async function upload(prepared: PreparedFile) {
  uploading.value = true
  progress.value = 0
  try {
    const result = await uploadMedia(props.assetType, prepared.file, { onProgress: (p) => (progress.value = p) })
    if (result.asset) showAsset(result.asset)
    else display.value = { key: result.key, image: null, url: prepared.previewUrl, name: prepared.file.name, bytes: prepared.file.size, color: null }
    warnings.value = result.warnings
    emit('update:modelValue', result.key)
    emit('uploaded', result.key, result.asset)
    toast.success(result.reused ? `${prepared.file.name} was already in the library — reused it` : `${prepared.file.name} uploaded`)
  } catch (err) {
    toast.failure(err, 'Upload failed')
  } finally {
    uploading.value = false
    progress.value = 0
    if (pending.value === prepared) pending.value = null
    // Keep the object URL only while it is the thumbnail being shown.
    if (display.value?.url !== prepared.previewUrl) releasePreview(prepared)
  }
}

function onInput(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) void handleFile(file)
}

function onDrop(event: DragEvent) {
  dragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) void handleFile(file)
}

function cancelPending() {
  releasePreview(pending.value)
  pending.value = null
  warnings.value = []
}

function onLibrarySelect(asset: MediaAsset) {
  libraryOpen.value = false
  errors.value = []
  warnings.value = []
  showAsset(asset)
  emit('update:modelValue', asset.key)
}

/** Private assets need a signed URL to be previewed. */
async function openFile() {
  if (!props.modelValue) return
  try {
    const url = display.value?.url ?? (await cms.media.signedUrl(props.modelValue)).data.url
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch (err) {
    toast.failure(err, 'Could not open the file')
  }
}

function clear() {
  display.value = null
  warnings.value = []
  emit('update:modelValue', null)
}

onBeforeUnmount(() => releasePreview(pending.value))
</script>

<template>
  <div
    class="rounded-xl border border-dashed p-3 transition"
    :class="dragging ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/20' : 'border-gray-300 dark:border-gray-700'"
    @dragover.prevent="!disabled && (dragging = true)"
    @dragleave.prevent="dragging = false"
    @drop.prevent="onDrop"
  >
    <div class="flex items-start gap-3">
      <MediaThumb
        v-if="imageStandard"
        :image="display?.image"
        :src="display && !display.image ? display.url : null"
        :asset-type="assetType"
        :width="thumbWidth"
        :placeholder-color="display?.color"
        :alt="`${label ?? standard.label} preview`"
      >
        <template #empty>{{ display ? '✓' : '🖼' }}</template>
      </MediaThumb>
      <span
        v-else
        class="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-gray-100 text-2xl dark:bg-gray-800"
        aria-hidden="true"
      >
        {{ standard.category === 'audio' ? '🎧' : '📄' }}
      </span>

      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ label ?? standard.label }}</p>
        <p v-if="display" class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400" :title="display.key">
          {{ display.name }}<template v-if="display.bytes"> · {{ formatBytes(display.bytes) }}</template>
        </p>
        <p v-else class="mt-0.5 text-xs text-gray-400">No file selected — drop one here</p>
        <p v-if="!compact" class="mt-0.5 text-[11px] text-gray-400" :title="standard.usage.join(', ')">{{ spec }}</p>

        <div v-if="uploading" class="mt-2" role="status">
          <div class="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div class="h-full bg-brand-500 transition-[width]" :style="{ width: `${progress || 15}%` }" />
          </div>
          <p class="mt-1 text-xs text-gray-500">
            {{ progress >= 100 && imageStandard ? 'Optimizing…' : `Uploading… ${progress ? `${progress}%` : ''}` }}
          </p>
        </div>

        <div v-else-if="!pending" class="mt-2 flex flex-wrap gap-2">
          <button type="button" class="btn-secondary h-7 px-2.5 text-xs" :disabled="disabled" @click="inputRef?.click()">
            {{ modelValue ? 'Replace' : 'Upload' }}
          </button>
          <button type="button" class="btn-ghost h-7 px-2.5 text-xs" :disabled="disabled" @click="libraryOpen = true">From library</button>
          <button v-if="modelValue && !imageStandard" type="button" class="btn-ghost h-7 px-2.5 text-xs" @click="openFile">Preview</button>
          <button v-if="modelValue" type="button" class="btn-ghost h-7 px-2.5 text-xs text-red-600" :disabled="disabled" @click="clear">
            Remove
          </button>
        </div>
      </div>
    </div>

    <!-- Preview in the display frame before a hero banner is uploaded. -->
    <div v-if="pending && imageStandard" class="mt-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/60">
      <p class="mb-2 text-xs font-medium text-gray-600 dark:text-gray-300">
        Preview — {{ imageStandard.label }} ({{ imageStandard.aspectRatio?.label }}) · {{ pending.width }}×{{ pending.height }}
      </p>
      <div
        class="mx-auto overflow-hidden bg-gray-900 shadow-inner"
        :class="assetType === 'hero_mobile' ? 'max-w-[220px] rounded-[1.25rem] border-4 border-gray-800' : 'max-w-full rounded-md border border-gray-700'"
        :style="{ aspectRatio: imageStandard.aspectRatio ? `${imageStandard.aspectRatio.width} / ${imageStandard.aspectRatio.height}` : undefined }"
      >
        <img :src="pending.previewUrl ?? undefined" alt="" class="h-full w-full object-cover" />
      </div>
      <div class="mt-3 flex justify-end gap-2">
        <button type="button" class="btn-ghost h-7 px-2.5 text-xs" @click="cancelPending">Cancel</button>
        <button type="button" class="btn-primary h-7 px-3 text-xs" @click="upload(pending)">Use this image</button>
      </div>
    </div>

    <ul v-if="errors.length || warnings.length" class="mt-2 space-y-1 text-xs" aria-live="polite">
      <li v-for="issue in errors" :key="issue.code" class="text-red-600 dark:text-red-400">✕ {{ issue.message }}</li>
      <li v-for="issue in warnings" :key="issue.code" class="text-amber-600 dark:text-amber-400">! {{ issue.message }}</li>
    </ul>

    <input ref="inputRef" type="file" class="sr-only" :accept="accept" :disabled="disabled || uploading" tabindex="-1" @change="onInput" />
    <MediaLibraryDialog v-if="libraryOpen" :open="libraryOpen" :asset-type="assetType" @close="libraryOpen = false" @select="onLibrarySelect" />
  </div>
</template>
