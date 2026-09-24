import { contrastRatio, darkColors, lightColors, luminance, type ThemeColors } from '@/theme/colors'
import * as palette from '@/theme/palette'

const AA_TEXT = 4.5
const AA_NON_TEXT = 3

const textPairs: [keyof ThemeColors, keyof ThemeColors][] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['mutedText', 'background'],
  ['mutedText', 'surface'],
  ['placeholder', 'surface'],
  ['brand', 'background'],
  ['brand', 'surface'],
  ['onBrand', 'brandSolid'],
  ['danger', 'surface'],
  ['success', 'surface'],
  ['premiumText', 'surface'],
  ['audioText', 'surface'],
]

describe('contrast helpers', () => {
  it('computes known reference ratios', () => {
    expect(luminance('#ffffff')).toBeCloseTo(1)
    expect(luminance('#000000')).toBeCloseTo(0)
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21)
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1)
  })

  it('is symmetric', () => {
    expect(contrastRatio('#2563eb', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#2563eb'))
  })
})

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
] as const)('%s palette', (_name, colors) => {
  it.each(textPairs)('%s on %s meets WCAG AA (4.5:1)', (fg, bg) => {
    expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it('premium icon accent meets 3:1 non-text contrast on surface', () => {
    expect(contrastRatio(colors.premium, colors.surface)).toBeGreaterThanOrEqual(AA_NON_TEXT)
  })

  it('defines every token for both schemes', () => {
    expect(Object.keys(colors).sort()).toEqual(Object.keys(lightColors).sort())
  })
})

describe('palette', () => {
  it('keeps the brand and audio ramps distinct', () => {
    expect(palette.brand[600]).not.toBe(palette.audio[600])
    expect(lightColors.brand).toBe(palette.brand[600])
    expect(lightColors.background).toBe(palette.surface[50])
  })
})
