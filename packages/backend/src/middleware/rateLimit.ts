import rateLimit from 'express-rate-limit'

/** Generous default limiter for read APIs. */
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many requests, slow down.' } },
})

/** Strict limiter for auth + payment verification (anti-abuse). */
export const sensitiveLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many attempts, try again later.' } },
})
