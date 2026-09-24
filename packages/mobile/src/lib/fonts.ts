import * as Font from 'expo-font'

/**
 * Bundled font files, keyed by the family name used in styles.
 *
 * Loading all ten (~2.7 MB) before the first frame made cold start wait on
 * fonts nobody had picked. Start-up now loads only the families the saved
 * preferences need (`loadFonts(required)`), and the rest in the background.
 */
export const FONT_ASSETS = {
  Mon3Anonta1: require('../../assets/fonts/Mon3Anonta1.ttf'),
  MUA_Office_adobe: require('../../assets/fonts/MUA_Office_adobe.ttf'),
  Pyidaungsu: require('../../assets/fonts/Pyidaungsu-2.5.4_Regular.ttf'),
  PyidaungsuBold: require('../../assets/fonts/Pyidaungsu-2.5.4_Bold.ttf'),
  PyidaungsuNumbers: require('../../assets/fonts/PyidaungsuNumbers-Regular.ttf'),
  Style1: require('../../assets/fonts/Style1.ttf'),
  Style2: require('../../assets/fonts/Style2.ttf'),
  Style3: require('../../assets/fonts/Style3.ttf'),
  Style4: require('../../assets/fonts/Style4.ttf'),
  Style5: require('../../assets/fonts/Style5.ttf'),
} as const

export type BundledFontFamily = keyof typeof FONT_ASSETS

export function isBundledFont(family: string | undefined): family is BundledFontFamily {
  return !!family && Object.prototype.hasOwnProperty.call(FONT_ASSETS, family)
}

/** Load the given families (unknown/system families are ignored). Never throws. */
export async function loadFonts(families: readonly (string | undefined)[]): Promise<void> {
  const wanted = [...new Set(families.filter(isBundledFont))].filter((f) => !Font.isLoaded(f))
  if (wanted.length === 0) return
  const map = Object.fromEntries(wanted.map((f) => [f, FONT_ASSETS[f]]))
  try {
    await Font.loadAsync(map)
  } catch (err) {
    // A missing font falls back to the system face; it must never block start-up.
    if (__DEV__) console.warn('[fonts] failed to load', wanted, err)
  }
}

/** Load every bundled family (for the font picker previews), after start-up. */
export function loadAllFonts(): Promise<void> {
  return loadFonts(Object.keys(FONT_ASSETS))
}
