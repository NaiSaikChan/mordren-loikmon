import {
  AUDIO_FORMATS,
  DOCUMENT_FORMATS,
  RASTER_IMAGE_FORMATS,
  UPLOAD_LIMITS,
  type AudioFormatId,
  type DocumentFormatId,
  type ImageFormatId,
  type MediaCategory,
  type MediaFormatId,
} from './formats.js'
import type { StorageKind } from './storage.js'

/**
 * Media asset standards — one entry per place an asset is used.
 *
 * The CMS upload control, the upload API, the image processor, the media
 * library filters and the storefront renderer all read these entries; nothing
 * else in the codebase should spell out a ratio, a pixel size or a format list.
 *
 * Dimensions are in pixels. `minimum` is enforced (uploads below it are
 * rejected); `recommended` is advisory (smaller uploads get a warning).
 */

export interface Size {
  width: number
  height: number
}

export interface AspectRatio {
  width: number
  height: number
  /** Human label, e.g. `2:3` or `1.91:1`. */
  label: string
}

export type DisplayShape = 'rect' | 'rounded' | 'circle'

interface BaseStandard {
  label: string
  category: MediaCategory
  storageKind: StorageKind
  formats: readonly MediaFormatId[]
  maxBytes: number
  /** Where the asset appears — shown as help text in the CMS. */
  usage: readonly string[]
}

export interface ImageStandard extends BaseStandard {
  category: 'image'
  formats: readonly ImageFormatId[]
  preferredFormat: ImageFormatId
  /** `null` = free-form (logos, generic library images). */
  aspectRatio: AspectRatio | null
  recommended: Size | null
  minimum: Size | null
  /** Size of the thumbnail the UI renders for this asset, when it has a dedicated one. */
  thumbnail: Size | null
  display: DisplayShape
  /** How variants are fitted to the aspect ratio: crop (`cover`) or letterbox (`contain`). */
  fit: 'cover' | 'contain'
  transparentBackground: 'preferred' | 'allowed' | 'none'
  /** Generate a 1200×630 Open Graph card from this image. */
  generateOpenGraph: boolean
  /** Must be previewed in its display frame before it is saved. */
  previewRequired: boolean
  /** Uploaded as a separate file alongside this asset type (e.g. hero desktop ↔ mobile). */
  pairedWith: ImageAssetType | null
}

export interface DocumentStandard extends BaseStandard {
  category: 'document'
  formats: readonly DocumentFormatId[]
}

export interface AudioStandard extends BaseStandard {
  category: 'audio'
  formats: readonly AudioFormatId[]
}

export type ImageAssetType =
  | 'book_cover'
  | 'audiobook_cover'
  | 'article_cover'
  | 'author_avatar'
  | 'user_avatar'
  | 'admin_avatar'
  | 'hero_desktop'
  | 'hero_mobile'
  | 'promo_banner'
  | 'category_icon'
  | 'category_cover'
  | 'collection_cover'
  | 'membership_plan'
  | 'coupon_banner'
  | 'policy_thumbnail'
  | 'og_image'
  | 'brand_logo'
  | 'library_image'

export type DocumentAssetType = 'book_pdf' | 'book_epub'
export type AudioAssetType = 'audio_chapter' | 'article_narration'
export type MediaAssetType = ImageAssetType | DocumentAssetType | AudioAssetType

export type MediaStandard = ImageStandard | DocumentStandard | AudioStandard

const ratio = (width: number, height: number, label = `${width}:${height}`): AspectRatio => ({ width, height, label })
const size = (width: number, height: number): Size => ({ width, height })

/**
 * Relative tolerance when comparing an upload's ratio to the standard. The
 * specified pixel sizes are themselves rounded (1920×820 is 0.35 % off 21:9,
 * 1200×630 is 0.3 % off 1.91:1), so an exact match cannot be required.
 */
export const ASPECT_RATIO_TOLERANCE = 0.02

type ImageDefaults = Omit<ImageStandard, 'label' | 'storageKind' | 'aspectRatio' | 'recommended' | 'minimum' | 'usage'>

const IMAGE_DEFAULTS: ImageDefaults = {
  category: 'image',
  formats: RASTER_IMAGE_FORMATS,
  preferredFormat: 'webp',
  maxBytes: UPLOAD_LIMITS.image,
  thumbnail: null,
  display: 'rounded',
  fit: 'cover',
  transparentBackground: 'none',
  generateOpenGraph: false,
  previewRequired: false,
  pairedWith: null,
}

const image = (spec: Partial<ImageDefaults> & Pick<ImageStandard, 'label' | 'storageKind' | 'aspectRatio' | 'recommended' | 'minimum' | 'usage'>): ImageStandard => ({
  ...IMAGE_DEFAULTS,
  ...spec,
})

export const IMAGE_STANDARDS: Readonly<Record<ImageAssetType, ImageStandard>> = {
  book_cover: image({
    label: 'Book cover',
    storageKind: 'cover',
    aspectRatio: ratio(2, 3),
    recommended: size(1600, 2400),
    minimum: size(800, 1200),
    thumbnail: size(320, 480),
    generateOpenGraph: true,
    usage: ['Book details', 'Search', 'Library', 'Featured'],
  }),
  audiobook_cover: image({
    label: 'Audiobook cover',
    storageKind: 'cover',
    aspectRatio: ratio(1, 1),
    recommended: size(2000, 2000),
    minimum: size(1000, 1000),
    thumbnail: size(300, 300),
    generateOpenGraph: true,
    usage: ['Audio player', 'Library'],
  }),
  article_cover: image({
    label: 'Article cover',
    storageKind: 'thumbnail',
    aspectRatio: ratio(16, 9),
    recommended: size(1600, 900),
    minimum: size(1200, 675),
    thumbnail: size(400, 225),
    generateOpenGraph: true,
    usage: ['Blog', 'Homepage'],
  }),
  author_avatar: image({
    label: 'Author avatar',
    storageKind: 'avatar',
    aspectRatio: ratio(1, 1),
    recommended: size(800, 800),
    minimum: size(400, 400),
    display: 'circle',
    usage: ['Author profile', 'Book and article bylines'],
  }),
  user_avatar: image({
    label: 'Profile picture',
    storageKind: 'avatar',
    aspectRatio: ratio(1, 1),
    recommended: size(800, 800),
    minimum: size(300, 300),
    display: 'circle',
    usage: ['Account', 'Reviews'],
  }),
  admin_avatar: image({
    label: 'CMS admin avatar',
    storageKind: 'avatar',
    aspectRatio: ratio(1, 1),
    recommended: size(512, 512),
    minimum: null,
    display: 'circle',
    usage: ['CMS header', 'Activity log'],
  }),
  hero_desktop: image({
    label: 'Hero banner (desktop)',
    storageKind: 'slider',
    aspectRatio: ratio(21, 9),
    recommended: size(1920, 820),
    minimum: size(1600, 685),
    pairedWith: 'hero_mobile',
    previewRequired: true,
    usage: ['Homepage slider on tablets and desktops'],
  }),
  hero_mobile: image({
    label: 'Hero banner (mobile)',
    storageKind: 'slider',
    aspectRatio: ratio(4, 5),
    recommended: size(1080, 1350),
    minimum: null,
    pairedWith: 'hero_desktop',
    previewRequired: true,
    usage: ['Homepage slider on phones — upload separately, preview before saving'],
  }),
  promo_banner: image({
    label: 'Promotional banner',
    storageKind: 'banner',
    aspectRatio: ratio(16, 9),
    recommended: size(1600, 900),
    minimum: null,
    generateOpenGraph: true,
    usage: ['Campaigns', 'In-app promotions'],
  }),
  category_icon: image({
    label: 'Category icon',
    storageKind: 'category',
    aspectRatio: ratio(1, 1),
    recommended: size(256, 256),
    minimum: size(128, 128),
    formats: ['svg', 'png', 'webp', 'jpg', 'avif'],
    preferredFormat: 'svg',
    fit: 'contain',
    transparentBackground: 'preferred',
    usage: ['Category menus and chips'],
  }),
  category_cover: image({
    label: 'Category cover',
    storageKind: 'category',
    aspectRatio: ratio(16, 9),
    recommended: size(1600, 900),
    minimum: null,
    generateOpenGraph: true,
    usage: ['Category landing page'],
  }),
  collection_cover: image({
    label: 'Collection cover',
    storageKind: 'cover',
    aspectRatio: ratio(3, 1),
    recommended: size(1800, 600),
    minimum: size(1200, 400),
    generateOpenGraph: true,
    usage: ['Featured and curated collections'],
  }),
  membership_plan: image({
    label: 'Membership plan image',
    storageKind: 'banner',
    aspectRatio: ratio(16, 9),
    recommended: size(1200, 675),
    minimum: null,
    usage: ['Membership plans page'],
  }),
  coupon_banner: image({
    label: 'Coupon banner',
    storageKind: 'banner',
    aspectRatio: ratio(16, 9),
    recommended: size(1600, 900),
    minimum: null,
    usage: ['Coupon campaigns'],
  }),
  policy_thumbnail: image({
    label: 'Policy / terms thumbnail',
    storageKind: 'thumbnail',
    aspectRatio: ratio(16, 9),
    recommended: size(1200, 675),
    minimum: null,
    usage: ['Policies and terms listing'],
  }),
  og_image: image({
    label: 'Open Graph image',
    storageKind: 'og',
    aspectRatio: ratio(1.91, 1, '1.91:1'),
    recommended: size(1200, 630),
    minimum: null,
    // Re-rendered as the JPEG card so an AVIF or PNG upload still previews everywhere.
    generateOpenGraph: true,
    usage: ['Social and messaging link previews — generated from the cover when missing'],
  }),
  // Not in the original asset table: the site logo and free-form library images
  // still need a standard so every upload is validated the same way.
  brand_logo: image({
    label: 'Site logo',
    storageKind: 'brand',
    aspectRatio: null,
    recommended: null,
    minimum: null,
    formats: ['svg', 'png', 'webp'],
    preferredFormat: 'svg',
    fit: 'contain',
    transparentBackground: 'preferred',
    usage: ['Header', 'Emails'],
  }),
  library_image: image({
    label: 'Library image',
    storageKind: 'thumbnail',
    aspectRatio: null,
    recommended: null,
    minimum: null,
    usage: ['Media library uploads not yet attached to content'],
  }),
}

export const DOCUMENT_STANDARDS: Readonly<Record<DocumentAssetType, DocumentStandard>> = {
  book_pdf: {
    label: 'PDF edition',
    category: 'document',
    storageKind: 'pdf',
    formats: ['pdf'],
    maxBytes: UPLOAD_LIMITS.document,
    usage: ['Book reader'],
  },
  book_epub: {
    label: 'EPUB edition',
    category: 'document',
    storageKind: 'epub',
    formats: ['epub'],
    maxBytes: UPLOAD_LIMITS.document,
    usage: ['Book reader'],
  },
}

export const AUDIO_STANDARDS: Readonly<Record<AudioAssetType, AudioStandard>> = {
  audio_chapter: {
    label: 'Audiobook chapter',
    category: 'audio',
    storageKind: 'audio',
    formats: AUDIO_FORMATS,
    maxBytes: UPLOAD_LIMITS.audio,
    usage: ['Audio player'],
  },
  article_narration: {
    label: 'Article narration',
    category: 'audio',
    storageKind: 'audio',
    formats: AUDIO_FORMATS,
    maxBytes: UPLOAD_LIMITS.audio,
    usage: ['Article audio player'],
  },
}

export const MEDIA_STANDARDS: Readonly<Record<MediaAssetType, MediaStandard>> = {
  ...IMAGE_STANDARDS,
  ...DOCUMENT_STANDARDS,
  ...AUDIO_STANDARDS,
}

export const MEDIA_ASSET_TYPES = Object.keys(MEDIA_STANDARDS) as MediaAssetType[]
export const IMAGE_ASSET_TYPES = Object.keys(IMAGE_STANDARDS) as ImageAssetType[]

/** Formats accepted per category — the media library's type filter. */
export const FORMATS_BY_CATEGORY = { image: RASTER_IMAGE_FORMATS, document: DOCUMENT_FORMATS, audio: AUDIO_FORMATS } as const

export function isMediaAssetType(value: unknown): value is MediaAssetType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(MEDIA_STANDARDS, value)
}

export function getStandard<T extends MediaAssetType>(type: T): (typeof MEDIA_STANDARDS)[T] {
  return MEDIA_STANDARDS[type]
}

export function isImageStandard(standard: MediaStandard): standard is ImageStandard {
  return standard.category === 'image'
}

export function isImageAssetType(type: MediaAssetType): type is ImageAssetType {
  return MEDIA_STANDARDS[type].category === 'image'
}

/**
 * The asset type an older, kind-only upload maps to. Used for requests that
 * predate asset types (`POST /cms/media` with `kind`) — validated as free-form.
 */
export const DEFAULT_ASSET_TYPE_FOR_KIND: Readonly<Record<StorageKind, MediaAssetType>> = {
  cover: 'library_image',
  thumbnail: 'library_image',
  avatar: 'library_image',
  slider: 'library_image',
  category: 'library_image',
  banner: 'library_image',
  brand: 'brand_logo',
  og: 'og_image',
  pdf: 'book_pdf',
  epub: 'book_epub',
  audio: 'audio_chapter',
}

/** Height matching a width for an aspect ratio (rounded). */
export function heightForWidth(aspect: AspectRatio, width: number): number {
  return Math.round((width * aspect.height) / aspect.width)
}

export function sizeLabel(s: Size | null): string | null {
  return s ? `${s.width}×${s.height}` : null
}
