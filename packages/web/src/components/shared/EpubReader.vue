<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import ePub from 'epubjs'

const props = defineProps<{ url: string }>()

const container = ref<HTMLDivElement | null>(null)
const loading = ref(true)
const errorMsg = ref<string | null>(null)

let book: any = null
let rendition: any = null

function fixUrl(url: string): string {
  if (!url) return ''
  return url
    .replace(/\\/g, '/')
    .replace(/\u202f/gi, '%E2%80%AF')
    .replace(/ /g, '%20')
}

// Keyboard arrow navigation (called from parent window AND from inside the iframe)
function onKeyDown(e: KeyboardEvent) {
  if (!rendition) return
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') rendition.next()
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   rendition.prev()
}

async function render(url: string) {
  if (!container.value || !url) return

  // Tear down any previous instance
  try { rendition?.destroy() } catch (_) {}
  try { book?.destroy() } catch (_) {}
  rendition = null
  book = null

  loading.value = true
  errorMsg.value = null

  try {
    book = ePub(fixUrl(url))
    rendition = book.renderTo(container.value, {
      width: '100%',
      height: '100%',
      flow: 'scrolled-continuous',
      allowScriptedContent: false,
    })
    await rendition.display()
    // Force a white background inside the iframe so text stays readable
    // regardless of the app's dark-mode theme (the iframe is transparent by default).
    rendition.themes?.default({
      body: {
        background:       '#ffffff !important',
        'background-color': '#ffffff !important',
        color:            '#111827 !important',
      },
    })
    // Also capture keydown events fired inside the epubjs iframe,
    // which do not bubble up to the parent window.
    rendition.on('keydown', onKeyDown)
  } catch (e: any) {
    errorMsg.value = e?.message ?? 'Failed to load EPUB'
  } finally {
    loading.value = false
  }
}

function goPrev() { rendition?.prev() }
function goNext() { rendition?.next() }

onMounted(() => {
  render(props.url)
  // Capture keys when the parent window is focused
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  try { rendition?.destroy() } catch (_) {}
  try { book?.destroy() } catch (_) {}
  window.removeEventListener('keydown', onKeyDown)
})

watch(() => props.url, (url) => render(url))
</script>

<template>
  <div class="relative w-full h-full">
    <!-- Loading overlay -->
    <div v-if="loading"
      class="absolute inset-0 flex items-center justify-center bg-white dark:bg-surface-900 z-10">
      <div class="flex flex-col items-center gap-3 text-gray-400">
        <div class="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
        <span class="text-sm">Loading book&hellip;</span>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="errorMsg"
      class="absolute inset-0 flex items-center justify-center bg-white dark:bg-surface-900">
      <div class="text-center text-gray-400 p-8">
        <div class="text-4xl mb-3">⚠️</div>
        <p class="text-sm">{{ errorMsg }}</p>
      </div>
    </div>

    <!-- epubjs render target: always white so epub text stays readable in dark mode -->
    <div ref="container" class="w-full h-full overflow-auto bg-white" />

    <!-- Chapter navigation buttons -->
    <div v-if="!loading && !errorMsg"
      class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 z-20">
      <button
        @click="goPrev"
        class="flex items-center justify-center w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
        aria-label="Previous chapter"
      >
        &#8592;
      </button>
      <button
        @click="goNext"
        class="flex items-center justify-center w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
        aria-label="Next chapter"
      >
        &#8594;
      </button>
    </div>
  </div>
</template>
