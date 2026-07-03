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
  } catch (e: any) {
    errorMsg.value = e?.message ?? 'Failed to load EPUB'
  } finally {
    loading.value = false
  }
}

// Keyboard arrow navigation
function onKeyDown(e: KeyboardEvent) {
  if (!rendition) return
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') rendition.next()
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   rendition.prev()
}

onMounted(() => {
  render(props.url)
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

    <!-- epubjs render target -->
    <div ref="container" class="w-full h-full overflow-auto bg-white dark:bg-surface-900" />
  </div>
</template>
