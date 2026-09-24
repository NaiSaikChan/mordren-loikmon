/** @type {import('tailwindcss').Config} */
const { brand, audio, surface } = require('./src/theme/palette')

module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand,
        // Audio accent — listening surfaces only (see src/theme/palette.js).
        audio,
        surface,
      },
      // Type scale with generous line-heights (~1.6–1.75×): Mon/Myanmar script
      // stacks diacritics above and below the baseline and clips at Tailwind's
      // default leading. Prefer these over ad-hoc padding compensation.
      fontSize: {
        '2xs': ['11px', { lineHeight: '18px' }],
        xs: ['12px', { lineHeight: '20px' }],
        sm: ['14px', { lineHeight: '24px' }],
        base: ['16px', { lineHeight: '28px' }],
        lg: ['18px', { lineHeight: '30px' }],
        xl: ['20px', { lineHeight: '32px' }],
        '2xl': ['24px', { lineHeight: '38px' }],
        '3xl': ['30px', { lineHeight: '46px' }],
        '4xl': ['36px', { lineHeight: '54px' }],
        '5xl': ['48px', { lineHeight: '64px' }],
      },
      borderRadius: {
        // Mirrors `radius` in src/theme/colors.ts.
        card: '16px',
        control: '12px',
      },
      minHeight: {
        // WCAG 2.5.5 touch target.
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [],
}
