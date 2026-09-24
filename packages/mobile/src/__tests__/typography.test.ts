import {
  FONT_OPTIONS,
  getFontFamily,
  MON_LOCALE_FALLBACK_FONT_ID,
  MON_SAFE_FONT_IDS,
  requiredFontFamilies,
  resolveFontIdForLocale,
} from '@/context/TypographyContext'
import { FONT_ASSETS } from '@/lib/fonts'

describe('resolveFontIdForLocale', () => {
  it('keeps Mon-safe fonts in Mon locale', () => {
    expect(resolveFontIdForLocale('Pyidaungsu', 'mon')).toBe('Pyidaungsu')
    expect(resolveFontIdForLocale('Mon3Anonta1', 'mon')).toBe('Mon3Anonta1')
  })

  it('falls back unsafe fonts in Mon locale', () => {
    expect(resolveFontIdForLocale('system', 'mon')).toBe(MON_LOCALE_FALLBACK_FONT_ID)
    expect(resolveFontIdForLocale('serif', 'mon')).toBe(MON_LOCALE_FALLBACK_FONT_ID)
    expect(resolveFontIdForLocale('Style1', 'mon')).toBe(MON_LOCALE_FALLBACK_FONT_ID)
  })

  it('preserves user choice outside Mon locale', () => {
    expect(resolveFontIdForLocale('serif', 'en')).toBe('serif')
    expect(resolveFontIdForLocale('Style1', 'en')).toBe('Style1')
  })
})

describe('MON_SAFE_FONT_IDS', () => {
  it('does not expose fonts that do not reliably shape Mon text', () => {
    expect(MON_SAFE_FONT_IDS.has('system')).toBe(false)
    expect(MON_SAFE_FONT_IDS.has('serif')).toBe(false)
  })
})
describe('bundled fonts', () => {
  const bundled = new Set(Object.keys(FONT_ASSETS))

  it('only offers font families that ship with the app', () => {
    for (const option of FONT_OPTIONS) {
      if (option.family) expect(bundled.has(option.family)).toBe(true)
    }
  })

  it('falls Mon text back to a bundled family', () => {
    expect(bundled.has(getFontFamily(MON_LOCALE_FALLBACK_FONT_ID) ?? '')).toBe(true)
    for (const id of MON_SAFE_FONT_IDS) expect(bundled.has(getFontFamily(id) ?? '')).toBe(true)
  })
})

describe('requiredFontFamilies', () => {
  it('loads only the saved body and header families', () => {
    expect(requiredFontFamilies({ bodyFont: 'Style2', headerFont: 'Mon3Anonta1' }, 'en')).toEqual(['Style2', 'Mon3Anonta1'])
  })

  it('resolves Mon-unsafe choices to the fallback in the Mon locale', () => {
    expect(requiredFontFamilies({ bodyFont: 'Style2', headerFont: 'system' }, 'mon')).toEqual(['Pyidaungsu', 'Pyidaungsu'])
  })

  it('uses the default for unknown or removed fonts (e.g. a saved "Padauk")', () => {
    expect(requiredFontFamilies({ bodyFont: 'Padauk', headerFont: null }, 'en')).toEqual(['Pyidaungsu', 'Pyidaungsu'])
  })

  it('needs nothing for system fonts', () => {
    expect(requiredFontFamilies({ bodyFont: 'system', headerFont: 'serif' }, 'en')).toEqual(['serif'])
  })
})
