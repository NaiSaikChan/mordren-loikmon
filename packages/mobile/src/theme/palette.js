/**
 * Raw color ramps — the single source of truth shared by tailwind.config.js
 * (CommonJS, build time) and src/theme/colors.ts (semantic runtime tokens for
 * icons, navigation chrome and other places a className cannot reach).
 */
const brand = {
  50: '#eff6ff',
  100: '#dbeafe',
  200: '#bfdbfe',
  300: '#93c5fd',
  400: '#60a5fa',
  500: '#3b82f6',
  600: '#2563eb',
  700: '#1d4ed8',
  800: '#1e40af',
  900: '#1e3a8a',
}

// Audio accent — the audiobook identity, distinct from the blue brand ramp.
// Mirrors --color-audio-* on the web. Listening surfaces only.
const audio = {
  50: '#fbf6ec',
  100: '#f5e9cf',
  200: '#ebd5a3',
  300: '#dfbe72',
  400: '#d4a843',
  500: '#c9922a',
  600: '#a87722',
  700: '#855d1b',
  800: '#634515',
  900: '#422e0e',
  950: '#26190a',
}

const surface = {
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
  950: '#020617',
}

// Status hues (Tailwind defaults) used by semantic tokens.
const status = {
  red400: '#f87171',
  red600: '#dc2626',
  emerald400: '#34d399',
  emerald700: '#047857',
  amber400: '#fbbf24',
  amber500: '#f59e0b',
  amber600: '#d97706',
  amber700: '#b45309',
}

module.exports = { brand, audio, surface, status }
