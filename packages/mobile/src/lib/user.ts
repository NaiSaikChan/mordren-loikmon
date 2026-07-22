import type { User } from '@loikmon/api'

/**
 * Normalise the raw server user object into a consistent `User` shape.
 * Mirrors the web app's auth store so both clients derive the same display
 * name / avatar / coin values from the (inconsistent) server payload.
 */
export function normaliseUser(raw: Record<string, unknown>): User {
  const first = (raw.firstname as string) ?? ''
  const last = (raw.lastname as string) ?? ''
  const full = [first, last].filter(Boolean).join(' ').trim()
  return {
    ...raw,
    name:
      full ||
      (raw.username as string) ||
      ((raw.email as string)?.split('@')[0] ?? 'User'),
    avatar: (raw.thumbnail as string) || (raw.avatar as string) || '',
    coins: raw.coins ? Number(raw.coins) : 0,
  } as User
}

/** Server issues no JWT — derive a stable local session key from the user id. */
export function makeSessionKey(user: Record<string, unknown>): string {
  return `user_${user.id}`
}
