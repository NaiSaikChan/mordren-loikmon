/**
 * File formats the platform accepts, and the hard upload limits per media
 * category. Everything that checks a MIME type, an extension or a byte size
 * reads it from here.
 */

export type MediaCategory = 'image' | 'document' | 'audio'

export type ImageFormatId = 'jpg' | 'png' | 'webp' | 'avif' | 'svg'
export type DocumentFormatId = 'pdf' | 'epub'
export type AudioFormatId = 'mp3' | 'm4a' | 'aac' | 'wav'
export type MediaFormatId = ImageFormatId | DocumentFormatId | AudioFormatId

export interface MediaFormat {
  id: MediaFormatId
  label: string
  category: MediaCategory
  /** The first entry is canonical: it is what processed files are stored as. */
  mimeTypes: readonly string[]
  /** The first entry is canonical. */
  extensions: readonly string[]
  /** Vector images are stored as uploaded and rasterised for variants. */
  vector?: boolean
}

export const MEDIA_FORMATS: Readonly<Record<MediaFormatId, MediaFormat>> = {
  jpg: { id: 'jpg', label: 'JPG', category: 'image', mimeTypes: ['image/jpeg', 'image/pjpeg'], extensions: ['.jpg', '.jpeg'] },
  png: { id: 'png', label: 'PNG', category: 'image', mimeTypes: ['image/png'], extensions: ['.png'] },
  webp: { id: 'webp', label: 'WebP', category: 'image', mimeTypes: ['image/webp'], extensions: ['.webp'] },
  avif: { id: 'avif', label: 'AVIF', category: 'image', mimeTypes: ['image/avif'], extensions: ['.avif'] },
  svg: { id: 'svg', label: 'SVG', category: 'image', mimeTypes: ['image/svg+xml'], extensions: ['.svg'], vector: true },
  pdf: { id: 'pdf', label: 'PDF', category: 'document', mimeTypes: ['application/pdf'], extensions: ['.pdf'] },
  epub: { id: 'epub', label: 'EPUB', category: 'document', mimeTypes: ['application/epub+zip'], extensions: ['.epub'] },
  mp3: { id: 'mp3', label: 'MP3', category: 'audio', mimeTypes: ['audio/mpeg', 'audio/mp3'], extensions: ['.mp3'] },
  m4a: { id: 'm4a', label: 'M4A', category: 'audio', mimeTypes: ['audio/mp4', 'audio/x-m4a', 'audio/m4a'], extensions: ['.m4a'] },
  aac: { id: 'aac', label: 'AAC', category: 'audio', mimeTypes: ['audio/aac', 'audio/x-aac'], extensions: ['.aac'] },
  wav: { id: 'wav', label: 'WAV', category: 'audio', mimeTypes: ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'], extensions: ['.wav'] },
}

/** Raster formats accepted for every image asset (SVG is opt-in per standard). */
export const RASTER_IMAGE_FORMATS: readonly ImageFormatId[] = ['jpg', 'png', 'webp', 'avif']
export const DOCUMENT_FORMATS: readonly DocumentFormatId[] = ['pdf', 'epub']
export const AUDIO_FORMATS: readonly AudioFormatId[] = ['mp3', 'm4a', 'aac', 'wav']

/** WebP is the preferred upload and delivery format for raster images. */
export const PREFERRED_IMAGE_FORMAT: ImageFormatId = 'webp'

export const MEBIBYTE = 1024 * 1024

/** Maximum bytes per upload, by category. The server's UPLOAD_MAX_MB can only lower these. */
export const UPLOAD_LIMITS: Readonly<Record<MediaCategory, number>> = {
  image: 10 * MEBIBYTE,
  document: 250 * MEBIBYTE,
  audio: 1024 * MEBIBYTE,
}

/**
 * Files at or below this size go through the API; larger ones are PUT straight
 * to object storage with a presigned URL. Images always go through the API
 * because they must be validated and processed server-side.
 */
export const DIRECT_UPLOAD_THRESHOLD = 25 * MEBIBYTE

/** How many files one bulk upload may contain. */
export const BULK_UPLOAD_MAX_FILES = 50

export function formatById(id: MediaFormatId): MediaFormat {
  return MEDIA_FORMATS[id]
}

/** Resolve a MIME type (case-insensitive, parameters ignored) to a format. */
export function formatForMime(mime: string | null | undefined): MediaFormat | null {
  if (!mime) return null
  const normalised = mime.split(';', 1)[0]!.trim().toLowerCase()
  for (const format of Object.values(MEDIA_FORMATS)) {
    if (format.mimeTypes.includes(normalised)) return format
  }
  return null
}

/** Resolve a filename's extension to a format. */
export function formatForFilename(filename: string | null | undefined): MediaFormat | null {
  if (!filename) return null
  const match = /\.[a-z0-9]+$/i.exec(filename)
  if (!match) return null
  const ext = match[0].toLowerCase()
  for (const format of Object.values(MEDIA_FORMATS)) {
    if (format.extensions.includes(ext)) return format
  }
  return null
}

/**
 * Best-effort format detection. Browsers report an empty or generic type for
 * some files (EPUB, M4A on Windows), so the extension is the fallback.
 */
export function detectFormat(mime: string | null | undefined, filename?: string | null): MediaFormat | null {
  return formatForMime(mime) ?? formatForFilename(filename)
}

/** `accept` attribute for a file input: MIME types plus extensions. */
export function acceptFor(formats: readonly MediaFormatId[]): string {
  const parts = new Set<string>()
  for (const id of formats) {
    const format = MEDIA_FORMATS[id]
    format.mimeTypes.forEach((m) => parts.add(m))
    format.extensions.forEach((e) => parts.add(e))
  }
  return [...parts].join(',')
}

export function formatLabels(formats: readonly MediaFormatId[]): string {
  return formats.map((id) => MEDIA_FORMATS[id].label).join(', ')
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < MEBIBYTE) return `${Math.round(bytes / 1024)} KB`
  const mb = bytes / MEBIBYTE
  return `${mb >= 100 || Number.isInteger(mb) ? Math.round(mb) : mb.toFixed(1)} MB`
}
