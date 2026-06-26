<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useBooksStore } from '@/stores/books'
import { useI18n } from 'vue-i18n'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const props = defineProps<{ id: string }>()
const { t } = useI18n()
const store = useBooksStore()
const pdfError = ref(false)

function fixUrl(url: string): string {
  if (!url) return ''
  let u = url.replace(/\\/g, '/')
  u = u.replace(/\u202f/gi, '%E2%80%AF').replace(/ /g, '%20')
  return u
}

const book    = computed(() => store.detail)
const pdfUrl  = computed(() => fixUrl(store.detail?.pdf ?? ''))
const viewerUrl = computed(() => {
  if (!pdfUrl.value) return ''
  return `https://docs.google.com/viewer?url=${encodeURIComponent(pdfUrl.value)}&embedded=true`
})

onMounted(async () => {
  if (!store.detail || String(store.detail.id) !== String(props.id)) {
    await store.fetchDetail(props.id)
  }
})
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="h-12 bg-white dark:bg-surface-900 border-b border-gray-100 dark:border-gray-800 flex items-center px-4 gap-3 shrink-0">
      <RouterLink :to="`/books/${id}`" class="btn-ghost p-2 text-sm">← {{ t('common.back') }}</RouterLink>
      <h1 class="font-semibold text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
        {{ book?.title ?? 'Book Reader' }}
      </h1>
      <a v-if="pdfUrl" :href="pdfUrl" target="_blank" rel="noopener"
         class="btn-ghost text-xs px-3 py-1.5 hidden sm:flex items-center gap-1">
        ⬇️ Download PDF
      </a>
    </div>

    <LoadingSpinner v-if="store.loading && !book" />

    <div v-else-if="viewerUrl && !pdfError" class="flex-1 overflow-hidden">
      <iframe :src="viewerUrl" class="w-full h-full border-0" allow="fullscreen" @error="pdfError = true" />
    </div>

    <div v-else-if="pdfUrl" class="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div class="text-6xl">📄</div>
      <p class="text-gray-600 dark:text-gray-300">{{ book?.title }}</p>
      <a :href="pdfUrl" target="_blank" rel="noopener" class="btn-primary">📖 Open PDF in New Tab</a>
    </div>

    <div v-else class="flex-1 flex items-center justify-center text-gray-400 text-center p-8">
      <div>
        <div class="text-5xl mb-3">📚</div>
        <p>No readable file available for this book.</p>
      </div>
    </div>
  </div>
</template>
