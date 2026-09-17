import type { MediaCategory } from './formats.js'

/**
 * Storage kinds: the first path segment of every object key. The kind decides
 * the bucket (public or private) and groups objects on disk. It is *not* the
 * asset's purpose — several asset types share a kind (all avatars live under
 * `avatar/`), see `MEDIA_STANDARDS[type].storageKind`.
 */

export type StorageKind =
  | 'cover'
  | 'thumbnail'
  | 'avatar'
  | 'slider'
  | 'category'
  | 'banner'
  | 'brand'
  | 'og'
  | 'pdf'
  | 'epub'
  | 'audio'

export type Visibility = 'public' | 'private'

export interface StorageKindSpec {
  kind: StorageKind
  category: MediaCategory
  /** public: anonymous read, CDN-cacheable. private: presigned URLs for entitled users only. */
  visibility: Visibility
}

export const STORAGE_KINDS: Readonly<Record<StorageKind, StorageKindSpec>> = {
  cover: { kind: 'cover', category: 'image', visibility: 'public' },
  thumbnail: { kind: 'thumbnail', category: 'image', visibility: 'public' },
  avatar: { kind: 'avatar', category: 'image', visibility: 'public' },
  slider: { kind: 'slider', category: 'image', visibility: 'public' },
  category: { kind: 'category', category: 'image', visibility: 'public' },
  banner: { kind: 'banner', category: 'image', visibility: 'public' },
  brand: { kind: 'brand', category: 'image', visibility: 'public' },
  og: { kind: 'og', category: 'image', visibility: 'public' },
  pdf: { kind: 'pdf', category: 'document', visibility: 'private' },
  epub: { kind: 'epub', category: 'document', visibility: 'private' },
  audio: { kind: 'audio', category: 'audio', visibility: 'private' },
}

export const STORAGE_KIND_LIST = Object.keys(STORAGE_KINDS) as StorageKind[]

export function isStorageKind(value: string): value is StorageKind {
  return Object.prototype.hasOwnProperty.call(STORAGE_KINDS, value)
}

/** The kind at the start of the key decides the bucket; unknown prefixes are treated as private. */
export function visibilityOfKey(key: string): Visibility {
  const kind = key.split('/', 1)[0] ?? ''
  return isStorageKind(kind) ? STORAGE_KINDS[kind].visibility : 'private'
}

export function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}
