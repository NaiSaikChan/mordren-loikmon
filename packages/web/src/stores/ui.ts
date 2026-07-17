import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type Theme = 'light' | 'dark' | 'system'
export type Locale = 'en' | 'mon'

// ── Font options ──────────────────────────────────────────────────────────────
export interface FontOption {
  id: string
  label: string
  stack: string   // full CSS font-family value
}

export const UI_FONT_OPTIONS: FontOption[] = [
  { id: 'system',             label: 'System Default',    stack: 'system-ui, -apple-system, sans-serif' },
  { id: 'serif',              label: 'Serif',             stack: 'Georgia, "Times New Roman", serif' },
  { id: 'Padauk',             label: 'Padauk',            stack: "'Padauk', sans-serif" },
  { id: 'Noto Sans Myanmar',  label: 'Noto Sans Myanmar', stack: "'Noto Sans Myanmar', sans-serif" },
  { id: 'Noto Serif Myanmar', label: 'Noto Serif Myanmar',stack: "'Noto Serif Myanmar', serif" },
  { id: 'Mon3Anonta1',        label: 'Mon3 Anonta1',      stack: "'Mon3Anonta1', serif" },
  { id: 'MUA_Office_adobe',   label: 'MUA Office',        stack: "'MUA_Office_adobe', sans-serif" },
  { id: 'Pyidaungsu',         label: 'Pyidaungsu',        stack: "'Pyidaungsu', sans-serif" },
  { id: 'Style1',             label: 'Style 1',           stack: "'Style1', sans-serif" },
  { id: 'Style2',             label: 'Style 2',           stack: "'Style2', sans-serif" },
  { id: 'Style3',             label: 'Style 3',           stack: "'Style3', sans-serif" },
  { id: 'Style4',             label: 'Style 4',           stack: "'Style4', sans-serif" },
  { id: 'Style5',             label: 'Style 5',           stack: "'Style5', sans-serif" },
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

  // Apply font settings immediately on store creation
  applyFonts()

  return {
    theme, locale, sidebarOpen,
    bodyFont, headerFont, bodyFontSizeId, headerScaleId,
    setTheme, setLocale,
    setBodyFont, setHeaderFont, setBodyFontSize, setHeaderScale,
    toggleSidebar, closeSidebar,
  }
})
