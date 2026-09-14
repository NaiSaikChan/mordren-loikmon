import { Client as MinioClient } from 'minio'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'
import { NotFoundError } from '../utils/errors.js'

export const minio = new MinioClient({
  endPoint: config.minio.endpoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
  region: config.minio.region,
})

const ALL_BUCKETS = [
  config.minio.buckets.books,
  config.minio.buckets.images,
  config.minio.buckets.audio,
]

/** Public-read policy for image/thumbnail buckets. */
function publicReadPolicy(bucket: string): string {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  })
}

/** Ensure all buckets exist; make the images bucket public-read. */
export async function ensureBuckets(): Promise<void> {
  for (const bucket of ALL_BUCKETS) {
    const exists = await minio.bucketExists(bucket).catch(() => false)
    if (!exists) {
      await minio.makeBucket(bucket, config.minio.region)
      logger.info({ bucket }, 'created MinIO bucket')
    }
  }
  // Images are public (covers/thumbnails); books & audio stay private.
  try {
    await minio.setBucketPolicy(config.minio.buckets.images, publicReadPolicy(config.minio.buckets.images))
  } catch (err) {
    logger.warn({ err }, 'could not set public policy on images bucket')
  }
}

export interface UploadInput {
  bucket: string
  objectKey: string
  data: Buffer | NodeJS.ReadableStream
  size?: number
  contentType?: string
}

export async function uploadObject(input: UploadInput): Promise<void> {
  const meta = input.contentType ? { 'Content-Type': input.contentType } : undefined
  await minio.putObject(input.bucket, input.objectKey, input.data as any, input.size, meta)
}

/** Presigned GET URL for protected content — the ONLY way entitled users read books/audio. */
export async function getSignedUrl(
  bucket: string,
  objectKey: string,
  ttlSeconds = config.minio.signedUrlTtlSeconds,
): Promise<string> {
  try {
    await minio.statObject(bucket, objectKey)
  } catch {
    throw new NotFoundError(`Object not found: ${bucket}/${objectKey}`)
  }
  return minio.presignedGetObject(bucket, objectKey, ttlSeconds)
}

/** Public URL for image assets (uses configured CDN/base url if provided). */
export function getPublicUrl(bucket: string, objectKey: string): string {
  if (config.minio.publicBaseUrl) {
    return `${config.minio.publicBaseUrl.replace(/\/$/, '')}/${bucket}/${objectKey}`
  }
  const scheme = config.minio.useSSL ? 'https' : 'http'
  return `${scheme}://${config.minio.endpoint}:${config.minio.port}/${bucket}/${objectKey}`
}

export async function pingStorage(): Promise<boolean> {
  try {
    await minio.bucketExists(config.minio.buckets.images)
    return true
  } catch (err) {
    logger.error({ err }, 'MinIO ping failed')
    return false
  }
}
