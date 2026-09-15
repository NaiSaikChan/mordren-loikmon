<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { books as booksApi } from '@loikmon/api'
import { useBooksStore } from '@/stores/books'
import { useAuthStore } from '@/stores/auth'
import { useBookFile, type BookFormat } from '@/composables/useBookFile'
import { useContentProtection } from '@/composables/useContentProtection'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import Paywall from '@/components/shared/Paywall.vue'

const EpubReader = defineAsyncComponent({
  loader: () => import('@/components/shared/EpubReader.vue'),
  loadingComponent: LoadingSpinner,
})

const VuePdfApp = defineAsyncComponent({
  loader: async () => {
    await import('vue3-pdf-app/dist/icons/main.css')
    const mod = await import('vue3-pdf-app')
    return (mod as any).default ?? mod
  },
  loadingComponent: LoadingSpinner,
})

const props = defineProps<{ id: string }>()
const { t } = useI18n()
const store = useBooksStore()
const route = useRoute()
const auth = useAuthStore()
const protectedReader = ref<HTMLElement | null>(null)
const { toastVisible, toastMessage, devToolsDetected, watermarkText } = useContentProtection(protectedReader)

// The file URL is never read from the book object: it is a short-lived signed
// URL issued by `books.getFileUrl` only to viewers with access.
const bookFile = useBookFile(() => props.id)

/** URL handed to the EPUB reader; refreshed URLs are passed back through `refreshUrl` instead of re-rendering. */
const epubUrl = ref<string | null>(null)
const pdfData = shallowRef<ArrayBuffer | null>(null)
const pdfLoading = ref(false)
const pdfFailed = ref(false)
let loadToken = 0

const book = computed(() => (store.detail && String(store.detail.id) === String(props.id) ? store.detail : null))
const requestedFormat = computed<BookFormat | undefined>(() => {
  const f = route.query.format
  return f === 'pdf' || f === 'epub' ? f : undefined
})
const format = computed(() => bookFile.file.value?.format ?? null)
const notAvailable = computed(() => bookFile.error.value?.code === 'NOT_FOUND')

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

async function loadPdf(token: number) {
  pdfLoading.value = true
  pdfFailed.value = false
  try {
    const bytes = await bookFile.fetchBytes()
    if (token === loadToken) pdfData.value = bytes
  } catch {
    // A lost subscription surfaces as a lock reason from the re-requested URL.
    if (token === loadToken && !bookFile.lockReason.value) pdfFailed.value = true
  } finally {
    if (token === loadToken) pdfLoading.value = false
  }
}

async function loadReader() {
  const token = ++loadToken
  epubUrl.value = null
  pdfData.value = null
  pdfFailed.value = false

  if (!book.value) void store.fetchDetail(props.id)
  void booksApi.updateTotalViews(props.id).catch(() => undefined)

  const file = await bookFile.request(requestedFormat.value)
  if (token !== loadToken || !file) return
  if (file.format === 'epub') epubUrl.value = file.url
  else await loadPdf(token)
}

onMounted(loadReader)

// Same component, different book / format, or the session changed (signed in, subscribed).
watch(() => [props.id, requestedFormat.value], () => { void loadReader() })
watch(() => [auth.token, Boolean(auth.entitlement?.active)] as const, (next, prev) => {
  // A different session, or an entitlement change while the book is locked.
  if (next[0] !== prev[0] || (next[1] !== prev[1] && bookFile.lockReason.value)) void loadReader()
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header bar — no download link -->
    <div class="h-12 bg-white dark:bg-surface-900 border-b border-gray-100 dark:border-gray-800 flex items-center px-4 gap-3 shrink-0">
      <RouterLink :to="`/books/${id}`" class="btn-ghost p-2 text-sm">← {{ t('common.back') }}</RouterLink>
      <h1 class="font-semibold text-sm text-gray-700 dark:text-gray-300 truncate flex-1 pt-2">
        {{ book?.title ?? t('reader.title') }}
      </h1>
      <span v-if="format" class="text-xs font-semibold uppercase text-gray-400">{{ format }}</span>
    </div>

    <LoadingSpinner v-if="bookFile.loading.value && !bookFile.file.value" />

    <!-- Access denied by the server: sign in or subscribe -->
    <div v-else-if="bookFile.lockReason.value" class="flex-1 flex items-center justify-center p-8">
      <Paywall
        :reason="bookFile.lockReason.value"
        class="max-w-lg w-full"
        @unlocked="loadReader"
      >
        <RouterLink :to="`/books/${props.id}`" class="mt-4 inline-block text-sm text-brand-600 hover:underline">
          ← {{ t('books.viewBook') }}
        </RouterLink>
      </Paywall>
    </div>

    <!-- No such file for this book -->
    <div v-else-if="notAvailable" class="flex-1 flex items-center justify-center text-gray-400 text-center p-8" data-testid="reader-not-available">
      <div>
        <div class="text-5xl mb-3">📚</div>
        <p>{{ t('reader.notAvailable') }}</p>
      </div>
    </div>

    <!-- Other errors (network, server) -->
    <div v-else-if="bookFile.error.value || pdfFailed" class="flex-1 flex items-center justify-center text-center p-8">
      <div class="max-w-md">
        <div class="text-5xl mb-4">⚠️</div>
        <p class="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">{{ t('reader.loadFailed') }}</p>
        <p v-if="bookFile.error.value" class="text-sm text-gray-500 dark:text-gray-400 mb-4">{{ bookFile.error.value.message }}</p>
        <button type="button" class="btn-primary" @click="loadReader">{{ t('common.retry') }}</button>
      </div>
    </div>

    <!-- EPUB reader (epubjs) -->
    <div
      v-else-if="format === 'epub' && epubUrl"
      ref="protectedReader"
      class="protected-content protected-reader flex-1 overflow-hidden"
      data-testid="reader-epub"
    >
      <EpubReader :url="epubUrl" :book-id="props.id" :refresh-url="bookFile.refresh" />
      <div class="protected-watermark" aria-hidden="true">{{ watermarkText }}</div>
      <div class="protected-print-message">{{ t('reader.printBlocked') }}</div>
    </div>

    <LoadingSpinner v-else-if="format === 'pdf' && (pdfLoading || !pdfData)" />

    <!-- PDF reader (download + print disabled) -->
    <div
      v-else-if="format === 'pdf' && pdfData"
      ref="protectedReader"
      class="protected-content protected-reader flex-1 overflow-hidden"
      data-testid="reader-pdf"
    >
      <VuePdfApp :pdf="pdfData" :config="pdfConfig" class="w-full h-full" style="height: 100%;" />
      <div class="protected-watermark" aria-hidden="true">{{ watermarkText }}</div>
      <div class="protected-print-message">{{ t('reader.printBlocked') }}</div>
    </div>

    <!-- Nothing available -->
    <div v-else class="flex-1 flex items-center justify-center text-gray-400 text-center p-8">
      <div>
        <div class="text-5xl mb-3">📚</div>
        <p>{{ t('reader.notAvailable') }}</p>
      </div>
    </div>
    <div v-if="toastVisible" class="protected-toast" role="status">{{ toastMessage }}</div>
    <div v-if="devToolsDetected" class="protected-warning" role="alert">
      {{ t('reader.devTools') }}
    </div>
  </div>
</template>
