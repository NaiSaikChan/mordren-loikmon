import { Router } from 'express'
import { asyncHandler } from '../middleware/errorHandler.js'
import { pingDatabase } from '../database/pool.js'
import { pingStorage } from '../services/storageService.js'

const router = Router()

router.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'loikmon-backend' })
})

// Deep readiness check (DB + MinIO). Used by Docker healthcheck / load balancer.
router.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    const [db, storage] = await Promise.all([pingDatabase(), pingStorage()])
    const ok = db && storage
    res.status(ok ? 200 : 503).json({ status: ok ? 'ready' : 'degraded', db, storage })
  }),
)

export default router
