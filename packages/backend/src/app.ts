import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import pinoHttp from 'pino-http'
import { config } from './config.js'
import { logger } from './utils/logger.js'
import { apiLimiter } from './middleware/rateLimit.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'

import healthRouter from './routes/health.js'
import authRouter from './routes/auth.js'
import subscriptionsRouter from './routes/subscriptions.js'
import contentRouter from './routes/content.js'
import webhooksRouter from './routes/webhooks.js'

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)
  app.use(helmet())
  app.use(cors({ origin: config.corsOrigins, credentials: true }))
  app.use(pinoHttp({ logger }))

  // ── Webhooks need the RAW body for signature verification. Mount BEFORE json.
  app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }))
  app.use('/api/webhooks', express.json({ limit: '1mb' }), webhooksRouter)

  // ── Normal JSON parsing for the rest.
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true, limit: '10mb' }))

  // ── Health (no rate limit).
  app.use('/health', healthRouter)

  // ── API (rate limited).
  app.use('/api', apiLimiter)
  app.use('/api/auth', authRouter)
  app.use('/api/subscriptions', subscriptionsRouter)
  app.use('/api/content', contentRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
