/**
 * Permission catalogue.
 *
 * Permissions are defined in code so they can be type-checked and refactored;
 * the *role to permission* mapping lives in the `role_permissions` table so an
 * administrator can build custom roles at runtime (`roles.manage`).
 *
 * A permission answers "may this actor perform this action at all?". *Which
 * rows* the action may touch is a separate question answered by the role's
 * scope (see `RoleScope`): `all` means the whole catalogue, `own` restricts
 * every query to content owned by the actor's author profiles.
 */

export const PERMISSIONS = [
  // Users
  'users.view',
  'users.create',
  'users.edit',
  'users.delete',

  // Roles & permissions (system configuration — admin only by default)
  'roles.manage',

  // Authors
  'authors.view',
  'authors.create',
  'authors.edit',
  'authors.delete',
  'authors.verify',

  // Books
  'books.view',
  'books.create',
  'books.edit',
  'books.publish',
  'books.delete',

  // Audiobooks (chapters attached to a book)
  'audiobooks.view',
  'audiobooks.create',
  'audiobooks.edit',
  'audiobooks.delete',

  // Articles
  'articles.view',
  'articles.create',
  'articles.edit',
  'articles.publish',
  'articles.delete',

  // Taxonomy
  'categories.view',
  'categories.create',
  'categories.edit',
  'categories.delete',

  'collections.view',
  'collections.create',
  'collections.edit',
  'collections.delete',

  // Membership
  'plans.view',
  'plans.manage',
  'subscriptions.view',
  'subscriptions.manage',

  // Coupons — platform wide
  'coupons.view',
  'coupons.create',
  'coupons.edit',
  'coupons.delete',
  'coupons.analytics',
  /** Global and subscription campaigns; authors never receive this. */
  'coupons.global.manage',

  // Coupons — an author's own books and articles
  'author.coupons.create',
  'author.coupons.edit',
  'author.coupons.delete',
  'author.coupons.analytics',

  // Community
  'reviews.view',
  'reviews.moderate',
  'reviews.delete',
  'feedback.view',
  'feedback.respond',
  'feedback.assign',
  'feedback.delete',

  // Editorial
  'policies.view',
  'policies.edit',
  'policies.publish',
  'sliders.view',
  'sliders.create',
  'sliders.edit',
  'sliders.delete',

  // Platform
  'settings.manage',
  'analytics.view',
  /** Dashboard restricted to the actor's own content. */
  'analytics.own.view',
  'audit.view',
  'media.upload',
  'media.delete',

  // Shorthands used by the author workflow
  'own_content.manage',
  'own_content.publish',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const PERMISSION_SET: ReadonlySet<string> = new Set(PERMISSIONS)

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value)
}

/** Grouped for the role editor UI. The order is the order rendered. */
export const PERMISSION_GROUPS: ReadonlyArray<{ key: string; label: string; permissions: readonly Permission[] }> = [
  { key: 'users', label: 'Users', permissions: ['users.view', 'users.create', 'users.edit', 'users.delete'] },
  { key: 'roles', label: 'Roles & permissions', permissions: ['roles.manage'] },
  { key: 'authors', label: 'Authors', permissions: ['authors.view', 'authors.create', 'authors.edit', 'authors.delete', 'authors.verify'] },
  { key: 'books', label: 'Books', permissions: ['books.view', 'books.create', 'books.edit', 'books.publish', 'books.delete'] },
  { key: 'audiobooks', label: 'Audiobooks', permissions: ['audiobooks.view', 'audiobooks.create', 'audiobooks.edit', 'audiobooks.delete'] },
  { key: 'articles', label: 'Articles', permissions: ['articles.view', 'articles.create', 'articles.edit', 'articles.publish', 'articles.delete'] },
  { key: 'categories', label: 'Categories', permissions: ['categories.view', 'categories.create', 'categories.edit', 'categories.delete'] },
  { key: 'collections', label: 'Collections', permissions: ['collections.view', 'collections.create', 'collections.edit', 'collections.delete'] },
  { key: 'membership', label: 'Membership', permissions: ['plans.view', 'plans.manage', 'subscriptions.view', 'subscriptions.manage'] },
  {
    key: 'coupons',
    label: 'Coupons',
    permissions: ['coupons.view', 'coupons.create', 'coupons.edit', 'coupons.delete', 'coupons.analytics', 'coupons.global.manage'],
  },
  {
    key: 'author-coupons',
    label: 'Author coupons',
    permissions: ['author.coupons.create', 'author.coupons.edit', 'author.coupons.delete', 'author.coupons.analytics'],
  },
  { key: 'reviews', label: 'Reviews', permissions: ['reviews.view', 'reviews.moderate', 'reviews.delete'] },
  { key: 'feedback', label: 'Feedback', permissions: ['feedback.view', 'feedback.respond', 'feedback.assign', 'feedback.delete'] },
  { key: 'policies', label: 'Policies & terms', permissions: ['policies.view', 'policies.edit', 'policies.publish'] },
  { key: 'sliders', label: 'Sliders & banners', permissions: ['sliders.view', 'sliders.create', 'sliders.edit', 'sliders.delete'] },
  { key: 'platform', label: 'Platform', permissions: ['settings.manage', 'analytics.view', 'analytics.own.view', 'audit.view'] },
  { key: 'media', label: 'Media', permissions: ['media.upload', 'media.delete'] },
  { key: 'own-content', label: 'Own content', permissions: ['own_content.manage', 'own_content.publish'] },
]

/**
 * `all` — every row in the catalogue.
 * `own` — only rows whose `author_id` belongs to the actor (see CmsActor).
 */
export type RoleScope = 'all' | 'own'

export interface SystemRoleDefinition {
  key: string
  name: string
  description: string
  scope: RoleScope
  /** Precedence for the denormalised `users.role` column; higher wins. */
  rank: number
  permissions: readonly Permission[]
}

const MANAGER_PERMISSIONS: readonly Permission[] = PERMISSIONS.filter(
  (p) =>
    // Managers run the catalogue and the community but never touch system
    // configuration: role definitions, permission assignments or settings.
    !['roles.manage', 'settings.manage', 'audit.view', 'users.delete'].includes(p) &&
    !p.startsWith('author.coupons.') &&
    !p.startsWith('own_content.') &&
    p !== 'analytics.own.view',
)

const AUTHOR_PERMISSIONS: readonly Permission[] = [
  'authors.view',
  'books.view',
  'books.create',
  'books.edit',
  'books.publish',
  'books.delete',
  'audiobooks.view',
  'audiobooks.create',
  'audiobooks.edit',
  'audiobooks.delete',
  'articles.view',
  'articles.create',
  'articles.edit',
  'articles.publish',
  'articles.delete',
  'categories.view',
  'collections.view',
  'coupons.view',
  'author.coupons.create',
  'author.coupons.edit',
  'author.coupons.delete',
  'author.coupons.analytics',
  'reviews.view',
  'analytics.own.view',
  'media.upload',
  'own_content.manage',
  'own_content.publish',
]

/** Seeded on first migration; `is_system` rows cannot be deleted or renamed. */
export const SYSTEM_ROLES: readonly SystemRoleDefinition[] = [
  {
    key: 'admin',
    name: 'Administrator',
    description: 'Full system access, including roles, permissions and settings.',
    scope: 'all',
    rank: 400,
    permissions: PERMISSIONS,
  },
  {
    key: 'manager',
    name: 'Manager',
    description: 'Runs the catalogue, membership and community. No system configuration.',
    scope: 'all',
    rank: 300,
    permissions: MANAGER_PERMISSIONS,
  },
  {
    key: 'author',
    name: 'Author',
    description: 'Manages only their own books, audiobooks, articles and coupons.',
    scope: 'own',
    rank: 200,
    permissions: AUTHOR_PERMISSIONS,
  },
  {
    key: 'user',
    name: 'Member',
    description: 'Reader account with no CMS access.',
    scope: 'own',
    rank: 100,
    permissions: [],
  },
]

export const SYSTEM_ROLE_KEYS: readonly string[] = SYSTEM_ROLES.map((r) => r.key)

/** Ordered highest-precedence first; used to derive the legacy `users.role` value. */
export const ROLE_RANK: Readonly<Record<string, number>> = Object.fromEntries(SYSTEM_ROLES.map((r) => [r.key, r.rank]))

/**
 * Coupon scopes an actor may create. Authors are limited to their own books
 * and articles: global and subscription campaigns need `coupons.global.manage`.
 */
export const GLOBAL_COUPON_SCOPES = ['global', 'subscription'] as const
export const ITEM_COUPON_SCOPES = ['book', 'article'] as const
export const COUPON_SCOPES = [...GLOBAL_COUPON_SCOPES, ...ITEM_COUPON_SCOPES] as const
export type CouponScope = (typeof COUPON_SCOPES)[number]
