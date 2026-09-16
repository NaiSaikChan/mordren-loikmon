import { useAuthStore } from '@/stores/auth'
import { useCmsSessionStore } from '@/cms/stores/session'
import { cmsRoutes } from '@/cms/routes'
import { firstAllowedRoute } from '@/cms/navigation'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  // ─── CMS (own shell, lazily loaded, permission-guarded) ────────────
  ...cmsRoutes,

  // ─── Auth (standalone pages, outside the app shell) ────────────────
  {
    path: '/auth',
    name: 'auth',
    component: () => import('@/pages/AuthPage.vue'),
  },
  {
    // The backend emails password-reset links to `${APP_WEB_URL}/auth/reset-password?token=…`
    path: '/auth/reset-password',
    name: 'reset-password',
    component: () => import('@/pages/ResetPasswordPage.vue'),
  },

  // ─── Main app shell ────────────────────────────────────────────────
  {
    path: '/',
    component: () => import('@/components/layout/AppLayout.vue'),
    children: [
      { path: '',           name: 'home',              component: () => import('@/pages/HomePage.vue') },
      { path: 'books',      name: 'books',             component: () => import('@/pages/BooksPage.vue') },
      { path: 'books/:id',  name: 'book-detail',       component: () => import('@/pages/BookDetailPage.vue'),   props: true },
      { path: 'books/:id/read', name: 'book-reader',   component: () => import('@/pages/BookReaderPage.vue'),   props: true },
      { path: 'articles',   name: 'articles',          component: () => import('@/pages/ArticlesPage.vue') },
      { path: 'articles/:id', name: 'article-detail',  component: () => import('@/pages/ArticleDetailPage.vue'), props: true },
      { path: 'authors',    name: 'authors',           component: () => import('@/pages/AuthorsPage.vue') },
      { path: 'authors/:id', name: 'author-detail',    component: () => import('@/pages/AuthorDetailPage.vue'), props: true },
      { path: 'audiobooks', name: 'audiobooks',        component: () => import('@/pages/AudiobooksPage.vue') },
      { path: 'music',      redirect: { name: 'audiobooks' } },
      { path: 'search',     name: 'search',            component: () => import('@/pages/SearchPage.vue') },
      { path: 'library',    name: 'library',           component: () => import('@/pages/LibraryPage.vue'), meta: { requiresAuth: true } },
      { path: 'subscription', name: 'subscription',    component: () => import('@/pages/SubscriptionPage.vue') },
      // Old bookmark: coin purchases were replaced by subscriptions.
      { path: 'purchases',  redirect: { name: 'subscription' } },
      { path: 'categories', name: 'categories',        component: () => import('@/pages/CategoriesPage.vue') },
      { path: 'categories/:id', name: 'category-detail', component: () => import('@/pages/CategoryDetailPage.vue'), props: true },
      { path: 'collections', name: 'collections',      component: () => import('@/pages/CollectionsPage.vue') },
      { path: 'collections/:id', name: 'collection-detail', component: () => import('@/pages/CollectionDetailPage.vue'), props: true },
      { path: 'inbox',      name: 'inbox',             component: () => import('@/pages/InboxPage.vue') },
      { path: 'settings',   name: 'settings',          component: () => import('@/pages/SettingsPage.vue') },
      { path: 'about',      name: 'about',             component: () => import('@/pages/AboutPage.vue') },
      { path: 'faq',        name: 'faq',               component: () => import('@/pages/FaqPage.vue') },
    ],
  },

  // ─── 404 ──────────────────────────────────────────────────────────
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFoundPage.vue') },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes,
})

router.beforeEach(async (to) => {
  const needsAuth = to.matched.some((record) => record.meta?.requiresAuth)
  const needsCms = to.matched.some((record) => record.meta?.requiresCms)
  if (!needsAuth && !needsCms) return

  const auth = useAuthStore()
  // On a fresh page load the stored token is still being validated with auth.me().
  await auth.ensureRestored()
  if (!auth.isLoggedIn) {
    return { name: 'auth', query: { redirect: to.fullPath } }
  }
  if (!needsCms) return

  // The CMS session carries the permission set. It is a UI convenience only:
  // the API re-checks every permission on every request.
  const cms = useCmsSessionStore()
  await cms.ensureLoaded()
  if (!cms.canAccess) return { name: 'home' }

  const required = (to.meta?.permissions as string[] | undefined) ?? []
  if (required.length && !cms.canAny(...required)) {
    // Send them to the first section they can actually open rather than a dead end.
    const fallback = firstAllowedRoute((...permissions) => cms.canAny(...permissions))
    return fallback && fallback !== to.name ? { name: fallback } : { name: 'home' }
  }
})

router.afterEach((to) => {
  const baseTitle = 'Mordren Loikmon'
  if (to.meta?.title) {
    document.title = `${to.meta.title} | Loikmon CMS`
    return
  }
  const routeName = String(to.name || '')
  if (routeName && routeName !== 'home') {
    const formatted = routeName
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    document.title = `${formatted} | ${baseTitle}`
  } else {
    document.title = baseTitle
  }
})

export default router
