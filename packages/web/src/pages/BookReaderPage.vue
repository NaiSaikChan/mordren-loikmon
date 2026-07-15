<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useBooksStore } from '@/stores/books'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePurchasesStore } from '@/stores/purchases'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import EpubReader from '@/components/shared/EpubReader.vue'
import VuePdfApp from 'vue3-pdf-app'
import 'vue3-pdf-app/dist/icons/main.css'

const props = defineProps<{ id: string }>()
const { t } = useI18n()
const store = useBooksStore()
const route = useRoute()
const auth = useAuthStore()
const purchasesStore = usePurchasesStore()

const accessChecked = ref(false)

function fixUrl(url: string): string {
  if (!url) return ''
  let u = url.replace(/\\/g, '/')
  u = u.replace(/\u202f/gi, '%E2%80%AF').replace(/ /g, '%20')
  return u
}

const book       = computed(() => store.detail)
const pdfUrl     = computed(() => fixUrl(store.detail?.pdf ?? store.detail?.pdffile ?? ''))
const epubUrl    = computed(() => fixUrl(store.detail?.epub ?? ''))
const formatParam = computed(() => route.query.format as string | undefined)
// When ?format=pdf is requested, suppress the epub viewer so the PDF viewer renders
const activeEpubUrl = computed(() => formatParam.value === 'pdf' ? '' : epubUrl.value)

// Access is granted when: book is free/no price, OR user purchased it
const canAccess = computed(() => {
  if (!accessChecked.value || !book.value) return null // still loading
  if (book.value.is_free) return true
  const price = Number(book.value.price ?? 0)
  if (price <= 0) return true
  if (!auth.isLoggedIn) return false
  return purchasesStore.hasBook(props.id)
})
const viewerPdfUrl = computed(() => {
  if (!pdfUrl.value) return ''

  // GitHub Pages is a static deploy with no backend, so /api/misc/pdf-proxy
  // returns 404 there. loikmon.org serves PDFs with Access-Control-Allow-Origin: *
  // and accepts byte-range requests, so direct loading works in production.
  // Dev still uses the local BFF proxy for cross-origin consistency.
  if (import.meta.env.DEV && /^https?:\/\//i.test(pdfUrl.value)) {
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
  const bookFetch = (!store.detail || String(store.detail.id) !== String(props.id))
    ? store.fetchDetail(props.id)
    : Promise.resolve()
  await Promise.all([bookFetch, auth.isLoggedIn ? purchasesStore.fetchAll() : Promise.resolve()])
  accessChecked.value = true
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

    <LoadingSpinner v-if="(store.loading && !book) || !accessChecked" />

    <!-- Access denied: book requires purchase -->
    <div v-else-if="canAccess === false"
      class="flex-1 flex items-center justify-center text-center p-8">
      <div>
        <div class="text-5xl mb-4">🔒</div>
        <p class="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">Purchase Required</p>
        <p class="text-sm text-gray-400 mb-6">
          {{ auth.isLoggedIn ? 'You need to purchase this book to read it.' : 'Login and purchase this book to read it.' }}
        </p>
        <RouterLink :to="`/books/${props.id}`" class="btn-primary inline-flex">
          ← View Book
        </RouterLink>
      </div>
    </div>

    <!-- EPUB reader (epubjs) -->
    <div v-else-if="canAccess && activeEpubUrl" class="flex-1 overflow-hidden">
      <EpubReader :url="activeEpubUrl" />
    </div>

    <!-- PDF reader (download + print disabled) -->
    <div v-else-if="canAccess && viewerPdfUrl" class="flex-1 overflow-hidden">
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
