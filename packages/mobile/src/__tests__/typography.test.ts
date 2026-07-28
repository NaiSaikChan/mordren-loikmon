import {
  MON_LOCALE_FALLBACK_FONT_ID,
  MON_SAFE_FONT_IDS,
  resolveFontIdForLocale,
} from '@/context/TypographyContext'

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