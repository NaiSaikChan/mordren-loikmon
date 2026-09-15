import type { Request } from 'express'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'
import { AppError, ErrorCode } from '../../lib/errors.js'

const byUserOrIp = (req: Request) => req.user?.id ?? ipKeyGenerator(req.ip ?? '0.0.0.0')

export function createRateLimiters(options: { enabled: boolean }) {
  const common = {
    standardHeaders: 'draft-8' as const,
    legacyHeaders: false,
    skip: () => !options.enabled,
    handler: () => {
      throw new AppError(429, ErrorCode.RATE_LIMITED, 'Too many requests, please slow down')
    },
  }
  return {
    /** General API traffic. */
    api: rateLimit({ ...common, windowMs: 60_000, limit: 300, keyGenerator: byUserOrIp }),
    /** Login, registration, password reset. */
    auth: rateLimit({ ...common, windowMs: 15 * 60_000, limit: 30 }),
    /** Purchase verification calls store APIs — keep them bounded per user. */
    purchases: rateLimit({ ...common, windowMs: 15 * 60_000, limit: 60, keyGenerator: byUserOrIp }),
  }
}
