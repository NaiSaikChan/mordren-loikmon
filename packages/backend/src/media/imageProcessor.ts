import {
  heightForWidth,
  IMAGE_ENCODING,
  IMAGE_VARIANTS,
  MAX_INPUT_PIXELS,
  matchesAspectRatio,
  MAX_STORED_EDGE,
  STANDARD_VARIANTS,
  type ImageFormatId,
  type ImageStandard,
  type ImageVariantName,
} from '@loikmon/media-standards'
import sharp, { type Sharp } from 'sharp'
import { errors } from '../lib/errors.js'

/**
 * Image inspection and variant generation (libvips via sharp).
 *
 * The original upload is stored byte-for-byte; everything derived from it —
 * the responsive WebP sizes and the Open Graph card — is produced here, from
 * the rules in @loikmon/media-standards.
 */

export interface ImageInfo {
  /** Format detected from the file's bytes — not the client's MIME type. */
  format: ImageFormatId
  width: number
  height: number
  hasAlpha: boolean
  dominantColor: string | null
}

export interface GeneratedVariant {
  name: ImageVariantName
  buffer: Buffer
  width: number
  height: number
  contentType: string
}

const SHARP_FORMAT: Record<string, ImageFormatId> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  heif: 'avif',
  avif: 'avif',
  svg: 'svg',
}

const input = (buffer: Buffer) => sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })

/**
 * SVG is XML that browsers execute. Uploaded SVGs are served from the public
 * bucket, so anything scriptable is refused rather than sanitised.
 */
export function assertSafeSvg(buffer: Buffer): void {
  const text = buffer.toString('utf8')
  const unsafe = [
    /<script[\s>]/i,
    /<foreignObject[\s>]/i,
    /\son[a-z]+\s*=/i,
    /(?:href|src)\s*=\s*["']?\s*(?:javascript|data:text\/html)/i,
    /<!ENTITY/i,
    /<iframe|<embed|<object/i,
  ]
  if (!/<svg[\s>]/i.test(text)) throw errors.validation([{ path: 'file', message: 'The file is not a valid SVG image.' }])
  if (unsafe.some((pattern) => pattern.test(text))) {
    throw errors.validation([{ path: 'file', message: 'SVG images may not contain scripts, event handlers or embedded documents.' }])
  }
}

function hex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
}

export async function inspectImage(buffer: Buffer): Promise<ImageInfo> {
  let meta: sharp.Metadata
  try {
    meta = await input(buffer).metadata()
  } catch {
    throw errors.validation([{ path: 'file', message: 'The file is not a readable image.' }])
  }
  const format = meta.format ? SHARP_FORMAT[meta.format] : undefined
  if (!format) throw errors.validation([{ path: 'file', message: `Unsupported image format "${meta.format ?? 'unknown'}".` }])

  // EXIF orientation 5–8 swaps the visible width and height.
  const rotated = (meta.orientation ?? 1) >= 5
  const width = (rotated ? meta.height : meta.width) ?? 0
  const height = (rotated ? meta.width : meta.height) ?? 0

  let dominantColor: string | null = null
  if (format !== 'svg') {
    try {
      const { dominant } = await input(buffer).stats()
      dominantColor = `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}`
    } catch {
      dominantColor = null
    }
  }

  return { format, width, height, hasAlpha: Boolean(meta.hasAlpha), dominantColor }
}

function encode(pipeline: Sharp, variant: ImageVariantName): Sharp {
  return IMAGE_VARIANTS[variant].format === 'webp'
    ? pipeline.webp(IMAGE_ENCODING.webp)
    : pipeline.flatten({ background: '#ffffff' }).jpeg(IMAGE_ENCODING.jpg)
}

async function render(pipeline: Sharp, variant: ImageVariantName): Promise<GeneratedVariant> {
  const { data, info } = await encode(pipeline, variant).toBuffer({ resolveWithObject: true })
  return {
    name: variant,
    buffer: data,
    width: info.width,
    height: info.height,
    contentType: IMAGE_VARIANTS[variant].format === 'webp' ? 'image/webp' : 'image/jpeg',
  }
}

/**
 * Decoder for one rendition. Vectors are rasterised at the density the target
 * width needs (72 dpi is the SVG's nominal size), so icons stay crisp at any size.
 */
function source(buffer: Buffer, info: ImageInfo, targetWidth?: number): Sharp {
  if (info.format !== 'svg') return input(buffer)
  const density = targetWidth && info.width ? Math.min(2400, Math.max(72, Math.ceil((72 * targetWidth) / info.width))) : 300
  return sharp(buffer, { density, limitInputPixels: MAX_INPUT_PIXELS })
}

/** One responsive size (xs–lg) or the full-size WebP. */
async function renderVariant(buffer: Buffer, info: ImageInfo, standard: ImageStandard, variant: ImageVariantName): Promise<GeneratedVariant> {
  const spec = IMAGE_VARIANTS[variant]
  const vector = info.format === 'svg'
  // Rasters are never upscaled; vectors scale without loss.
  const withoutEnlargement = spec.withoutEnlargement && !vector

  if (!spec.cropToAspectRatio || !standard.aspectRatio) {
    const naturalWidth = vector ? (standard.recommended?.width ?? info.width) : info.width
    const width = Math.min(spec.width ?? naturalWidth, MAX_STORED_EDGE)
    // rotate() applies EXIF orientation; metadata is stripped because sharp does not copy it by default.
    const pipeline = source(buffer, info, width).rotate()
    return render(pipeline.resize({ width, height: MAX_STORED_EDGE, fit: 'inside', withoutEnlargement }), variant)
  }

  // A 900 px source yields a 900 px "lg" — still at the standard's ratio.
  const targetWidth = withoutEnlargement ? Math.min(spec.width!, info.width || spec.width!) : spec.width!
  const targetHeight = heightForWidth(standard.aspectRatio, targetWidth)
  return render(
    source(buffer, info, targetWidth)
      .rotate()
      .resize({
        width: targetWidth,
        height: targetHeight,
        fit: standard.fit,
        position: 'attention',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      }),
    variant,
  )
}

/**
 * 1200×630 social card. An image already at 1.91:1 fills it; anything else is
 * centred over a blurred, darkened copy of itself, so portrait book covers and
 * square audiobook covers are never cropped into unrecognisable strips.
 */
async function renderOpenGraph(buffer: Buffer, info: ImageInfo): Promise<GeneratedVariant> {
  const { width, height } = IMAGE_VARIANTS.og as { width: number; height: number }
  const card = { width, height, label: '1.91:1' }
  if (info.width && info.height && matchesAspectRatio(card, info.width, info.height)) {
    return render(source(buffer, info, width).rotate().resize({ width, height, fit: 'cover' }), 'og')
  }
  const background = await source(buffer, info, width)
    .rotate()
    .resize({ width, height, fit: 'cover' })
    .blur(28)
    .modulate({ brightness: 0.55 })
    .flatten({ background: '#111111' })
    .toBuffer()
  const foreground = await source(buffer, info, width)
    .rotate()
    .resize({ width: width - 96, height: height - 64, fit: 'inside' })
    .png()
    .toBuffer()

  return render(sharp(background).composite([{ input: foreground, gravity: 'centre' }]), 'og')
}

export async function generateVariants(buffer: Buffer, info: ImageInfo, standard: ImageStandard): Promise<GeneratedVariant[]> {
  const out: GeneratedVariant[] = []
  for (const variant of STANDARD_VARIANTS) {
    out.push(await renderVariant(buffer, info, standard, variant))
  }
  if (standard.generateOpenGraph) out.push(await renderOpenGraph(buffer, info))
  return out
}
