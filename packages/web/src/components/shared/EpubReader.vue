<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import ePub from 'epubjs'

// ─── Auto-load all font files from assets/fonts ───────────────────────────────
// Drop a new .ttf/.otf/.woff/.woff2 into that folder and it appears here.
const _fontModules = import.meta.glob(
  '../../assets/fonts/*.{ttf,otf,woff,woff2}',
  { query: '?url', eager: true, import: 'default' },
) as Record<string, string>

function _fontLabel(path: string): string {
  const base = path.split('/').pop()?.replace(/\.(ttf|otf|woff2?)$/i, '') ?? ''
  return base
    .replace(/[-_]/g, ' ')
    .replace(/\b\d+(\.\d+)+\b/g, '')   // strip version numbers like 2.5.4
    .replace(/\b(Regular)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(w => w ? w[0].toUpperCase() + w.slice(1) : w)
    .join(' ')
}

function _fontFormat(ext: string): string {
  return ({ ttf: 'truetype', otf: 'opentype', woff: 'woff', woff2: 'woff2' } as Record<string, string>)[ext] ?? 'truetype'
}

interface CustomFont { id: string; label: string; family: string; value: string; url: string; format: string }

const CUSTOM_FONTS: CustomFont[] = Object.entries(_fontModules).map(([path, url]) => {
  const filename = path.split('/').pop() ?? ''
  const ext      = filename.split('.').pop()?.toLowerCase() ?? 'ttf'
  const family   = filename.replace(/\.(ttf|otf|woff2?)$/i, '')
  return {
    id:     `custom-${family.replace(/\W/g, '-').toLowerCase()}`,
    label:  _fontLabel(path),
    family,
    value:  `'${family}', serif`,
    url,
    format: _fontFormat(ext),
  }
})

function buildFontFaceCSS(): string {
  return CUSTOM_FONTS.map(f => {
    const abs = new URL(f.url, window.location.href).href
    return `@font-face { font-family: '${f.family}'; src: url('${abs}') format('${f.format}'); font-display: swap; }`
  }).join('\n')
}

// ─── Props ────────────────────────────────────────────────────────────────────
const props = defineProps<{ url: string }>()

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const readerRoot = ref<HTMLDivElement | null>(null)
const container  = ref<HTMLDivElement | null>(null)

// ─── UI state ─────────────────────────────────────────────────────────────────
const loading        = ref(true)
const errorMsg       = ref<string | null>(null)
const tocOpen        = ref(false)
const settingsOpen   = ref(false)
const isFullscreen   = ref(false)
const chapters       = ref<{ id: string; href: string; label: string; depth: number }[]>([])
const currentChapter = ref('')
const progress       = ref(0)

// ─── epubjs instances (non-reactive) ─────────────────────────────────────────
let book: any = null
let rendition: any = null
let resizeObserver: ResizeObserver | null = null

// ─── Constants ────────────────────────────────────────────────────────────────
const THEMES = [
  { id: 'light', label: 'Light',  bg: '#ffffff', color: '#111827' },
  { id: 'sepia', label: 'Sepia',  bg: '#f8f0e3', color: '#3d2b1f' },
  { id: 'gray',  label: 'Gray',   bg: '#e8e8e8', color: '#1a1a1a' },
  { id: 'dark',  label: 'Dark',   bg: '#1a1a2e', color: '#d0d0e0' },
  { id: 'black', label: 'Black',  bg: '#000000', color: '#cccccc' },
] as const

const FONTS = [
  { id: 'book',    label: 'Book Default',    value: '' },
  { id: 'serif',   label: 'Serif',           value: 'Georgia, "Times New Roman", serif' },
  { id: 'sans',    label: 'Sans Serif',      value: 'Arial, Helvetica, sans-serif' },
  { id: 'georgia', label: 'Georgia',         value: 'Georgia, serif' },
  { id: 'arial',   label: 'Arial',           value: 'Arial, sans-serif' },
  { id: 'verdana', label: 'Verdana',         value: 'Verdana, Geneva, sans-serif' },
  { id: 'times',   label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { id: 'system',  label: 'System Font',     value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
]

// Combined list: built-in fonts first, then every font found in assets/fonts/
const ALL_FONTS = [
  ...FONTS,
  ...CUSTOM_FONTS.map(f => ({ id: f.id, label: f.label, value: f.value })),
]

const LINE_SPACINGS = [
  { id: 'compact',     label: 'Compact',     value: 1.2 },
  { id: 'normal',      label: 'Normal',      value: 1.5 },
  { id: 'comfortable', label: 'Comfortable', value: 1.8 },
  { id: 'wide',        label: 'Wide',        value: 2.1 },
] as const

const DEFAULT_SETTINGS = {
  theme:         'light',
  customBg:      '',
  fontId:        'book',
  fontSize:      100,
  lineSpacingId: 'normal',
}

// ─── Persistent settings ──────────────────────────────────────────────────────
function loadPersistedSettings() {
  try {
    const raw = localStorage.getItem('epub-reader-settings')
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch { /* ignore parse errors */ }
  return { ...DEFAULT_SETTINGS }
}

const settings = reactive(loadPersistedSettings())

function persistSettings() {
  localStorage.setItem('epub-reader-settings', JSON.stringify({ ...settings }))
}

function resetSettings() {
  Object.assign(settings, DEFAULT_SETTINGS)
  persistSettings()
  applyReaderStyles()
}

// ─── Computed effective values ────────────────────────────────────────────────
const effectiveBg = computed<string>(() => {
  if (settings.customBg) return settings.customBg
  return THEMES.find(t => t.id === settings.theme)?.bg ?? '#ffffff'
})

const effectiveColor = computed<string>(() => {
  if (settings.customBg) {
    const hex = settings.customBg.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16) || 0
    const g = parseInt(hex.substring(2, 4), 16) || 0
    const b = parseInt(hex.substring(4, 6), 16) || 0
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#111827' : '#e0e0e0'
  }
  return THEMES.find(t => t.id === settings.theme)?.color ?? '#111827'
})

const effectiveFontValue = computed<string>(() =>
  ALL_FONTS.find(f => f.id === settings.fontId)?.value ?? ''
)

const effectiveLineSpacing = computed<number>(() =>
  LINE_SPACINGS.find(l => l.id === settings.lineSpacingId)?.value ?? 1.5
)

// Toolbar border derived from text color with low opacity
const toolbarBorder = computed(() => `${effectiveColor.value}26`)

// ─── URL normalisation ────────────────────────────────────────────────────────
function fixUrl(url: string): string {
  if (!url) return ''
  return url
    .replace(/\\/g, '/')
    .replace(/\u202f/gi, '%E2%80%AF')
    .replace(/ /g, '%20')
}

// ─── Book key for position persistence ───────────────────────────────────────
function bookKey(): string {
  try { return `epub-cfi-${btoa(props.url)}` } catch { return `epub-cfi-${props.url}` }
}

// ─── Apply reader styles to the epubjs iframe ─────────────────────────────────
function applyReaderStyles() {
  if (!rendition?.themes) return
  try {
    const bg = effectiveBg.value
    const fg = effectiveColor.value
    const ff = effectiveFontValue.value
    const ls = effectiveLineSpacing.value
    const fs = settings.fontSize

    const bodyRules: Record<string, string> = {
      'background':         `${bg} !important`,
      'background-color':   `${bg} !important`,
      'color':              `${fg} !important`,
      'line-height':        `${ls} !important`,
      'font-size':          `${fs}% !important`,
    }
    if (ff) bodyRules['font-family'] = `${ff} !important`

    const textRules: Record<string, string> = {
      'line-height': `${ls} !important`,
      ...(ff ? { 'font-family': `${ff} !important` } : {}),
    }

    rendition.themes.register('reader', {
      'html':                           { 'background': `${bg} !important`, 'background-color': `${bg} !important` },
      'body':                           bodyRules,
      'p':                              textRules,
      'div':                            textRules,
      'li':                             textRules,
      'blockquote':                     textRules,
      'h1': textRules, 'h2': textRules, 'h3': textRules,
      'h4': textRules, 'h5': textRules, 'h6': textRules,
    })
    rendition.themes.select('reader')
  } catch { /* ignore theme errors */ }
}

// ─── Keyboard handler ─────────────────────────────────────────────────────────
function onKeyDown(e: KeyboardEvent) {
  if (!rendition) return
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { rendition.next(); return }
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { rendition.prev(); return }
  if (e.key === 'Escape') {
    if (settingsOpen.value) { settingsOpen.value = false; return }
    if (tocOpen.value)      { tocOpen.value = false; return }
    if (isFullscreen.value) document.exitFullscreen?.()
  }
}

// ─── Swipe gesture (outer div + iframe proxy) ─────────────────────────────────
let _swipeLock = true
let _tx = 0
let _ty = 0

function swipeStart(clientX: number, clientY: number) {
  _tx = clientX; _ty = clientY; _swipeLock = false
}
function swipeEnd(clientX: number, clientY: number) {
  if (_swipeLock || !rendition) return
  const dx = _tx - clientX
  const dy = _ty - clientY
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 48) {
    _swipeLock = true
    dx > 0 ? rendition.next() : rendition.prev()
  }
}
function onTouchStart(e: TouchEvent) { swipeStart(e.touches[0].clientX, e.touches[0].clientY) }
function onTouchEnd(e: TouchEvent)   { swipeEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY) }

// ─── Fullscreen ───────────────────────────────────────────────────────────────
function toggleFullscreen() {
  if (!isFullscreen.value) readerRoot.value?.requestFullscreen?.()
  else document.exitFullscreen?.()
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
  nextTick(triggerResize)
}

function triggerResize() {
  if (!rendition || !container.value) return
  const { width, height } = container.value.getBoundingClientRect()
  if (width > 0 && height > 0) {
    try { rendition.resize(width, height) } catch { /* ignore */ }
  }
}

// ─── Chapter navigation ───────────────────────────────────────────────────────
function goToChapter(href: string) {
  try { rendition?.display(href) } catch { /* ignore */ }
  tocOpen.value = false
}

// ─── Main render function ─────────────────────────────────────────────────────
async function render(url: string) {
  if (!container.value || !url) return

  resizeObserver?.disconnect()
  resizeObserver = null
  try { rendition?.destroy() } catch { /* ignore */ }
  try { book?.destroy() }      catch { /* ignore */ }
  rendition = null
  book = null
  chapters.value = []
  currentChapter.value = ''
  progress.value = 0
  loading.value  = true
  errorMsg.value = null

  try {
    book      = ePub(fixUrl(url))
    rendition = book.renderTo(container.value, {
      width:                '100%',
      height:               '100%',
      flow:                 'paginated',
      allowScriptedContent: false,
      spread:               'none',
    })

    const savedCfi = localStorage.getItem(bookKey())
    await rendition.display(savedCfi || undefined)

    applyReaderStyles()

    // Proxy iframe keydown and touch events
    rendition.on('keydown', onKeyDown)
    rendition.on('touchStart', (e: any) => {
      const t = e?.changedTouches?.[0] ?? e?.touches?.[0]
      if (t) swipeStart(t.clientX, t.clientY)
    })
    rendition.on('touchEnd', (e: any) => {
      const t = e?.changedTouches?.[0]
      if (t) swipeEnd(t.clientX, t.clientY)
    })

    // Track reading location + progress
    rendition.on('relocated', (loc: any) => {
      try {
        const cfi = loc?.start?.cfi
        if (!cfi) return
        localStorage.setItem(bookKey(), cfi)
        if (typeof book?.locations?.percentageFromCfi === 'function' && book.locations.length?.()) {
          progress.value = Math.round(book.locations.percentageFromCfi(cfi) * 100)
        }
        // Match current chapter in TOC
        const href = loc?.start?.href ?? ''
        const match = chapters.value.find(c => {
          const base = c.href.split('#')[0]
          return href.endsWith(base) || base.endsWith(href.split('#')[0])
        })
        if (match) currentChapter.value = match.label
      } catch { /* ignore */ }
    })

    // Load table of contents
    try {
      const nav = await book.loaded.navigation
      const flatten = (items: any[], depth = 0): typeof chapters.value =>
        items.flatMap((item: any) => [
          { id: String(item.id ?? item.href), href: item.href ?? '', label: (item.label ?? '').trim(), depth },
          ...(item.subitems?.length ? flatten(item.subitems, depth + 1) : []),
        ])
      chapters.value = flatten(nav?.toc ?? [])
    } catch { /* ignore nav errors */ }

    // Inject custom @font-face declarations into each rendered iframe section
    const fontFaceCSS = buildFontFaceCSS()
    if (fontFaceCSS) {
      rendition.on('rendered', (_section: any, view: any) => {
        try {
          const doc: Document = view?.document ?? view?.window?.document
          if (!doc?.head) return
          doc.getElementById('__epub-fonts__')?.remove()
          const st = doc.createElement('style')
          st.id = '__epub-fonts__'
          st.textContent = fontFaceCSS
          doc.head.appendChild(st)
        } catch { /* ignore */ }
      })
    }

    // Generate locations for progress tracking in the background
    book.ready
      .then(() => book.locations.generate(1024).catch(() => {}))
      .catch(() => {})

    // Responsive resize observer
    resizeObserver = new ResizeObserver(() => triggerResize())
    resizeObserver.observe(container.value)

  } catch (e: any) {
    errorMsg.value = e?.message ?? 'Failed to load EPUB'
  } finally {
    loading.value = false
  }
}

function goPrev() { rendition?.prev() }
function goNext() { rendition?.next() }

// ─── Watch settings → persist + re-apply ─────────────────────────────────────
watch(
  () => [settings.theme, settings.customBg, settings.fontId, settings.fontSize, settings.lineSpacingId],
  () => { persistSettings(); applyReaderStyles() },
)

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => {
  // Inject custom font-face declarations into the main document so the settings
  // panel font-preview buttons render in the correct typeface.
  const faceCSS = buildFontFaceCSS()
  if (faceCSS && !document.getElementById('__epub-custom-fonts__')) {
    const el = document.createElement('style')
    el.id = '__epub-custom-fonts__'
    el.textContent = faceCSS
    document.head.appendChild(el)
  }

  render(props.url)
  window.addEventListener('keydown', onKeyDown)
  document.addEventListener('fullscreenchange', onFullscreenChange)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  try { rendition?.destroy() } catch { /* ignore */ }
  try { book?.destroy() }      catch { /* ignore */ }
  window.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
})

watch(() => props.url, url => render(url))
</script>

<template>
  <div
    ref="readerRoot"
    class="relative flex flex-col h-full overflow-hidden select-none"
    :style="{ background: effectiveBg }"
    role="main"
    aria-label="EPUB Reader"
  >
    <!-- ── Toolbar ──────────────────────────────────────────────────────── -->
    <header
      class="relative z-20 flex items-center gap-1 px-2 shrink-0 transition-colors duration-300"
      :style="{ background: effectiveBg, borderBottom: `1px solid ${toolbarBorder}`, height: '48px' }"
    >
      <!-- Table of contents toggle -->
      <button
        @click="tocOpen = !tocOpen"
        class="flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        :aria-label="tocOpen ? 'Close table of contents' : 'Open table of contents'"
        :aria-expanded="tocOpen"
      >
        <svg class="w-5 h-5 opacity-70" :style="{ color: effectiveColor }" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
        </svg>
      </button>

      <!-- Current chapter (hidden on very small screens) -->
      <span
        class="flex-1 text-xs font-medium truncate text-center px-1 hidden xs:block"
        :style="{ color: effectiveColor, opacity: '0.65' }"
        :title="currentChapter"
        aria-live="polite"
        aria-label="Current chapter"
      >
        {{ currentChapter || '&nbsp;' }}
      </span>
      <span class="flex-1 hidden xs:hidden" aria-hidden="true" />

      <!-- Reading progress -->
      <span
        class="text-xs font-medium shrink-0 tabular-nums"
        :style="{ color: effectiveColor, opacity: '0.55' }"
        aria-label="Reading progress"
        aria-live="polite"
      >
        {{ progress }}%
      </span>

      <!-- Reader settings toggle -->
      <button
        @click="settingsOpen = !settingsOpen"
        class="flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        :aria-label="settingsOpen ? 'Close reader settings' : 'Open reader settings'"
        :aria-expanded="settingsOpen"
      >
        <svg class="w-5 h-5 opacity-70" :style="{ color: effectiveColor }" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      <!-- Fullscreen toggle -->
      <button
        @click="toggleFullscreen"
        class="flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        :aria-label="isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'"
      >
        <svg v-if="!isFullscreen" class="w-5 h-5 opacity-70" :style="{ color: effectiveColor }" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2m8-16h2a2 2 0 012 2v2m0 8v2a2 2 0 01-2 2h-2" />
        </svg>
        <svg v-else class="w-5 h-5 opacity-70" :style="{ color: effectiveColor }" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V7a2 2 0 00-2-2H5m14 4V7a2 2 0 00-2-2h-2M9 15v2a2 2 0 002 2h2m4-4v2a2 2 0 002 2h2" />
        </svg>
      </button>
    </header>

    <!-- Reading progress bar -->
    <div class="h-0.5 shrink-0 z-20 transition-colors duration-300" :style="{ background: toolbarBorder }">
      <div
        class="h-full bg-indigo-500 transition-all duration-500 ease-out"
        :style="{ width: `${progress}%` }"
        role="progressbar"
        :aria-valuenow="progress"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Reading progress"
      />
    </div>

    <!-- ── Content area ─────────────────────────────────────────────────── -->
    <div
      class="relative flex-1 overflow-hidden"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
    >
      <!-- epubjs render target -->
      <div
        ref="container"
        class="absolute inset-0 overflow-hidden transition-colors duration-300"
        :style="{ backgroundColor: effectiveBg }"
      />

      <!-- Loading overlay -->
      <Transition name="er-fade">
        <div
          v-if="loading"
          class="absolute inset-0 flex items-center justify-center z-10 transition-colors duration-300"
          :style="{ background: effectiveBg }"
          aria-live="polite"
          aria-label="Loading book"
        >
          <div class="flex flex-col items-center gap-3" :style="{ color: effectiveColor, opacity: '0.5' }">
            <div class="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
            <span class="text-sm">Loading book&hellip;</span>
          </div>
        </div>
      </Transition>

      <!-- Error overlay -->
      <div
        v-if="errorMsg"
        class="absolute inset-0 flex items-center justify-center z-10 transition-colors duration-300"
        :style="{ background: effectiveBg }"
        role="alert"
      >
        <div class="text-center p-8 max-w-xs" :style="{ color: effectiveColor, opacity: '0.6' }">
          <div class="text-4xl mb-3" aria-hidden="true">⚠️</div>
          <p class="text-sm">{{ errorMsg }}</p>
        </div>
      </div>

      <!-- Previous page button (hidden on mobile — swipe handles navigation) -->
      <button
        v-if="!loading && !errorMsg"
        @click="goPrev"
        class="absolute left-0 top-1/2 -translate-y-1/2 z-10 hidden sm:flex items-center justify-center w-12 h-24 rounded-r-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        :style="{ background: `${effectiveBg}d0`, color: effectiveColor }"
        style="backdrop-filter: blur(2px);"
        aria-label="Previous page"
      >
        <svg class="w-5 h-5 opacity-50 hover:opacity-80 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <!-- Next page button (hidden on mobile — swipe handles navigation) -->
      <button
        v-if="!loading && !errorMsg"
        @click="goNext"
        class="absolute right-0 top-1/2 -translate-y-1/2 z-10 hidden sm:flex items-center justify-center w-12 h-24 rounded-l-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        :style="{ background: `${effectiveBg}d0`, color: effectiveColor }"
        style="backdrop-filter: blur(2px);"
        aria-label="Next page"
      >
        <svg class="w-5 h-5 opacity-50 hover:opacity-80 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <!-- Backdrop (closes any open panel) -->
      <Transition name="er-fade">
        <div
          v-if="tocOpen || settingsOpen"
          class="absolute inset-0 z-30 bg-black/25"
          @click="tocOpen = false; settingsOpen = false"
          aria-hidden="true"
        />
      </Transition>

      <!-- ── Table of Contents panel ────────────────────────────────────── -->
      <Transition name="er-slide-left">
        <aside
          v-if="tocOpen"
          class="absolute left-0 top-0 bottom-0 z-40 flex flex-col overflow-hidden shadow-2xl transition-colors duration-300"
          :style="{ background: effectiveBg, borderRight: `1px solid ${toolbarBorder}`, width: 'min(300px, 88vw)' }"
          role="navigation"
          aria-label="Table of contents"
        >
          <div
            class="flex items-center justify-between px-4 py-3 shrink-0"
            :style="{ borderBottom: `1px solid ${toolbarBorder}` }"
          >
            <h2 class="font-semibold text-sm" :style="{ color: effectiveColor }">Contents</h2>
            <button
              @click="tocOpen = false"
              class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Close table of contents"
            >
              <svg class="w-4 h-4 opacity-60" :style="{ color: effectiveColor }" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav class="flex-1 overflow-y-auto py-1" aria-label="Book chapters">
            <button
              v-for="ch in chapters"
              :key="ch.id"
              @click="goToChapter(ch.href)"
              class="w-full text-left py-2.5 pr-4 text-sm transition-colors hover:bg-black/10 truncate focus-visible:outline-none focus-visible:bg-black/10"
              :style="{
                paddingLeft: `${ch.depth * 12 + 16}px`,
                color:      ch.label === currentChapter ? 'rgb(99 102 241)' : effectiveColor,
                fontWeight: ch.label === currentChapter ? '600' : '400',
                opacity:    ch.label === currentChapter ? '1' : '0.75',
              }"
            >
              {{ ch.label }}
            </button>
            <p
              v-if="!chapters.length"
              class="px-4 py-8 text-center text-xs opacity-40"
              :style="{ color: effectiveColor }"
            >
              No chapters found
            </p>
          </nav>
        </aside>
      </Transition>

      <!-- ── Reader settings panel ──────────────────────────────────────── -->
      <Transition name="er-slide-right">
        <aside
          v-if="settingsOpen"
          class="absolute right-0 top-0 bottom-0 z-40 flex flex-col overflow-hidden shadow-2xl transition-colors duration-300"
          :style="{ background: effectiveBg, borderLeft: `1px solid ${toolbarBorder}`, width: 'min(320px, 92vw)' }"
          role="complementary"
          aria-label="Reader settings"
        >
          <div
            class="flex items-center justify-between px-4 py-3 shrink-0"
            :style="{ borderBottom: `1px solid ${toolbarBorder}` }"
          >
            <h2 class="font-semibold text-sm" :style="{ color: effectiveColor }">Reader Settings</h2>
            <button
              @click="settingsOpen = false"
              class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Close reader settings"
            >
              <svg class="w-4 h-4 opacity-60" :style="{ color: effectiveColor }" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-4 space-y-6">

            <!-- Background theme -->
            <section>
              <h3
                class="text-xs font-semibold uppercase tracking-wider mb-3 opacity-50"
                :style="{ color: effectiveColor }"
              >
                Background
              </h3>
              <div class="flex gap-2.5 mb-3">
                <button
                  v-for="th in THEMES"
                  :key="th.id"
                  @click="settings.theme = th.id; settings.customBg = ''"
                  class="w-9 h-9 rounded-xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  :style="{
                    background:   th.bg,
                    borderColor:  settings.theme === th.id && !settings.customBg ? 'rgb(99 102 241)' : (th.bg === '#ffffff' ? '#d1d5db' : th.bg),
                    transform:    settings.theme === th.id && !settings.customBg ? 'scale(1.18)' : 'scale(1)',
                    boxShadow:    settings.theme === th.id && !settings.customBg ? '0 0 0 1px rgb(99 102 241)' : 'none',
                  }"
                  :aria-label="`${th.label} theme`"
                  :aria-pressed="settings.theme === th.id && !settings.customBg"
                  :title="th.label"
                />
              </div>
              <!-- Custom background colour -->
              <div class="flex items-center gap-3">
                <label for="epub-custom-bg" class="text-xs opacity-60" :style="{ color: effectiveColor }">
                  Custom colour
                </label>
                <input
                  id="epub-custom-bg"
                  type="color"
                  :value="settings.customBg || effectiveBg"
                  @input="settings.customBg = ($event.target as HTMLInputElement).value"
                  class="w-8 h-8 rounded-lg cursor-pointer border-0 p-0.5 bg-transparent"
                  aria-label="Custom background color"
                />
                <button
                  v-if="settings.customBg"
                  @click="settings.customBg = ''"
                  class="text-xs opacity-60 hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                  :style="{ color: effectiveColor }"
                >
                  Clear
                </button>
              </div>
            </section>

            <!-- Font family -->
            <section>
              <h3
                class="text-xs font-semibold uppercase tracking-wider mb-3 opacity-50"
                :style="{ color: effectiveColor }"
              >
                Font Style
              </h3>
              <div class="grid grid-cols-2 gap-1.5">
                <button
                  v-for="font in ALL_FONTS"
                  :key="font.id"
                  @click="settings.fontId = font.id"
                  class="px-2 py-2 rounded-lg text-xs text-left truncate transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  :style="{
                    background:  settings.fontId === font.id ? 'rgba(99,102,241,0.18)' : `${effectiveColor}12`,
                    color:       settings.fontId === font.id ? 'rgb(99 102 241)' : effectiveColor,
                    fontWeight:  settings.fontId === font.id ? '600' : '400',
                    fontFamily:  font.value || undefined,
                    opacity:     settings.fontId === font.id ? '1' : '0.8',
                  }"
                  :aria-pressed="settings.fontId === font.id"
                >
                  {{ font.label }}
                </button>
              </div>
            </section>

            <!-- Font size -->
            <section>
              <h3
                class="text-xs font-semibold uppercase tracking-wider mb-3 opacity-50 flex items-center gap-2"
                :style="{ color: effectiveColor }"
              >
                Font Size
                <span class="normal-case font-semibold text-indigo-500 opacity-100">{{ settings.fontSize }}%</span>
              </h3>
              <div class="flex items-center gap-2">
                <button
                  @click="settings.fontSize = Math.max(60, settings.fontSize - 10)"
                  class="w-8 h-8 rounded-lg flex items-center justify-center text-base font-bold transition-colors hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  :style="{ color: effectiveColor }"
                  aria-label="Decrease font size by 10%"
                >
                  −
                </button>
                <input
                  type="range"
                  min="60"
                  max="200"
                  step="5"
                  v-model.number="settings.fontSize"
                  class="flex-1 accent-indigo-500 cursor-pointer"
                  aria-label="Font size"
                  :aria-valuenow="settings.fontSize"
                  aria-valuemin="60"
                  aria-valuemax="200"
                />
                <button
                  @click="settings.fontSize = Math.min(200, settings.fontSize + 10)"
                  class="w-8 h-8 rounded-lg flex items-center justify-center text-base font-bold transition-colors hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  :style="{ color: effectiveColor }"
                  aria-label="Increase font size by 10%"
                >
                  +
                </button>
              </div>
            </section>

            <!-- Line spacing -->
            <section>
              <h3
                class="text-xs font-semibold uppercase tracking-wider mb-3 opacity-50"
                :style="{ color: effectiveColor }"
              >
                Line Spacing
              </h3>
              <div class="flex gap-1.5">
                <button
                  v-for="ls in LINE_SPACINGS"
                  :key="ls.id"
                  @click="settings.lineSpacingId = ls.id"
                  class="flex-1 py-2 rounded-lg text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  :style="{
                    background: settings.lineSpacingId === ls.id ? 'rgba(99,102,241,0.18)' : `${effectiveColor}12`,
                    color:      settings.lineSpacingId === ls.id ? 'rgb(99 102 241)' : effectiveColor,
                    fontWeight: settings.lineSpacingId === ls.id ? '600' : '400',
                    opacity:    settings.lineSpacingId === ls.id ? '1' : '0.8',
                  }"
                  :aria-pressed="settings.lineSpacingId === ls.id"
                >
                  {{ ls.label }}
                </button>
              </div>
            </section>

            <!-- Reset button -->
            <button
              @click="resetSettings"
              class="w-full py-2.5 rounded-lg text-sm transition-colors hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 border"
              :style="{ color: effectiveColor, borderColor: toolbarBorder }"
            >
              Reset to Defaults
            </button>

          </div>
        </aside>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.er-fade-enter-active,
.er-fade-leave-active  { transition: opacity 0.15s ease; }
.er-fade-enter-from,
.er-fade-leave-to      { opacity: 0; }

.er-slide-left-enter-active,
.er-slide-left-leave-active  { transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1); }
.er-slide-left-enter-from,
.er-slide-left-leave-to      { transform: translateX(-100%); }

.er-slide-right-enter-active,
.er-slide-right-leave-active  { transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1); }
.er-slide-right-enter-from,
.er-slide-right-leave-to      { transform: translateX(100%); }
</style>
