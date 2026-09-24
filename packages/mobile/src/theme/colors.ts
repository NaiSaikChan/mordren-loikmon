import { StyleSheet } from 'react-native'
import { useTheme } from '@/context/ThemeContext'
import { audio, brand, status, surface } from './palette'

/**
 * Semantic color tokens for values a NativeWind className cannot reach:
 * icon `color` props, navigation chrome, placeholders, RefreshControl tints.
 * Derived from the tailwind.config.js ramps (see ./palette.js) so the two
 * never drift. Text/background pairs are checked for WCAG AA in
 * src/__tests__/colors.test.ts.
 */
export interface ThemeColors {
  /** Screen background (bg-surface-50 / dark:bg-surface-900). */
  background: string
  /** Cards, sheets, inputs, tab bar (bg-white / dark:bg-surface-800). */
  surface: string
  /** Chips, segmented controls (bg-surface-100 / dark:bg-surface-800). */
  surfaceMuted: string
  /** Primary text. */
  text: string
  /** Secondary text and icons; meets 4.5:1 on background and surface. */
  mutedText: string
  /** Input placeholders and inactive icons. */
  placeholder: string
  /** Hairlines and card borders. */
  border: string
  /** Brand accent for text/icons on background or surface. */
  brand: string
  /** Solid brand fill (buttons, active tab). */
  brandSolid: string
  /** Text/icons drawn on `brandSolid`. */
  onBrand: string
  /** Audio accent (listening surfaces only). */
  audio: string
  /** Audio accent for text on background/surface. */
  audioText: string
  danger: string
  success: string
  /** Premium / rating accent for icons. */
  premium: string
  /** Premium accent for text. */
  premiumText: string
  starFilled: string
  starEmpty: string
  /** Image placeholder / skeleton fill. */
  placeholderFill: string
  /** Scrim over hero imagery. */
  scrim: string
  /** Translucent fill for icon buttons over imagery. */
  overlayButton: string
  /** Dark hero background behind cover art (both schemes). */
  hero: string
  /** Always-white foreground over imagery. */
  onImage: string
}

export const lightColors: ThemeColors = {
  background: surface[50],
  surface: '#ffffff',
  surfaceMuted: surface[100],
  text: surface[900],
  mutedText: surface[500],
  placeholder: surface[500],
  border: surface[200],
  brand: brand[600],
  brandSolid: brand[600],
  onBrand: '#ffffff',
  audio: audio[600],
  audioText: audio[700],
  danger: status.red600,
  success: status.emerald700,
  premium: status.amber600,
  premiumText: status.amber700,
  starFilled: status.amber500,
  starEmpty: surface[400],
  placeholderFill: surface[200],
  scrim: 'rgba(0,0,0,0.52)',
  overlayButton: 'rgba(0,0,0,0.35)',
  hero: surface[900],
  onImage: '#ffffff',
}

export const darkColors: ThemeColors = {
  background: surface[900],
  surface: surface[800],
  surfaceMuted: surface[800],
  text: surface[50],
  mutedText: surface[400],
  placeholder: surface[400],
  border: surface[700],
  brand: brand[400],
  brandSolid: brand[600],
  onBrand: '#ffffff',
  audio: audio[400],
  audioText: audio[300],
  danger: status.red400,
  success: status.emerald400,
  premium: status.amber400,
  premiumText: status.amber400,
  starFilled: status.amber400,
  starEmpty: surface[500],
  placeholderFill: surface[800],
  scrim: 'rgba(0,0,0,0.52)',
  overlayButton: 'rgba(0,0,0,0.35)',
  hero: surface[900],
  onImage: '#ffffff',
}

/** Semantic colors for the active scheme. Returns a stable object per scheme. */
export function useThemeColors(): ThemeColors {
  const { isDark } = useTheme()
  return isDark ? darkColors : lightColors
}

/** Shared radius / elevation tokens (mirrors `rounded-card` in tailwind.config.js). */
export const radius = { card: 16, control: 12, pill: 999 } as const

export const elevation = StyleSheet.create({
  card: {
    shadowColor: surface[900],
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 18,
  },
})

/** Pressed-state feedback shared by cards and list rows (Pressable style fn). */
// Pressed feedback: use NativeWind's `active:` variant on Pressable
// (e.g. className="active:opacity-80"). Do NOT pass `style` as a function
// (({ pressed }) => …): NativeWind's Pressable wrapper drops its result, which
// silently removed card widths and collapsed carousels.

// ── WCAG helpers (exported for tests) ─────────────────────────────────────
function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Relative luminance of a #rrggbb color. */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) throw new Error(`Unsupported color: ${hex}`)
  const n = parseInt(m[1], 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

/** WCAG contrast ratio between two #rrggbb colors (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
