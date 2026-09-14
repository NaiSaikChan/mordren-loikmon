import type { NextFunction, Request, Response } from 'express'
import { verifyToken } from '../auth/jwt.js'
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js'

/** Require a valid Bearer JWT; attaches req.user. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing Bearer token')
  }
  try {
    req.user = verifyToken(header.slice(7))
    next()
  } catch {
    throw new UnauthorizedError('Invalid or expired token')
  }
}

/** Optional auth: attaches req.user if a valid token is present, else continues. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(header.slice(7))
    } catch {
      /* ignore invalid token in optional mode */
    }
  }
  next()
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) throw new UnauthorizedError()
  if (!req.user.is_admin) throw new ForbiddenError('Admin access required')
  next()
}
