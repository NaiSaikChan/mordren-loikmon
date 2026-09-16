import type { Request, RequestHandler } from 'express'
import type { Permission } from '../../domain/permissions.js'
import { errors } from '../../lib/errors.js'
import type { AuditActorInfo } from '../../services/audit.js'
import { actorCan, actorCanAny, type CmsActor } from '../../services/rbac.js'
import type { AppContext } from '../context.js'

/**
 * Authorisation for `/api/v1/cms`.
 *
 * `loadCmsActor` runs once per request and resolves the caller's effective
 * permissions, scope and owned author profiles; `requirePermission` and
 * `requireAnyPermission` then guard individual routes. Row-level ownership is
 * *not* decided here — services receive the actor and add the `where` clause,
 * so a permission can never be satisfied by a route the service does not scope.
 */

export function loadCmsActor(ctx: AppContext): RequestHandler {
  return async (req, _res, next) => {
    if (!req.user) throw errors.unauthorized()
    req.cmsActor = await ctx.services.rbac.resolveActor({ id: req.user.id, email: req.user.email, role: req.user.role })
    next()
  }
}

/** The actor resolved by `loadCmsActor`. Throws if the middleware did not run. */
export function requireActor(req: Request): CmsActor {
  if (!req.cmsActor) throw errors.unauthorized()
  return req.cmsActor
}

/** Every listed permission is required. */
export function requirePermission(...required: Permission[]): RequestHandler {
  return (req, _res, next) => {
    const actor = requireActor(req)
    if (!actorCan(actor, ...required)) throw errors.permissionDenied(required)
    next()
  }
}

/** At least one of the listed permissions is required. */
export function requireAnyPermission(...required: Permission[]): RequestHandler {
  return (req, _res, next) => {
    const actor = requireActor(req)
    if (!actorCanAny(actor, ...required)) throw errors.permissionDenied(required)
    next()
  }
}

/** Gate for the CMS shell: any permission at all means "may open the CMS". */
export const requireCmsAccess: RequestHandler = (req, _res, next) => {
  const actor = requireActor(req)
  if (actor.permissions.size === 0) throw errors.forbidden('Your account does not have access to the CMS')
  next()
}

/**
 * Throws unless the actor may act on content owned by `authorId`.
 * Actors with an `all` scope pass; `own`-scoped actors must own the profile.
 */
export function assertOwnsAuthor(actor: CmsActor, authorId: number | null | undefined, resource = 'content'): void {
  if (actor.scope === 'all') return
  if (authorId === null || authorId === undefined || !actor.ownedAuthorIds.includes(authorId)) {
    throw errors.ownershipRequired(resource)
  }
}

/** `undefined` means "no restriction"; an array (possibly empty) means "only these". */
export function ownedAuthorFilter(actor: CmsActor): number[] | undefined {
  return actor.scope === 'all' ? undefined : actor.ownedAuthorIds
}

/** Actor metadata attached to every audit entry written for this request. */
export function auditActor(req: Request): AuditActorInfo {
  const actor = req.cmsActor
  return {
    id: req.user?.id ?? null,
    email: req.user?.email ?? null,
    role: actor?.primaryRole ?? req.user?.role ?? null,
    ip: req.ip ?? null,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    requestId: typeof req.id === 'string' ? req.id : null,
  }
}
