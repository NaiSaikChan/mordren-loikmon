<script setup lang="ts">
import { computed, ref } from 'vue'
import { cms, uploadLargeAsset } from '@loikmon/api'
import type { AssetKind } from '@loikmon/api'
import { useToastStore } from '@/cms/stores/toast'

/**
 * Upload control for one asset.
 *
 * Images go through the API (small, and the server checks the content type);
 * books and audio are PUT straight to object storage with a presigned URL, so
 * a 300 MB audiobook never passes through Node.
 *
 * The bound value is the storage **key** — never a URL — because access to
 * private files is decided per request.
 */
const props = withDefaults(
  defineProps<{
    modelValue: string | null
    kind: AssetKind
    label?: string
    accept?: string
    /** Renders an image preview; otherwise shows the file name and a play/open link. */
    preview?: 'image' | 'audio' | 'file'
    maxMb?: number
    disabled?: boolean
  }>(),
  { preview: 'image', maxMb: 1024, disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [key: string | null]; uploaded: [key: string] }>()

const toast = useToastStore()
const uploading = ref(false)
const progress = ref(0)
const previewUrl = ref<string | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

const DEFAULT_ACCEPT: Record<string, string> = {
  cover: 'image/jpeg,image/png,image/webp',
  thumbnail: 'image/jpeg,image/png,image/webp',
  avatar: 'image/jpeg,image/png,image/webp',
  slider: 'image/jpeg,image/png,image/webp',
  category: 'image/jpeg,image/png,image/webp,image/svg+xml',
  pdf: 'application/pdf',
  epub: 'application/epub+zip,.epub',
  audio: 'audio/mpeg,audio/mp4,audio/aac,audio/x-m4a,audio/ogg',
}

const IMAGE_KINDS: AssetKind[] = ['cover', 'thumbnail', 'avatar', 'slider', 'category']
const isImageKind = computed(() => IMAGE_KINDS.includes(props.kind))
const accept = computed(() => props.accept ?? DEFAULT_ACCEPT[props.kind] ?? '*/*')
const fileName = computed(() => (props.modelValue ? props.modelValue.split('/').pop() : null))

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > props.maxMb * 1024 * 1024) {
    toast.failure(new Error(`This file is larger than the ${props.maxMb} MB limit`), 'Upload rejected')
    input.value = ''
    return
  }

  uploading.value = true
  progress.value = 0
  try {
    if (isImageKind.value) {
      const { data } = await cms.media.upload(props.kind, file)
      previewUrl.value = data.public_url ?? URL.createObjectURL(file)
      emit('update:modelValue', data.key)
      emit('uploaded', data.key)
    } else {
      const result = await uploadLargeAsset(props.kind, file, (percent) => (progress.value = percent))
      previewUrl.value = null
      emit('update:modelValue', result.key)
      emit('uploaded', result.key)
    }
    toast.success(`${file.name} uploaded`)
  } catch (err) {
    toast.failure(err, 'Upload failed')
  } finally {
    uploading.value = false
    progress.value = 0
    input.value = ''
  }
}

/** Private assets need a signed URL to be previewed. */
async function openPreview() {
  if (!props.modelValue) return
  try {
    const { data } = await cms.media.signedUrl(props.modelValue)
    window.open(data.url, '_blank', 'noopener,noreferrer')
  } catch (err) {
    toast.failure(err, 'Could not open the file')
  }
}

function clear() {
  previewUrl.value = null
  emit('update:modelValue', null)
}
</script>

<template>
  <div class="rounded-xl border border-dashed border-gray-300 p-3 dark:border-gray-700">
    <div class="flex items-start gap-3">
      <div
        v-if="isImageKind"
        class="grid h-20 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-gray-100 text-xs text-gray-400 dark:bg-gray-800"
      >
        <img v-if="previewUrl" :src="previewUrl" alt="" class="h-full w-full object-cover" />
        <span v-else-if="modelValue" aria-hidden="true">✓</span>
        <span v-else aria-hidden="true">🖼</span>
      </div>

      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ label ?? kind }}</p>
        <p v-if="modelValue" class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400" :title="modelValue">
          {{ fileName }}
        </p>
        <p v-else class="mt-0.5 text-xs text-gray-400">No file selected</p>

        <div v-if="uploading" class="mt-2">
          <div class="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div class="h-full bg-brand-500 transition-[width]" :style="{ width: `${progress || 15}%` }" />
          </div>
          <p class="mt-1 text-xs text-gray-500">Uploading… {{ progress ? `${progress}%` : '' }}</p>
        </div>

        <div v-else class="mt-2 flex flex-wrap gap-2">
          <button type="button" class="btn-secondary h-7 px-2.5 text-xs" :disabled="disabled" @click="inputRef?.click()">
            {{ modelValue ? 'Replace' : 'Upload' }}
          </button>
          <button
            v-if="modelValue && !isImageKind"
            type="button"
            class="btn-ghost h-7 px-2.5 text-xs"
            @click="openPreview"
          >
            Preview
          </button>
          <button v-if="modelValue" type="button" class="btn-ghost h-7 px-2.5 text-xs text-red-600" :disabled="disabled" @click="clear">
            Remove
          </button>
        </div>
      </div>
    </div>

    <input ref="inputRef" type="file" class="sr-only" :accept="accept" :disabled="disabled || uploading" @change="onFile" />
  </div>
</template>
