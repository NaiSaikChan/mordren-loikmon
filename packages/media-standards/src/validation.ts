import { acceptFor, detectFormat, formatBytes, formatLabels, MEDIA_FORMATS, type MediaFormat } from './formats.js'
import {
  ASPECT_RATIO_TOLERANCE,
  MEDIA_STANDARDS,
  sizeLabel,
  type AspectRatio,
  type ImageStandard,
  type MediaAssetType,
} from './standards.js'

/**
 * Upload validation, identical in the browser (instant feedback before the
 * upload starts) and on the server (the authority — it re-reads dimensions
 * from the decoded file, never from the client).
 *
 * Errors reject the upload. Warnings are shown but do not block it.
 */

export type MediaIssueCode =
  | 'empty_file'
  | 'format_not_allowed'
  | 'file_too_large'
  | 'dimensions_unknown'
  | 'below_minimum'
  | 'aspect_ratio_mismatch'
  | 'below_recommended'
  | 'not_preferred_format'

export interface MediaIssue {
  code: MediaIssueCode
  severity: 'error' | 'warning'
  message: string
}

export interface UploadCandidate {
  mimeType?: string | null
  filename?: string | null
  bytes: number
  /** Pixel size of a raster image; omit for vectors, documents and audio. */
  width?: number | null
  height?: number | null
}

export interface ValidationResult {
  ok: boolean
  format: MediaFormat | null
  errors: MediaIssue[]
  warnings: MediaIssue[]
}

const error = (code: MediaIssueCode, message: string): MediaIssue => ({ code, severity: 'error', message })
const warning = (code: MediaIssueCode, message: string): MediaIssue => ({ code, severity: 'warning', message })

/** Relative deviation of `width / height` from the target ratio (0 = exact). */
export function aspectRatioDeviation(aspect: AspectRatio, width: number, height: number): number {
  const target = aspect.width / aspect.height
  return Math.abs(width / height - target) / target
}

export function matchesAspectRatio(aspect: AspectRatio, width: number, height: number): boolean {
  return aspectRatioDeviation(aspect, width, height) <= ASPECT_RATIO_TOLERANCE
}

/** Dimension rules for a raster image. */
export function validateImageDimensions(standard: ImageStandard, width: number, height: number): MediaIssue[] {
  const issues: MediaIssue[] = []
  const { minimum, recommended, aspectRatio } = standard

  if (minimum && (width < minimum.width || height < minimum.height)) {
    issues.push(
      error(
        'below_minimum',
        `${standard.label} must be at least ${sizeLabel(minimum)} px — this image is ${width}×${height}.`,
      ),
    )
  }

  if (aspectRatio && !matchesAspectRatio(aspectRatio, width, height)) {
    const action = standard.fit === 'contain' ? 'letterboxed' : 'center-cropped'
    issues.push(
      warning(
        'aspect_ratio_mismatch',
        `${standard.label} should be ${aspectRatio.label}; this image is ${width}×${height} and will be ${action} in thumbnails.`,
      ),
    )
  }

  if (recommended && !issues.some((i) => i.code === 'below_minimum') && (width < recommended.width || height < recommended.height)) {
    issues.push(
      warning('below_recommended', `Recommended size is ${sizeLabel(recommended)} px for sharp results on high-density screens.`),
    )
  }

  return issues
}

/**
 * Validate an upload against an asset type. `maxBytes` may *lower* the
 * standard's limit (a deployment's UPLOAD_MAX_MB), never raise it.
 */
export function validateMediaUpload(
  type: MediaAssetType,
  candidate: UploadCandidate,
  options: { maxBytes?: number } = {},
): ValidationResult {
  const standard = MEDIA_STANDARDS[type]
  const errors: MediaIssue[] = []
  const warnings: MediaIssue[] = []
  const format = detectFormat(candidate.mimeType, candidate.filename)

  if (candidate.bytes <= 0) errors.push(error('empty_file', 'The file is empty.'))

  const maxBytes = Math.min(standard.maxBytes, options.maxBytes ?? Number.POSITIVE_INFINITY)
  if (candidate.bytes > maxBytes) {
    errors.push(error('file_too_large', `${standard.label} files can be at most ${formatBytes(maxBytes)} — this one is ${formatBytes(candidate.bytes)}.`))
  }

  const allowed = standard.formats as readonly string[]
  if (!format || !allowed.includes(format.id)) {
    errors.push(error('format_not_allowed', `${standard.label} accepts ${formatLabels(standard.formats)}.`))
  }

  if (standard.category === 'image' && format && allowed.includes(format.id)) {
    if (format.id !== standard.preferredFormat) {
      warnings.push(
        warning('not_preferred_format', `${MEDIA_FORMATS[standard.preferredFormat].label} is preferred for ${standard.label.toLowerCase()}.`),
      )
    }
    if (!format.vector) {
      const { width, height } = candidate
      if (width && height) {
        for (const issue of validateImageDimensions(standard, width, height)) {
          ;(issue.severity === 'error' ? errors : warnings).push(issue)
        }
      } else if (standard.minimum) {
        errors.push(error('dimensions_unknown', 'The image could not be read to check its dimensions.'))
      }
    }
  }

  return { ok: errors.length === 0, format, errors, warnings }
}

/** `accept` attribute for an asset type's file input. */
export function acceptForAssetType(type: MediaAssetType): string {
  return acceptFor(MEDIA_STANDARDS[type].formats)
}

/** One-line specification shown under an upload control. */
export function describeStandard(type: MediaAssetType): string {
  const standard = MEDIA_STANDARDS[type]
  const parts: string[] = []
  if (standard.category === 'image') {
    if (standard.aspectRatio) parts.push(standard.aspectRatio.label)
    if (standard.recommended) parts.push(`${sizeLabel(standard.recommended)} recommended`)
    if (standard.minimum) parts.push(`min ${sizeLabel(standard.minimum)}`)
  }
  parts.push(formatLabels(standard.formats))
  parts.push(`max ${formatBytes(standard.maxBytes)}`)
  return parts.join(' · ')
}
