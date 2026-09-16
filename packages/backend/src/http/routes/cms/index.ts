import { Router } from 'express'
import { PERMISSION_GROUPS } from '../../../domain/permissions.js'
import type { AppContext } from '../../context.js'
import { loadCmsActor, requireActor, requireCmsAccess } from '../../middleware/permissions.js'
import { requireAuth } from '../../middleware/auth.js'
import { communityRouter } from './community.js'
import { contentRouter } from './content.js'
import { couponsRouter } from './coupons.js'
import { platformRouter } from './platform.js'
import { taxonomyRouter } from './taxonomy.js'
import { usersRouter } from './users.js'

/**
 * `/api/v1/cms` — everything the admin application talks to.
 *
 * The chain is: authenticated → actor resolved (roles, permissions, owned
 * author profiles) → the module routers, each guarded by `requirePermission`.
 * `GET /cms/me` sits before the access gate so the storefront can ask "may this
 * user open the CMS?" without receiving a 403.
 */
export function cmsRouter(ctx: AppContext) {
  const router = Router()

  router.use(requireAuth, loadCmsActor(ctx))

  /** Session bootstrap for the CMS shell and the storefront's "Admin" link. */
  router.get('/me', async (req, res) => {
    const actor = requireActor(req)
    const [roles, authorProfiles] = await Promise.all([
      ctx.services.rbac.getUserRoles(actor.userId),
      ctx.db.selectFrom('authors').select(['id', 'name']).where('user_id', '=', actor.userId).execute(),
    ])
    res.json({
      status: 'ok',
      can_access: actor.permissions.size > 0,
      user: { id: actor.userId, email: actor.email, primary_role: actor.primaryRole },
      roles,
      scope: actor.scope,
      permissions: [...actor.permissions].sort(),
      author_profiles: authorProfiles,
      permission_groups: PERMISSION_GROUPS,
    })
  })

  router.use(requireCmsAccess)

  router.use(usersRouter(ctx))
  router.use(contentRouter(ctx))
  router.use(taxonomyRouter(ctx))
  router.use('/coupons', couponsRouter(ctx))
  router.use(communityRouter(ctx))
  router.use(platformRouter(ctx))

  return router
}
