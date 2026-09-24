import AsyncStorage from '@react-native-async-storage/async-storage'
import { detectLocale, EMPTY_PREFERENCES, loadPreferences, PREF_KEYS } from '@/lib/preferences'

describe('detectLocale', () => {
  it('recognises Mon by its ISO 639-3 code, which devices actually report', () => {
    expect(detectLocale([{ languageCode: 'mnw', languageTag: 'mnw-MM' }])).toBe('mon')
    expect(detectLocale([{ languageCode: null, languageTag: 'mnw-MM' }])).toBe('mon')
  })

  it('still accepts the legacy "mon" value', () => {
    expect(detectLocale([{ languageCode: 'mon' }])).toBe('mon')
  })

  it('uses the first preferred language only', () => {
    expect(detectLocale([{ languageCode: 'en' }, { languageCode: 'mnw' }])).toBe('en')
  })

  it('falls back to English for anything else or nothing', () => {
    expect(detectLocale([{ languageCode: 'my' }])).toBe('en')
    expect(detectLocale([])).toBe('en')
  })
})

describe('loadPreferences', () => {
  beforeEach(() => AsyncStorage.clear())

  it('reads every preference in one pass', async () => {
    await AsyncStorage.multiSet([
      [PREF_KEYS.theme, 'dark'],
      [PREF_KEYS.locale, 'mon'],
      [PREF_KEYS.bodyFont, 'Mon3Anonta1'],
      [PREF_KEYS.headerFont, 'Pyidaungsu'],
    ])
    await expect(loadPreferences()).resolves.toEqual({
      theme: 'dark',
      locale: 'mon',
      bodyFont: 'Mon3Anonta1',
      headerFont: 'Pyidaungsu',
    })
  })

  it('ignores corrupt theme/locale values', async () => {
    await AsyncStorage.multiSet([
      [PREF_KEYS.theme, 'sepia'],
      [PREF_KEYS.locale, 'fr'],
    ])
    const prefs = await loadPreferences()
    expect(prefs.theme).toBeNull()
    expect(prefs.locale).toBeNull()
  })

  it('returns defaults when storage throws, so start-up never blocks', async () => {
    const spy = jest.spyOn(AsyncStorage, 'multiGet').mockRejectedValueOnce(new Error('disk'))
    await expect(loadPreferences()).resolves.toEqual(EMPTY_PREFERENCES)
    spy.mockRestore()
  })
})
