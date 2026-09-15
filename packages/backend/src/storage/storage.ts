import { randomUUID } from 'node:crypto'
import { extname } from 'node:path'
import type { Readable } from 'node:stream'
import { Client } from 'minio'
import type { AppConfig } from '../config/env.js'
import type { Logger } from '../lib/logger.js'

/**
 * Object storage on MinIO.
 *
 * Two buckets:
 *  - public  — covers, thumbnails, avatars, slider images. Anonymous read.
 *  - private — PDFs, EPUBs, audio. Only reachable through short-lived
 *              presigned URLs issued to entitled users.
 *
 * Database rows store object *keys*. A value that is already an absolute
 * http(s) URL is passed through unchanged, which lets imported legacy content
 * keep working before its files are copied into MinIO.
 */

export type AssetKind = 'cover' | 'thumbnail' | 'avatar' | 'slider' | 'category' | 'pdf' | 'epub' | 'audio'
export type Visibility = 'public' | 'private'

export const ASSET_VISIBILITY: Record<AssetKind, Visibility> = {
  cover: 'public',
  thumbnail: 'public',
  avatar: 'public',
  slider: 'public',
  category: 'public',
  pdf: 'private',
  epub: 'private',
  audio: 'private',
}

export const ASSET_CONTENT_TYPES: Record<AssetKind, readonly string[]> = {
  cover: ['image/jpeg', 'image/png', 'image/webp'],
  thumbnail: ['image/jpeg', 'image/png', 'image/webp'],
  avatar: ['image/jpeg', 'image/png', 'image/webp'],
  slider: ['image/jpeg', 'image/png', 'image/webp'],
  category: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
  pdf: ['application/pdf'],
  epub: ['application/epub+zip'],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/x-m4a', 'audio/ogg'],
}

export interface PresignedUpload {
  key: string
  url: string
  method: 'PUT'
  headers: Record<string, string>
  expires_at: string
}

export interface StorageService {
  isAbsoluteUrl(value: string): boolean
  /** Public, cacheable URL for a public-bucket key (or passthrough URL). */
  publicUrl(key: string | null | undefined): string | null
  /** Time-limited URL for a private-bucket key (or passthrough URL). */
  signedUrl(key: string, options?: { ttlSeconds?: number; downloadName?: string }): Promise<{ url: string; expiresAt: Date }>
  presignUpload(kind: AssetKind, contentType: string, filename?: string): Promise<PresignedUpload>
  putObject(kind: AssetKind, body: Buffer | Readable, size: number, contentType: string, filename?: string): Promise<string>
  removeObject(key: string): Promise<void>
  ensureBuckets(): Promise<void>
  ping(): Promise<void>
}

export function buildObjectKey(kind: AssetKind, filename?: string): string {
  const ext = filename ? extname(filename).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 10) : ''
  const date = new Date().toISOString().slice(0, 7) // YYYY-MM
  return `${kind}/${date}/${randomUUID()}${ext}`
}

/** `public/` and `private/` prefixes are not used: the kind at the start of the key decides the bucket. */
export function visibilityOfKey(key: string): Visibility {
  const kind = key.split('/', 1)[0] as AssetKind
  return ASSET_VISIBILITY[kind] ?? 'private'
}

function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/')
}

export class MinioStorageService implements StorageService {
  /** Talks to MinIO over the internal Docker network. */
  private readonly internal: Client
  /** Signs URLs for the public hostname (signing is offline; it never connects). */
  private readonly signer: Client

  constructor(
    private readonly config: AppConfig['storage'],
    private readonly logger: Logger,
  ) {
    this.internal = new Client({
      endPoint: config.endpoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      region: config.region,
    })
    const pub = new URL(config.publicUrl)
    this.signer = new Client({
      endPoint: pub.hostname,
      port: pub.port ? Number(pub.port) : pub.protocol === 'https:' ? 443 : 80,
      useSSL: pub.protocol === 'https:',
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      region: config.region,
      pathStyle: true,
    })
  }

  isAbsoluteUrl(value: string): boolean {
    return /^https?:\/\//i.test(value)
  }

  private bucketFor(key: string): string {
    return visibilityOfKey(key) === 'public' ? this.config.publicBucket : this.config.privateBucket
  }

  publicUrl(key: string | null | undefined): string | null {
    if (!key) return null
    if (this.isAbsoluteUrl(key)) return key
    return `${this.config.publicUrl}/${this.config.publicBucket}/${encodeKey(key)}`
  }

  async signedUrl(key: string, options: { ttlSeconds?: number; downloadName?: string } = {}) {
    const ttl = options.ttlSeconds ?? this.config.signedUrlTtlSeconds
    const expiresAt = new Date(Date.now() + ttl * 1000)
    if (this.isAbsoluteUrl(key)) return { url: key, expiresAt }
    const params: Record<string, string> = {}
    if (options.downloadName) {
      params['response-content-disposition'] = `inline; filename*=UTF-8''${encodeURIComponent(options.downloadName)}`
    }
    const url = await this.signer.presignedGetObject(this.bucketFor(key), key, ttl, params)
    return { url, expiresAt }
  }

  async presignUpload(kind: AssetKind, contentType: string, filename?: string): Promise<PresignedUpload> {
    const key = buildObjectKey(kind, filename)
    const ttl = 15 * 60
    const url = await this.signer.presignedPutObject(this.bucketFor(key), key, ttl)
    return {
      key,
      url,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
    }
  }

  async putObject(kind: AssetKind, body: Buffer | Readable, size: number, contentType: string, filename?: string) {
    const key = buildObjectKey(kind, filename)
    await this.internal.putObject(this.bucketFor(key), key, body, size, { 'Content-Type': contentType })
    return key
  }

  async removeObject(key: string): Promise<void> {
    if (this.isAbsoluteUrl(key)) return
    await this.internal.removeObject(this.bucketFor(key), key)
  }

  async ensureBuckets(): Promise<void> {
    for (const bucket of [this.config.publicBucket, this.config.privateBucket]) {
      const exists = await this.internal.bucketExists(bucket)
      if (!exists) {
        await this.internal.makeBucket(bucket, this.config.region)
        this.logger.info({ bucket }, 'created storage bucket')
      }
    }
    // Anonymous read (GetObject only — no listing) on the public bucket.
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${this.config.publicBucket}/*`],
        },
      ],
    }
    await this.internal.setBucketPolicy(this.config.publicBucket, JSON.stringify(policy))
  }

  async ping(): Promise<void> {
    await this.internal.bucketExists(this.config.privateBucket)
  }
}
