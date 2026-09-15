import { fromNodeHeaders } from 'better-auth/node'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { EntitlementDto } from '../../domain/entitlement.js'
import { errors } from '../../lib/errors.js'
import type { AppContext, AuthUser } from '../context.js'

export type SessionUser = {
  id: string
  email: string
  name: string
  emailVerified: boolean
  image?: string | null
  createdAt: Date
  role?: string | null
  firstname?: string | null
  lastname?: string | null
  phone?: string | null
}

export function toAuthUser(user: SessionUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role ?? 'user',
    emailVerified: user.emailVerified,
    image: user.image ?? null,
    firstname: user.firstname ?? null,
    lastname: user.lastname ?? null,
    phone: user.phone ?? null,
    createdAt: user.createdAt,
  }
}

/**
 * Resolve the session from `Authorization: Bearer <token>` (apps, SPA) or the
 * Better Auth session cookie. Never rejects: anonymous requests get user=null.
 */
export function attachAuth(ctx: AppContext): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    req.user = null
    req.sessionId = null
    if (!req.headers.authorization && !req.headers.cookie) return next()
    const result = await ctx.auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
    if (result) {
      req.user = toAuthUser(result.user as SessionUser)
      req.sessionId = result.session.id
    }
    next()
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) throw errors.unauthorized()
  next()
}

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) throw errors.unauthorized()
  if (req.user.role !== 'admin') throw errors.forbidden()
  next()
}

/** Entitlement for the signed-in user, computed at most once per request. */
export function getEntitlement(ctx: AppContext, req: Request): Promise<EntitlementDto | null> {
  if (!req.user) return Promise.resolve(null)
  req.entitlementPromise ??= ctx.services.subscriptions.getEntitlement(req.user.id, req.user.role)
  return req.entitlementPromise
}

export function requireUser(req: Request): AuthUser {
  if (!req.user) throw errors.unauthorized()
  return req.user
}
