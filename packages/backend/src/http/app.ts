import { randomUUID } from 'node:crypto'
import { toNodeHandler } from 'better-auth/node'
import cors from 'cors'
import express, { type Express } from 'express'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
import type { AppContext } from './context.js'
import { attachAuth } from './middleware/auth.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { createRateLimiters } from './middleware/rateLimit.js'
import { adminRouter } from './routes/admin.js'
import { authRouter } from './routes/auth.js'
import { catalogRouter } from './routes/catalog.js'
import { healthRouter } from './routes/health.js'
import { subscriptionsRouter } from './routes/subscriptions.js'
import { webhooksRouter } from './routes/webhooks.js'

const REQUEST_ID_RE = /^[A-Za-z0-9._-]{8,128}$/

export function createApp(ctx: AppContext): Express {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', ctx.config.trustProxy)

  // Request id + structured access log. The id is echoed in X-Request-Id and
  // in every error body so a user report can be matched to a log line.
  app.use(
    pinoHttp({
      logger: ctx.logger,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id']
        const id = typeof incoming === 'string' && REQUEST_ID_RE.test(incoming) ? incoming : randomUUID()
        res.setHeader('X-Request-Id', id)
        return id
      },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      autoLogging: { ignore: (req) => Boolean(req.url?.startsWith('/health')) },
      serializers: {
        req: (req: { id: string; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  )

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(
    cors({
      // Native apps send no Origin; browsers must come from an allowed origin.
      origin: (origin, callback) => callback(null, !origin || ctx.config.corsOrigins.includes(origin)),
      credentials: true,
      exposedHeaders: ['set-auth-token', 'X-Request-Id', 'RateLimit', 'RateLimit-Policy'],
      maxAge: 600,
    }),
  )

  const limiters = createRateLimiters({ enabled: !ctx.config.isTest })

  // Better Auth's own endpoints are only needed for links opened from emails
  // (GET /api/auth/verify-email). Clients use the validated /api/v1/auth
  // routes, so the native POST endpoints are not exposed. Must be mounted
  // before the JSON body parser.
  app.get('/api/auth/*splat', limiters.auth, toNodeHandler(ctx.auth))

  app.use('/health', healthRouter(ctx))
  app.use(express.json({ limit: '1mb' }))

  // Store notifications authenticate with signatures, not user sessions.
  app.use('/api/v1/webhooks', webhooksRouter(ctx))

  app.use('/api/v1', attachAuth(ctx), limiters.api)
  app.use('/api/v1/auth', authRouter(ctx, limiters))
  app.use('/api/v1/subscriptions', subscriptionsRouter(ctx, limiters))
  app.use('/api/v1/admin', adminRouter(ctx))
  app.use('/api/v1', catalogRouter(ctx))

  app.use(notFoundHandler)
  app.use(errorHandler(ctx.logger, { exposeInternalErrors: !ctx.config.isProduction }))
  return app
}
