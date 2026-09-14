import type { NextFunction, Request, Response } from 'express'
import { resolveEntitlement } from '../services/subscriptionService.js'
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js'

/**
 * Gate protected content behind an active subscription. A subscribed user can
 * access ALL books and articles — there is no per-item purchase any more.
 * Attaches req.entitlement for downstream handlers.
 */
export async function requireSubscription(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) throw new UnauthorizedError()
  const entitlement = await resolveEntitlement(req.user.id)
  req.entitlement = entitlement
  if (!entitlement.active) {
    throw new ForbiddenError('An active subscription is required to access this content')
  }
  next()
}

/** Non-blocking: resolves entitlement for display logic without denying access. */
export async function attachEntitlement(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.user) {
    req.entitlement = await resolveEntitlement(req.user.id)
  }
  next()
}
