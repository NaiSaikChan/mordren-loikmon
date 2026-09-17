import { cms, uploadLargeAsset } from '@loikmon/api'
import type { Id, MediaAsset, MediaIssue } from '@loikmon/api'
import {
  detectFormat,
  DIRECT_UPLOAD_THRESHOLD,
  MEDIA_STANDARDS,
  validateMediaUpload,
  type MediaAssetType,
  type ValidationResult,
} from '@loikmon/media-standards'

/**
 * Upload helpers shared by every CMS upload control.
 *
 * Files are checked in the browser with the same rules the server applies
 * (@loikmon/media-standards), so an editor learns a cover is too small before
 * waiting for the upload. The server still re-validates from the decoded file.
 */

export interface PreparedFile {
  file: File
  assetType: MediaAssetType
  width: number | null
  height: number | null
  validation: ValidationResult
  /** Object URL for an instant local preview; revoke with `releasePreview`. */
  previewUrl: string | null
}

export interface UploadOutcome {
  key: string
  asset: MediaAsset | null
  warnings: MediaIssue[]
  reused: boolean
}

/** Pixel size of a raster image, or null when the browser cannot decode it (or it is a vector). */
export async function readImageSize(file: File): Promise<{ width: number; height: number } | null> {
  const format = detectFormat(file.type, file.name)
  if (!format || format.category !== 'image' || format.vector) return null
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      const size = { width: bitmap.width, height: bitmap.height }
      bitmap.close()
      return size
    } catch {
      // Fall through to <img>, which decodes some formats createImageBitmap refuses.
    }
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      resolve(null)
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}

export async function prepareFile(assetType: MediaAssetType, file: File): Promise<PreparedFile> {
  const standard = MEDIA_STANDARDS[assetType]
  const size = standard.category === 'image' ? await readImageSize(file) : null
  const format = detectFormat(file.type, file.name)
  const validation = validateMediaUpload(assetType, {
    mimeType: file.type,
    filename: file.name,
    bytes: file.size,
    width: size?.width,
    height: size?.height,
  })
  // A browser that cannot decode AVIF must not block the upload: the server decides.
  if (size === null && format?.category === 'image' && !format.vector) {
    validation.errors = validation.errors.filter((issue) => issue.code !== 'dimensions_unknown')
    validation.ok = validation.errors.length === 0
  }
  return {
    file,
    assetType,
    width: size?.width ?? null,
    height: size?.height ?? null,
    validation,
    previewUrl: standard.category === 'image' ? URL.createObjectURL(file) : null,
  }
}

export function releasePreview(prepared: PreparedFile | null) {
  if (prepared?.previewUrl) URL.revokeObjectURL(prepared.previewUrl)
}

/**
 * Images and small files go through the API (processed + registered); large
 * documents and audio are PUT straight to storage and registered afterwards.
 */
export async function uploadMedia(
  assetType: MediaAssetType,
  file: File,
  options: { folderId?: Id | null; altText?: string; onProgress?: (percent: number) => void } = {},
): Promise<UploadOutcome> {
  const standard = MEDIA_STANDARDS[assetType]
  if (standard.category !== 'image' && file.size > DIRECT_UPLOAD_THRESHOLD) {
    const result = await uploadLargeAsset(assetType, file, options.onProgress, { folderId: options.folderId })
    return { key: result.key, asset: result.asset, warnings: [], reused: false }
  }
  const { data } = await cms.media.upload(assetType, file, options)
  return { key: data.key, asset: data.asset, warnings: data.warnings, reused: data.reused }
}
