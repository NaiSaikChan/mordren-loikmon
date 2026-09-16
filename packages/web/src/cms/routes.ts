import type { RouteRecordRaw, RouteRecordSingleView } from 'vue-router'
import { ROUTE_PERMISSIONS } from './navigation'

/**
 * CMS routes, mounted at `/cms` outside the storefront shell.
 *
 * Every page is a separate chunk (`() => import(...)`), so a reader who never
 * opens the CMS never downloads it. `meta.permissions` is checked by the guard
 * installed in `router/index.ts`.
 */
const route = (
  path: string,
  name: string,
  title: string,
  component: NonNullable<RouteRecordSingleView['component']>,
): RouteRecordRaw => ({
  path,
  name,
  component,
  meta: { title, permissions: ROUTE_PERMISSIONS[name] ?? [], requiresCms: true },
})

export const cmsRoutes: RouteRecordRaw[] = [
  {
    path: '/cms',
    component: () => import('@/cms/layout/CmsLayout.vue'),
    meta: { requiresAuth: true, requiresCms: true },
    children: [
      route('', 'cms-dashboard', 'Dashboard', () => import('@/cms/pages/DashboardPage.vue')),

      // Catalogue
      route('books', 'cms-books', 'Books', () => import('@/cms/pages/BooksPage.vue')),
      {
        path: 'books/:id',
        name: 'cms-book-edit',
        component: () => import('@/cms/pages/BookEditPage.vue'),
        props: true,
        meta: { title: 'Edit book', permissions: ['books.view'], requiresCms: true },
      },
      route('audiobooks', 'cms-audiobooks', 'Audiobooks', () => import('@/cms/pages/AudiobooksPage.vue')),
      route('articles', 'cms-articles', 'Articles', () => import('@/cms/pages/ArticlesPage.vue')),
      {
        path: 'articles/:id',
        name: 'cms-article-edit',
        component: () => import('@/cms/pages/ArticleEditPage.vue'),
        props: true,
        meta: { title: 'Edit article', permissions: ['articles.view'], requiresCms: true },
      },
      route('authors', 'cms-authors', 'Authors', () => import('@/cms/pages/AuthorsPage.vue')),
      route('categories', 'cms-categories', 'Categories', () => import('@/cms/pages/CategoriesPage.vue')),
      route('collections', 'cms-collections', 'Collections', () => import('@/cms/pages/CollectionsPage.vue')),

      // Commerce
      route('membership', 'cms-membership', 'Membership', () => import('@/cms/pages/MembershipPage.vue')),
      route('coupons', 'cms-coupons', 'Coupons', () => import('@/cms/pages/CouponsPage.vue')),
      {
        path: 'coupons/:id',
        name: 'cms-coupon-detail',
        component: () => import('@/cms/pages/CouponDetailPage.vue'),
        props: true,
        meta: { title: 'Campaign', permissions: ['coupons.view', 'author.coupons.analytics'], requiresCms: true },
      },

      // Community
      route('reviews', 'cms-reviews', 'Reviews', () => import('@/cms/pages/ReviewsPage.vue')),
      route('feedback', 'cms-feedback', 'Feedback', () => import('@/cms/pages/FeedbackPage.vue')),

      // Site
      route('sliders', 'cms-sliders', 'Sliders & banners', () => import('@/cms/pages/SlidersPage.vue')),
      route('policies', 'cms-policies', 'Policies & terms', () => import('@/cms/pages/PoliciesPage.vue')),
      route('settings', 'cms-settings', 'Website settings', () => import('@/cms/pages/SettingsPage.vue')),

      // Administration
      route('users', 'cms-users', 'Users', () => import('@/cms/pages/UsersPage.vue')),
      route('roles', 'cms-roles', 'Roles & permissions', () => import('@/cms/pages/RolesPage.vue')),
      route('audit', 'cms-audit', 'Activity log', () => import('@/cms/pages/AuditPage.vue')),
    ],
  },
]
