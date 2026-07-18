import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import i18n from '@/i18n'

export type Theme = 'light' | 'dark' | 'system'
export type Locale = 'en' | 'mon'

// ── Font options ──────────────────────────────────────────────────────────────
export interface FontOption {
  id: string
  label: string
  stack: string   // full CSS font-family value
}

const BUILTIN_FONT_OPTIONS: FontOption[] = [
  { id: 'system',             label: 'System Default',    stack: 'system-ui, -apple-system, sans-serif' },
  { id: 'serif',              label: 'Serif',             stack: 'Georgia, "Times New Roman", serif' },
  { id: 'Padauk',             label: 'Padauk',            stack: "'Padauk', sans-serif" },
  { id: 'Noto Sans Myanmar',  label: 'Noto Sans Myanmar', stack: "'Noto Sans Myanmar', sans-serif" },
  { id: 'Noto Serif Myanmar', label: 'Noto Serif Myanmar', stack: "'Noto Serif Myanmar', serif" },
]

// Discover the custom fonts shipped in `src/assets/fonts` so the settings UI
// stays in sync with the EPUB reader's font list.
const CUSTOM_FONT_MODULES = import.meta.glob(
  '../assets/fonts/*.{ttf,otf,woff,woff2}',
  { query: '?url', eager: true, import: 'default' },
) as Record<string, string>

function normaliseFontId(path: string): string {
  const base = path.split('/').pop()?.replace(/\.(ttf|otf|woff2?)$/i, '') ?? ''
  return base
    .replace(/\b\d+(\.\d+)+\b/g, '')
    .replace(/[-_](Regular|Bold|Italic|Oblique)$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[-_]+$/g, '')
    .trim()
}

function normaliseFontLabel(path: string): string {
  const base = path.split('/').pop()?.replace(/\.(ttf|otf|woff2?)$/i, '') ?? ''
  return base
    .replace(/[-_]/g, ' ')
    .replace(/\b\d+(\.\d+)+\b/g, '')
    .replace(/\b(Regular)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(w => w ? w[0].toUpperCase() + w.slice(1) : w)
    .join(' ')
}

const CUSTOM_FONT_LABELS: Record<string, string> = {
  Mon3Anonta1: 'Mon3 Anonta1',
  MUA_Office_adobe: 'MUA Office',
  Pyidaungsu: 'Pyidaungsu',
  PyidaungsuNumbers: 'Pyidaungsu Numbers',
  Style1: 'Style 1',
  Style2: 'Style 2',
  Style3: 'Style 3',
  Style4: 'Style 4',
  Style5: 'Style 5',
}

const CUSTOM_FONT_STACKS: Record<string, string> = {
  Mon3Anonta1: "'Mon3Anonta1', serif",
  MUA_Office_adobe: "'MUA_Office_adobe', sans-serif",
  Pyidaungsu: "'Pyidaungsu', sans-serif",
  PyidaungsuNumbers: "'PyidaungsuNumbers', sans-serif",
  Style1: "'Style1', sans-serif",
  Style2: "'Style2', sans-serif",
  Style3: "'Style3', sans-serif",
  Style4: "'Style4', sans-serif",
  Style5: "'Style5', sans-serif",
}

const CUSTOM_FONT_OPTIONS: FontOption[] = Array.from(
  new Map(
    Object.keys(CUSTOM_FONT_MODULES).map(path => {
      const id = normaliseFontId(path)
      return [
        id,
        {
          id,
          label: CUSTOM_FONT_LABELS[id] ?? normaliseFontLabel(path),
          stack: CUSTOM_FONT_STACKS[id] ?? `'${id}', sans-serif`,
        },
      ] as const
    }),
  ).values(),
)

export const UI_FONT_OPTIONS: FontOption[] = [
  ...BUILTIN_FONT_OPTIONS,
  ...CUSTOM_FONT_OPTIONS,
]

export const BODY_FONT_SIZES: { id: string; label: string; px: number }[] = [
  { id: 'xs', label: 'XS', px: 13 },
  { id: 'sm', label: 'S',  px: 14 },
  { id: 'md', label: 'M',  px: 16 },
  { id: 'lg', label: 'L',  px: 18 },
  { id: 'xl', label: 'XL', px: 20 },
]

export const HEADER_SCALES: { id: string; label: string; scale: number }[] = [
  { id: 'sm', label: 'S',  scale: 0.55 },
  { id: 'md', label: 'M',  scale: 0.65  },
  { id: 'lg', label: 'L',  scale: 0.75 },
  { id: 'xl', label: 'XL', scale: 1.0  },
]

export function getFontStack(id: string): string {
  return UI_FONT_OPTIONS.find(f => f.id === id)?.stack ?? `'${id}', system-ui, sans-serif`
}

// ── Store ─────────────────────────────────────────────────────────────────────
export const useUiStore = defineStore('ui', () => {
  const theme = ref<Theme>((localStorage.getItem('theme') as Theme) ?? 'system')
  const locale = ref<Locale>((localStorage.getItem('locale') as Locale) ?? 'en')
  const sidebarOpen = ref(false)

  // Font settings
  const bodyFont       = ref<string>(localStorage.getItem('ui-body-font')       ?? 'Padauk')
  const headerFont     = ref<string>(localStorage.getItem('ui-header-font')     ?? 'Padauk')
  const bodyFontSizeId = ref<string>(localStorage.getItem('ui-body-font-size')  ?? 'md')
  const headerScaleId  = ref<string>(localStorage.getItem('ui-header-scale')    ?? 'md')

  function applyTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = theme.value === 'dark' || (theme.value === 'system' && prefersDark)
    document.documentElement.classList.toggle('dark', isDark)
  }

  function applyLocale() {
    document.documentElement.lang = locale.value
    i18n.global.locale.value = locale.value as any
  }

  function applyFonts() {
    const root = document.documentElement
    root.style.setProperty('--ui-body-font', getFontStack(bodyFont.value))
    root.style.setProperty('--ui-header-font', getFontStack(headerFont.value))
    const px = BODY_FONT_SIZES.find(s => s.id === bodyFontSizeId.value)?.px ?? 16
    root.style.fontSize = `${px}px`
    const scale = HEADER_SCALES.find(s => s.id === headerScaleId.value)?.scale ?? 1.0
    root.style.setProperty('--ui-header-scale', String(scale))
  }

  function setTheme(t: Theme) {
    theme.value = t
    localStorage.setItem('theme', t)
    applyTheme()
  }

  function setLocale(l: Locale) {
    locale.value = l
    localStorage.setItem('locale', l)
    applyLocale()
  }

  function setBodyFont(id: string) {
    bodyFont.value = id
    localStorage.setItem('ui-body-font', id)
    applyFonts()
  }

  function setHeaderFont(id: string) {
    headerFont.value = id
    localStorage.setItem('ui-header-font', id)
    applyFonts()
  }

  function setBodyFontSize(id: string) {
    bodyFontSizeId.value = id
    localStorage.setItem('ui-body-font-size', id)
    applyFonts()
  }

  function setHeaderScale(id: string) {
    headerScaleId.value = id
    localStorage.setItem('ui-header-scale', id)
    applyFonts()
  }

  function toggleSidebar() { sidebarOpen.value = !sidebarOpen.value }
  function closeSidebar()  { sidebarOpen.value = false }

  // Listen for OS preference changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (theme.value === 'system') applyTheme()
  })

  watch(theme, applyTheme, { immediate: true })

  // Apply font and locale settings immediately on store creation
  applyLocale()
  applyFonts()

  return {
    theme, locale, sidebarOpen,
    bodyFont, headerFont, bodyFontSizeId, headerScaleId,
    setTheme, setLocale,
    setBodyFont, setHeaderFont, setBodyFontSize, setHeaderScale,
    toggleSidebar, closeSidebar,
  }
})
