import type { User } from '@loikmon/api'

/**
 * Normalise a user from the backend (or from an older cached copy) into a
 * consistent `User` shape with a display name and avatar.
 */
export function normaliseUser(input: Partial<User> | Record<string, unknown>): User {
  const raw = input as Partial<User> & Record<string, unknown>
  const first = typeof raw.firstname === 'string' ? raw.firstname : ''
  const last = typeof raw.lastname === 'string' ? raw.lastname : ''
  const full = [first, last].filter(Boolean).join(' ').trim()
  const email = typeof raw.email === 'string' ? raw.email : ''
  const avatar = raw.avatar || raw.thumbnail || null
  return {
    id: String(raw.id ?? ''),
    email,
    name: (typeof raw.name === 'string' && raw.name.trim()) || full || (typeof raw.username === 'string' && raw.username) || email.split('@')[0] || 'User',
    firstname: first,
    lastname: last,
    phone: typeof raw.phone === 'string' ? raw.phone : null,
    role: typeof raw.role === 'string' ? raw.role : 'user',
    is_admin: Boolean(raw.is_admin),
    email_verified: Boolean(raw.email_verified),
    thumbnail: raw.thumbnail ?? avatar,
    avatar,
    created_at: typeof raw.created_at === 'string' ? raw.created_at : null,
  }
}
