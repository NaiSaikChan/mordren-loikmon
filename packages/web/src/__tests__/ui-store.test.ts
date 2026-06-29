/**
 * UI store — unit tests
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUiStore } from '../stores/ui'

describe('ui store', () => {

  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  // ── initial state ──────────────────────────────────────────────────────────
  it('default theme is system', () => {
    const store = useUiStore()
    expect(store.theme).toBe('system')
  })

  it('default locale is en', () => {
    const store = useUiStore()
    expect(store.locale).toBe('en')
  })

  it('sidebar is closed by default', () => {
    const store = useUiStore()
    expect(store.sidebarOpen).toBe(false)
  })

  // ── setTheme() ─────────────────────────────────────────────────────────────
  describe('setTheme()', () => {
    it('updates theme to dark', () => {
      const store = useUiStore()
      store.setTheme('dark')
      expect(store.theme).toBe('dark')
    })

    it('persists theme to localStorage', () => {
      const store = useUiStore()
      store.setTheme('light')
      expect(localStorage.getItem('theme')).toBe('light')
    })

    it('accepts all three valid values', () => {
      const store = useUiStore()
      for (const t of ['light', 'dark', 'system'] as const) {
        store.setTheme(t)
        expect(store.theme).toBe(t)
      }
    })
  })

  // ── setLocale() ────────────────────────────────────────────────────────────
  describe('setLocale()', () => {
    it('updates locale to mon', () => {
      const store = useUiStore()
      store.setLocale('mon')
      expect(store.locale).toBe('mon')
    })

    it('persists locale to localStorage', () => {
      const store = useUiStore()
      store.setLocale('mon')
      expect(localStorage.getItem('locale')).toBe('mon')
    })

    it('can switch back to en', () => {
      const store = useUiStore()
      store.setLocale('mon')
      store.setLocale('en')
      expect(store.locale).toBe('en')
    })
  })

  // ── sidebar ────────────────────────────────────────────────────────────────
  describe('toggleSidebar() / closeSidebar()', () => {
    it('toggleSidebar opens the sidebar', () => {
      const store = useUiStore()
      store.toggleSidebar()
      expect(store.sidebarOpen).toBe(true)
    })

    it('toggleSidebar closes when already open', () => {
      const store = useUiStore()
      store.toggleSidebar()
      store.toggleSidebar()
      expect(store.sidebarOpen).toBe(false)
    })

    it('closeSidebar always closes', () => {
      const store = useUiStore()
      store.toggleSidebar()
      store.closeSidebar()
      expect(store.sidebarOpen).toBe(false)
    })

    it('closeSidebar is idempotent when already closed', () => {
      const store = useUiStore()
      store.closeSidebar()
      store.closeSidebar()
      expect(store.sidebarOpen).toBe(false)
    })
  })

  // ── reads localStorage on init ─────────────────────────────────────────────
  describe('reads persisted localStorage values on init', () => {
    it('picks up saved theme', () => {
      localStorage.setItem('theme', 'dark')
      setActivePinia(createPinia())
      const store = useUiStore()
      expect(store.theme).toBe('dark')
    })

    it('picks up saved locale', () => {
      localStorage.setItem('locale', 'mon')
      setActivePinia(createPinia())
      const store = useUiStore()
      expect(store.locale).toBe('mon')
    })
  })
})
