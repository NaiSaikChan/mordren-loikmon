#!/usr/bin/env node
/*
 * Generates `assets/adaptive-icon-foreground.png` from `assets/adaptive-icon.png`.
 *
 * Android adaptive icons draw the foreground on a 108dp canvas but let the
 * launcher mask it to the middle 72dp — a circle, squircle or rounded square
 * depending on the device. Only that centre ~66% is guaranteed to survive, so
 * artwork drawn edge to edge gets its sides clipped.
 *
 * The source logo spans ~78% of its canvas, which is too wide. This script
 * rescales it to sit inside the safe zone, on a transparent canvas, leaving the
 * original artwork untouched.
 *
 * Re-run after changing `assets/adaptive-icon.png`:
 *
 *   npm i -D sharp --legacy-peer-deps
 *   npm run build:adaptive-icon
 *
 * (`--legacy-peer-deps` is unrelated to sharp: this workspace has a
 * pre-existing @react-native/jest-preset peer conflict.)
 */

const path = require('path')

const SIZE = 1024
/** Fraction of the canvas the launcher mask is guaranteed to show. */
const SAFE_ZONE = 66 / 108
/** Keep a little breathing room inside the safe circle rather than filling it. */
const FILL = 0.92

const ASSETS = path.join(__dirname, '..', 'assets')
const SOURCE = path.join(ASSETS, 'adaptive-icon.png')
const OUT = path.join(ASSETS, 'adaptive-icon-foreground.png')

let sharp
try {
  sharp = require('sharp')
} catch {
  console.error('Cannot find sharp. Install it first:\n  npm i -D sharp --legacy-peer-deps')
  process.exit(1)
}

/** Tight bounding box of the pixels that are not fully transparent. */
async function contentBounds(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let minX = info.width
  let minY = info.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) throw new Error(`${path.basename(file)} is fully transparent`)
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

;(async () => {
  const bounds = await contentBounds(SOURCE)
  const safe = Math.round(SIZE * SAFE_ZONE * FILL)
  const scale = safe / Math.max(bounds.width, bounds.height)
  const width = Math.round(bounds.width * scale)
  const height = Math.round(bounds.height * scale)

  const logo = await sharp(SOURCE).extract(bounds).resize(width, height).png().toBuffer()

  await sharp({
    create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: logo, left: Math.round((SIZE - width) / 2), top: Math.round((SIZE - height) / 2) }])
    .png()
    .toFile(OUT)

  const before = ((bounds.width / SIZE) * 100).toFixed(1)
  const after = ((width / SIZE) * 100).toFixed(1)
  console.log(`Wrote ${path.relative(process.cwd(), OUT)} — logo ${before}% → ${after}% of canvas`)
})().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
