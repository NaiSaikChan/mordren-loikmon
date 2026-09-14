import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../middleware/errorHandler.js'
import { requireAuth } from '../middleware/auth.js'
import { requireSubscription } from '../middleware/entitlement.js'
import { queryOne } from '../database/pool.js'
import { getSignedUrl, getPublicUrl } from '../services/storageService.js'
import { NotFoundError } from '../utils/errors.js'
import { config } from '../config.js'

const router = Router()

interface AssetRow {
  bucket: string
  object_key: string
  is_public: number
  mime_type: string | null
}

const paramsSchema = z.object({
  contentType: z.enum(['book', 'article', 'audio']),
  contentId: z.string().min(1).max(64),
})

/**
 * GET /api/content/:contentType/:contentId/url
 * Returns a time-limited signed URL for the protected asset.
 * Requires an ACTIVE subscription — subscribers can open ANY book/article.
 */
router.get(
  '/:contentType/:contentId/url',
  requireAuth,
  requireSubscription,
  asyncHandler(async (req, res) => {
    const { contentType, contentId } = paramsSchema.parse(req.params)
    const kind = contentType === 'audio' ? 'audio' : 'file'
    const asset = await queryOne<AssetRow>(
      `SELECT bucket, object_key, is_public, mime_type
         FROM content_assets
        WHERE content_type = ? AND content_id = ? AND asset_kind = ?
        LIMIT 1`,
      [contentType, contentId, kind],
    )
    if (!asset) throw new NotFoundError('Content asset not registered')

    const url = asset.is_public
      ? getPublicUrl(asset.bucket, asset.object_key)
      : await getSignedUrl(asset.bucket, asset.object_key)

    res.json({
      url,
      expiresInSeconds: asset.is_public ? null : config.minio.signedUrlTtlSeconds,
      mimeType: asset.mime_type,
    })
  }),
)

/**
 * GET /api/content/:contentType/:contentId/cover
 * Public cover/thumbnail image URL (no subscription required).
 */
router.get(
  '/:contentType/:contentId/cover',
  asyncHandler(async (req, res) => {
    const { contentType, contentId } = paramsSchema.parse(req.params)
    const asset = await queryOne<AssetRow>(
      `SELECT bucket, object_key, is_public, mime_type
         FROM content_assets
        WHERE content_type = ? AND content_id = ? AND asset_kind IN ('cover','thumbnail')
        ORDER BY asset_kind LIMIT 1`,
      [contentType, contentId],
    )
    if (!asset) throw new NotFoundError('Cover not found')
    res.json({ url: getPublicUrl(asset.bucket, asset.object_key), mimeType: asset.mime_type })
  }),
)

export default router
