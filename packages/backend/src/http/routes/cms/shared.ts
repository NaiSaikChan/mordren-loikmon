import type { Request } from 'express'
import { z } from 'zod'
import type { CmsRequestContext } from '../../../services/cms/content.js'
import { auditActor, requireActor } from '../../middleware/permissions.js'

/** The actor plus the audit metadata every CMS service call needs. */
export function cmsContext(req: Request): CmsRequestContext {
  return { actor: requireActor(req), audit: auditActor(req) }
}

export const optionalText = z.string().trim().max(65_535).nullable().optional()
export const storageKey = z.string().trim().max(1024).nullable().optional()
export const foreignKey = z.number().int().positive().nullable().optional()
export const isoDate = z.string().datetime({ offset: true })

export const workflowStatus = z.enum(['draft', 'in_review', 'scheduled', 'published', 'archived'])
export const itemType = z.enum(['book', 'article'])

export const idsBody = z.object({ ids: z.array(z.number().int().positive()).min(1).max(200) })

/** `?from=…&to=…` or `?days=30` for every analytics endpoint. */
export const rangeQuery = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  days: z.coerce.number().int().min(1).max(365).default(30),
})

/** Sort direction shared by the list endpoints. */
export const contentSort = z.enum(['latest', 'updated', 'title', 'popular']).optional()
