import type { StorageKind } from './storage.js'

/**
 * Derived image files.
 *
 * Every uploaded raster image is stored as its untouched original plus a set
 * of WebP renditions. Variant object keys are *derived from the original key*,
 * so any consumer holding only the key (a DB column) can build a `srcset`
 * without looking anything up:
 *
 *   cover/2026-09/3f0c…/original.jpg   ← the upload, as received
 *   cover/2026-09/3f0c…/xs.webp        ← 150 px wide
 *   cover/2026-09/3f0c…/sm.webp        ← 300 px wide
 *   cover/2026-09/3f0c…/md.webp        ← 600 px wide
 *   cover/2026-09/3f0c…/lg.webp        ← 1200 px wide
 *   cover/2026-09/3f0c…/webp.webp      ← full size, WebP
 *   cover/2026-09/3f0c…/og.jpg         ← 1200×630 social card (cover-type assets only)
 *
 * Keys that do not follow this layout (legacy imports, absolute URLs) have no
 * variants and are served as they are.
 */

export type ResponsiveVariantName = 'xs' | 'sm' | 'md' | 'lg'
export type ImageVariantName = ResponsiveVariantName | 'webp' | 'og'
export type DerivedImageFormat = 'webp' | 'jpg'

export interface ImageVariantSpec {
  name: ImageVariantName
  /** Target width. `null` keeps the source width (capped at MAX_STORED_EDGE). */
  width: number | null
  /** Fixed height; otherwise derived from the asset's aspect ratio. */
  height?: number
  format: DerivedImageFormat
  /** Crop to the asset's aspect ratio (responsive sizes) or keep the source framing. */
  cropToAspectRatio: boolean
  /** Never generated larger than the source. */
  withoutEnlargement: boolean
}

/** Thumbnail widths shared by every image asset. */
export const THUMBNAIL_WIDTHS: Readonly<Record<ResponsiveVariantName, number>> = {
  xs: 150,
  sm: 300,
  md: 600,
  lg: 1200,
}

export const RESPONSIVE_VARIANTS: readonly ResponsiveVariantName[] = ['xs', 'sm', 'md', 'lg']

export const OPEN_GRAPH_SIZE = { width: 1200, height: 630 } as const

export const IMAGE_VARIANTS: Readonly<Record<ImageVariantName, ImageVariantSpec>> = {
  xs: { name: 'xs', width: THUMBNAIL_WIDTHS.xs, format: 'webp', cropToAspectRatio: true, withoutEnlargement: true },
  sm: { name: 'sm', width: THUMBNAIL_WIDTHS.sm, format: 'webp', cropToAspectRatio: true, withoutEnlargement: true },
  md: { name: 'md', width: THUMBNAIL_WIDTHS.md, format: 'webp', cropToAspectRatio: true, withoutEnlargement: true },
  lg: { name: 'lg', width: THUMBNAIL_WIDTHS.lg, format: 'webp', cropToAspectRatio: true, withoutEnlargement: true },
  webp: { name: 'webp', width: null, format: 'webp', cropToAspectRatio: false, withoutEnlargement: true },
  // JPEG, not WebP: some messaging apps still do not render WebP link previews.
  og: {
    name: 'og',
    width: OPEN_GRAPH_SIZE.width,
    height: OPEN_GRAPH_SIZE.height,
    format: 'jpg',
    cropToAspectRatio: false,
    withoutEnlargement: false,
  },
}

/** Variants generated for every raster image, in generation order. */
export const STANDARD_VARIANTS: readonly ImageVariantName[] = ['xs', 'sm', 'md', 'lg', 'webp']

/** Encoder settings for derived files. The original upload is never re-encoded. */
export const IMAGE_ENCODING = {
  webp: { quality: 82, alphaQuality: 90, effort: 4 },
  jpg: { quality: 84, mozjpeg: true, progressive: true },
} as const

/** Longest edge kept for the full-size WebP rendition. */
export const MAX_STORED_EDGE = 3840

/** Decompression-bomb guard: images above this many pixels are rejected before decoding. */
export const MAX_INPUT_PIXELS = 64_000_000

const EXTENSION: Record<DerivedImageFormat, string> = { webp: '.webp', jpg: '.jpg' }
const PROCESSED_KEY = /^(.+)\/original\.([a-z0-9]+)$/

/** `cover/2026-09/<id>/original.jpg` — the layout that marks a key as having variants. */
export function processedImageKey(kind: StorageKind, id: string, extension: string, date: Date = new Date()): string {
  const ext = extension.startsWith('.') ? extension : `.${extension}`
  return `${kind}/${date.toISOString().slice(0, 7)}/${id}/original${ext.toLowerCase()}`
}

export function isProcessedImageKey(key: string | null | undefined): key is string {
  return typeof key === 'string' && PROCESSED_KEY.test(key)
}

/** Object key of a variant, or `null` when the key has no variants. */
export function variantKey(originalKey: string, variant: ImageVariantName): string | null {
  const match = PROCESSED_KEY.exec(originalKey)
  if (!match) return null
  const spec = IMAGE_VARIANTS[variant]
  return `${match[1]}/${variant}${EXTENSION[spec.format]}`
}

/** Every derived key that may exist for an original (used for cleanup). */
export function allVariantKeys(originalKey: string): string[] {
  return (Object.keys(IMAGE_VARIANTS) as ImageVariantName[])
    .map((name) => variantKey(originalKey, name))
    .filter((k): k is string => k !== null)
}

/** Content type of a derived file. */
export function variantContentType(variant: ImageVariantName): string {
  return IMAGE_VARIANTS[variant].format === 'webp' ? 'image/webp' : 'image/jpeg'
}
