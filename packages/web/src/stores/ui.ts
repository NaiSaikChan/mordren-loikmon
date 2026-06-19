import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type Theme = 'light' | 'dark' | 'system'
export type Locale = 'en' | 'mon'

export const useUiStore = defineStore('ui', () => {
  const theme = ref<Theme>((localStorage.getItem('theme') as Theme) ?? 'system')
  const locale = ref<Locale>((localStorage.getItem('locale') as Locale) ?? 'en')
  const sidebarOpen = ref(false)

  function applyTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = theme.value === 'dark' || (theme.value === 'system' && prefersDark)
    document.documentElement.classList.toggle('dark', isDark)
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

  function toggleSidebar() { sidebarOpen.value = !sidebarOpen.value }
  function closeSidebar() { sidebarOpen.value = false }

  // Listen for OS preference changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (theme.value === 'system') applyTheme()
  })

  watch(theme, applyTheme, { immediate: true })

  return { theme, locale, sidebarOpen, setTheme, setLocale, toggleSidebar, closeSidebar }
})
