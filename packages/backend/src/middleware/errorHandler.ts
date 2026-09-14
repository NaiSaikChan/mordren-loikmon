import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../utils/errors.js'
import { logger } from '../utils/logger.js'

/** Wrap async route handlers so thrown errors reach the error middleware. */
export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(
  fn: T,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: 'validation_error', message: 'Invalid request', details: err.flatten() },
    })
    return
  }
  if (err instanceof AppError) {
    if (err.statusCode >= 500) logger.error({ err }, 'application error')
    else logger.warn({ code: err.code, msg: err.message }, 'handled error')
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details ?? undefined },
    })
    return
  }
  logger.error({ err }, 'unhandled error')
  res.status(500).json({ error: { code: 'internal_error', message: 'Internal server error' } })
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } })
}
