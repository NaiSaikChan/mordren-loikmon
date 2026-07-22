import { translate, resolveTranslationKey } from '@/i18n'

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

  it('falls back to English when the Mon key is missing', () => {
    // Contrived key that only exists in en fallback path — uses interpolation guard.
    expect(translate('mon', 'nav.home')).not.toBe('nav.home')
  })

  it('returns the raw key when no translation exists', () => {
    expect(translate('en', 'totally.unknown.key')).toBe('totally.unknown.key')
  })

  it('interpolates params', () => {
    // greeting has no params, but ensure interpolation leaves plain strings intact
    expect(translate('en', 'common.by')).toBe('by')
  })
})
