import { z } from 'zod'
import { errors } from '../lib/errors.js'

/** Parse untrusted input; throws a 400 VALIDATION_ERROR listing every problem. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw errors.validation(
      result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message, code: issue.code })),
    )
  }
  return result.data
}

export const idParam = z.object({ id: z.coerce.number().int().positive() })

/** Boolean query flags: ?free=true / ?free=1 */
export const queryBool = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true' || v === '1'))

export const pagination = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export interface PageInfo {
  page: number
  limit: number
  total: number
  total_pages: number
  has_more: boolean
}

export function pageInfo(page: number, limit: number, total: number): PageInfo {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  return { page, limit, total, total_pages: totalPages, has_more: page < totalPages }
}

/** Escape LIKE wildcards so user input is matched literally. */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`
}
