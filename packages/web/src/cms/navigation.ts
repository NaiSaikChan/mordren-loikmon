/**
 * Single source of truth for the CMS menu and its route guards.
 *
 * Each entry names the permissions that make it reachable; the sidebar hides
 * what the session cannot open and the router refuses to navigate there. The
 * server enforces the same permissions independently.
 */
export interface NavItem {
  name: string
  label: string
  icon: string
  /** Any one of these permissions is enough to see the entry. */
  permissions: string[]
  description?: string
}

export interface NavSection {
  key: string
  label: string
  items: NavItem[]
}

export const CMS_NAV: NavSection[] = [
  {
    key: 'overview',
    label: 'Overview',
    items: [
      {
        name: 'cms-dashboard',
        label: 'Dashboard',
        icon: '◱',
        permissions: ['analytics.view', 'analytics.own.view'],
        description: 'Revenue, audience and content performance',
      },
    ],
  },
  {
    key: 'catalogue',
    label: 'Catalogue',
    items: [
      { name: 'cms-books', label: 'Books', icon: '▤', permissions: ['books.view'] },
      { name: 'cms-audiobooks', label: 'Audiobooks', icon: '♪', permissions: ['audiobooks.view'] },
      { name: 'cms-articles', label: 'Articles', icon: '✎', permissions: ['articles.view'] },
      { name: 'cms-authors', label: 'Authors', icon: '☺', permissions: ['authors.view'] },
      { name: 'cms-categories', label: 'Categories', icon: '⌸', permissions: ['categories.view'] },
      { name: 'cms-collections', label: 'Collections', icon: '❏', permissions: ['collections.view'] },
    ],
  },
  {
    key: 'commerce',
    label: 'Commerce',
    items: [
      { name: 'cms-membership', label: 'Membership', icon: '◈', permissions: ['plans.view', 'subscriptions.view'] },
      { name: 'cms-coupons', label: 'Coupons', icon: '%', permissions: ['coupons.view', 'author.coupons.analytics'] },
    ],
  },
  {
    key: 'community',
    label: 'Community',
    items: [
      { name: 'cms-reviews', label: 'Reviews', icon: '★', permissions: ['reviews.view'] },
      { name: 'cms-feedback', label: 'Feedback', icon: '✉', permissions: ['feedback.view'] },
    ],
  },
  {
    key: 'site',
    label: 'Site',
    items: [
      { name: 'cms-sliders', label: 'Sliders', icon: '▭', permissions: ['sliders.view'] },
      { name: 'cms-policies', label: 'Policies & terms', icon: '§', permissions: ['policies.view'] },
      { name: 'cms-settings', label: 'Settings', icon: '⚙', permissions: ['settings.manage'] },
    ],
  },
  {
    key: 'administration',
    label: 'Administration',
    items: [
      { name: 'cms-users', label: 'Users', icon: '☷', permissions: ['users.view'] },
      { name: 'cms-roles', label: 'Roles & permissions', icon: '🛡', permissions: ['roles.manage'] },
      { name: 'cms-audit', label: 'Activity log', icon: '⏱', permissions: ['audit.view'] },
    ],
  },
]

/** Flat lookup of route name to the permissions it requires. */
export const ROUTE_PERMISSIONS: Record<string, string[]> = Object.fromEntries(
  CMS_NAV.flatMap((section) => section.items.map((item) => [item.name, item.permissions])),
)

/** The first entry the session can actually open — where `/cms` lands. */
export function firstAllowedRoute(canAny: (...permissions: string[]) => boolean): string | null {
  for (const section of CMS_NAV) {
    for (const item of section.items) {
      if (canAny(...item.permissions)) return item.name
    }
  }
  return null
}
