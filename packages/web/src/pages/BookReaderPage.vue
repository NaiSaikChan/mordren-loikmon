<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useBooksStore } from '@/stores/books'
import { useI18n } from 'vue-i18n'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import EpubReader from '@/components/shared/EpubReader.vue'
import VuePdfApp from 'vue3-pdf-app'
import 'vue3-pdf-app/dist/icons/main.css'

const props = defineProps<{ id: string }>()
const { t } = useI18n()
const store = useBooksStore()

function fixUrl(url: string): string {
  if (!url) return ''
  let u = url.replace(/\\/g, '/')
  u = u.replace(/\u202f/gi, '%E2%80%AF').replace(/ /g, '%20')
  return u
}

const book       = computed(() => store.detail)
const pdfUrl     = computed(() => fixUrl(store.detail?.pdf ?? store.detail?.pdffile ?? ''))
const epubUrl    = computed(() => fixUrl(store.detail?.epub ?? ''))
const viewerPdfUrl = computed(() => {
  if (!pdfUrl.value) return ''
  if (/^https?:\/\//i.test(pdfUrl.value)) {
    return `/api/misc/pdf-proxy?url=${encodeURIComponent(pdfUrl.value)}`
  }
  return pdfUrl.value
})

// Disable download and print from the built-in PDF.js toolbar
// (print can be used as a download workaround — disable both)
const pdfConfig = {
  toolbar: {
    toolbarViewerRight: {
      presentationMode: true,
      openFile: false,
      print: false,
      download: false,
      viewBookmark: false,
    },
  },
}

onMounted(async () => {
  if (!store.detail || String(store.detail.id) !== String(props.id)) {
    await store.fetchDetail(props.id)
  }
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header bar — no download link -->
    <div class="h-12 bg-white dark:bg-surface-900 border-b border-gray-100 dark:border-gray-800 flex items-center px-4 gap-3 shrink-0">
      <RouterLink :to="`/books/${id}`" class="btn-ghost p-2 text-sm">← {{ t('common.back') }}</RouterLink>
      <h1 class="font-semibold text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
        {{ book?.title ?? 'Book Reader' }}
      </h1>
    </div>

    <LoadingSpinner v-if="store.loading && !book" />

    <!-- EPUB reader (epubjs) -->
    <div v-else-if="epubUrl" class="flex-1 overflow-hidden">
      <EpubReader :url="epubUrl" />
    </div>

    <!-- PDF reader (download + print disabled) -->
    <div v-else-if="viewerPdfUrl" class="flex-1 overflow-hidden">
      <VuePdfApp :pdf="viewerPdfUrl" :config="pdfConfig" class="w-full h-full" style="height: 100%;" />
    </div>

    <!-- Nothing available -->
    <div v-else class="flex-1 flex items-center justify-center text-gray-400 text-center p-8">
      <div>
        <div class="text-5xl mb-3">📚</div>
        <p>{{ t('reader.notAvailable') }}</p>
      </div>
    </div>
  </div>
</template>
