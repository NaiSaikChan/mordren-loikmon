import type { Request, Response, NextFunction } from 'express'

export function errorHandler(
  err: Error & { status?: number; code?: string },
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error('[BFF Error]', err.message)
  res.status(err.status ?? 500).json({
    error: err.message ?? 'Internal Server Error',
    code: err.code,
  })
}
