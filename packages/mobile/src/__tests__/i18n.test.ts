import { translate, resolveTranslationKey, messages } from '@/i18n'

function keysOf(obj: unknown, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return [prefix]
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) => keysOf(value, prefix ? `${prefix}.${key}` : key))
}

describe('resolveTranslationKey', () => {
  it('resolves nested dotted keys', () => {
    expect(resolveTranslationKey({ nav: { home: 'Home' } }, 'nav.home')).toBe('Home')
  })
  it('returns undefined for missing keys', () => {
    expect(resolveTranslationKey({ nav: {} }, 'nav.missing')).toBeUndefined()
  })
})

describe('translate', () => {
  it('translates a known key for English', () => {
    expect(translate('en', 'nav.home')).toBe('Home')
  })

  it('translates Mon keys', () => {
    expect(translate('mon', 'nav.home')).not.toBe('nav.home')
  })

  it('returns the raw key when no translation exists', () => {
    expect(translate('en', 'totally.unknown.key')).toBe('totally.unknown.key')
  })

  it('interpolates params', () => {
    expect(translate('en', 'subscribe.save', { percent: 17 })).toBe('Save 17%')
  })
})

describe('locale files', () => {
  it('English and Mon define the same key set', () => {
    expect(keysOf(messages.mon).sort()).toEqual(keysOf(messages.en).sort())
  })

  it('no longer contain the coin economy', () => {
    const all = keysOf(messages.en)
    expect(all.some((key) => key.startsWith('purchases.'))).toBe(false)
    // No key or copy mentions the old wallet currency.
    expect(JSON.stringify(messages.en)).not.toMatch(/co[i]n/i)
    expect(JSON.stringify(messages.mon)).not.toMatch(/co[i]n/i)
  })
})
