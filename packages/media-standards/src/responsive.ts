import {
  IMAGE_VARIANTS,
  isProcessedImageKey,
  RESPONSIVE_VARIANTS,
  THUMBNAIL_WIDTHS,
  variantKey,
  type ImageVariantName,
  type ResponsiveVariantName,
} from './variants.js'

/**
 * Responsive image descriptors built from a storage key alone.
 *
 * The backend attaches these to public JSON (it knows the storage base URL);
 * the web app renders them with `srcset` + `loading="lazy"`. For keys without
 * variants (legacy imports) `srcset` is null and `src` is the original.
 */

export interface ResponsiveImage {
  /** Best default: the `md` WebP when variants exist, else the original. */
  src: string
  /** `…/xs.webp 150w, …/sm.webp 300w, …` */
  srcset: string | null
  original: string
  variants: Partial<Record<ImageVariantName, string>>
}

export type UrlResolver = (key: string) => string | null

export function responsiveImage(key: string | null | undefined, urlFor: UrlResolver): ResponsiveImage | null {
  if (!key) return null
  const original = urlFor(key)
  if (!original) return null
  if (!isProcessedImageKey(key)) return { src: original, srcset: null, original, variants: {} }

  const variants: Partial<Record<ImageVariantName, string>> = {}
  for (const name of Object.keys(IMAGE_VARIANTS) as ImageVariantName[]) {
    const derived = variantKey(key, name)
    const url = derived ? urlFor(derived) : null
    if (url) variants[name] = url
  }
  const srcset = RESPONSIVE_VARIANTS.filter((name) => variants[name])
    .map((name) => `${variants[name]} ${THUMBNAIL_WIDTHS[name]}w`)
    .join(', ')
  return { src: variants.md ?? original, srcset: srcset || null, original, variants }
}

/** Smallest responsive variant at least `cssWidth × dpr` wide (for places that cannot use srcset). */
export function variantForWidth(cssWidth: number, devicePixelRatio = 2): ResponsiveVariantName {
  const needed = cssWidth * devicePixelRatio
  return RESPONSIVE_VARIANTS.find((name) => THUMBNAIL_WIDTHS[name] >= needed) ?? 'lg'
}

/**
 * Social card URL: an explicit Open Graph image wins, then the card generated
 * from the cover, then the cover itself. Processed keys always resolve to the
 * JPEG `og` rendition, which every link-preview crawler understands. `null`
 * lets the page use the site default.
 */
export function openGraphImageUrl(
  ogKey: string | null | undefined,
  coverKey: string | null | undefined,
  urlFor: UrlResolver,
): string | null {
  const key = ogKey || coverKey
  return key ? variantUrl(key, 'og', urlFor) : null
}

/** URL of one variant, falling back to the original for keys without variants. */
export function variantUrl(key: string | null | undefined, variant: ImageVariantName, urlFor: UrlResolver): string | null {
  if (!key) return null
  const derived = isProcessedImageKey(key) ? variantKey(key, variant) : null
  return urlFor(derived ?? key)
}
