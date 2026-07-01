/**
 * i18n completeness tests
 * Ensures both en.json and mon.json have the same keys so the UI never
 * falls back to raw key strings in Mon language mode.
 */
import { describe, it, expect } from 'vitest'
import en  from '../i18n/locales/en.json'
import mon from '../i18n/locales/mon.json'

// Flatten nested keys: { nav: { home: '…' } } → ['nav.home']
function flatKeys(obj: Record<string, any>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const full = prefix ? `${prefix}.${k}` : k
    return typeof v === 'object' && v !== null ? flatKeys(v, full) : [full]
  })
}

const enKeys  = new Set(flatKeys(en  as any))
const monKeys = new Set(flatKeys(mon as any))

const criticalSections = ['nav', 'common', 'auth', 'books', 'articles', 'authors', 'search', 'library', 'purchases', 'settings']

describe('i18n', () => {
  describe('en.json completeness', () => {
    for (const section of criticalSections) {
      it(`has [${section}] section`, () => {
        const keys = [...enKeys].filter(k => k.startsWith(section + '.'))
        expect(keys.length).toBeGreaterThan(0)
      })
    }
  })

  describe('mon.json completeness', () => {
    for (const section of criticalSections) {
      it(`has [${section}] section`, () => {
        const keys = [...monKeys].filter(k => k.startsWith(section + '.'))
        expect(keys.length).toBeGreaterThan(0)
      })
    }
  })

  describe('key parity — mon.json must have every key in en.json', () => {
    it('no missing keys in mon.json', () => {
      const missing = [...enKeys].filter(k => !monKeys.has(k))
      expect(missing, `Missing in mon.json: ${missing.join(', ')}`).toEqual([])
    })
  })

  describe('key parity — en.json must have every key in mon.json', () => {
    it('no extra keys in mon.json without en.json counterpart', () => {
      const extra = [...monKeys].filter(k => !enKeys.has(k))
      expect(extra, `Extra in mon.json not in en.json: ${extra.join(', ')}`).toEqual([])
    })
  })

  describe('values are non-empty strings', () => {
    it('all en.json values are non-empty', () => {
      const empties = flatKeys(en as any).filter(k => {
        const parts = k.split('.')
        let v: any = en
        for (const p of parts) v = (v as any)[p]
        return typeof v === 'string' && v.trim() === ''
      })
      expect(empties, `Empty values in en.json: ${empties.join(', ')}`).toEqual([])
    })

    it('all mon.json values are non-empty', () => {
      const empties = flatKeys(mon as any).filter(k => {
        const parts = k.split('.')
        let v: any = mon
        for (const p of parts) v = (v as any)[p]
        return typeof v === 'string' && v.trim() === ''
      })
      expect(empties, `Empty values in mon.json: ${empties.join(', ')}`).toEqual([])
    })
  })
})
