import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    scrollBehavior: () => ({ top: 0 }),
    routes: [
        // ─── Auth ──────────────────────────────────────
        {
            path: '/auth',
            component: () => import('@/pages/AuthPage.vue'),
            meta: { requiresGuest: true },
        },
        // ─── Main app shell ────────────────────────────
        {
            path: '/',
            component: () => import('@/components/layout/AppLayout.vue'),
            meta: { requiresAuth: true },
            children: [
                {
                    path: '',
                    name: 'home',
                    component: () => import('@/pages/HomePage.vue'),
                },
                {
                    path: 'books',
                    name: 'books',
                    component: () => import('@/pages/BooksPage.vue'),
                },
                {
                    path: 'books/:id',
                    name: 'book-detail',
                    component: () => import('@/pages/BookDetailPage.vue'),
                    props: true,
                },
                {
                    path: 'books/:id/read',
                    name: 'book-reader',
                    component: () => import('@/pages/BookReaderPage.vue'),
                    props: true,
                },
                {
                    path: 'articles',
                    name: 'articles',
                    component: () => import('@/pages/ArticlesPage.vue'),
                },
                {
                    path: 'articles/:id',
                    name: 'article-detail',
                    component: () => import('@/pages/ArticleDetailPage.vue'),
                    props: true,
                },
                {
                    path: 'authors',
                    name: 'authors',
                    component: () => import('@/pages/AuthorsPage.vue'),
                },
                {
                    path: 'authors/:id',
                    name: 'author-detail',
                    component: () => import('@/pages/AuthorDetailPage.vue'),
                    props: true,
                },
                {
                    path: 'music',
                    name: 'music',
                    component: () => import('@/pages/MusicPage.vue'),
                },
                {
                    path: 'music/albums/:id',
                    name: 'album-detail',
                    component: () => import('@/pages/AlbumDetailPage.vue'),
                    props: true,
                },
                {
                    path: 'search',
                    name: 'search',
                    component: () => import('@/pages/SearchPage.vue'),
                },
                {
                    path: 'library',
                    name: 'library',
                    component: () => import('@/pages/LibraryPage.vue'),
                },
                {
                    path: 'purchases',
                    name: 'purchases',
                    component: () => import('@/pages/PurchasesPage.vue'),
                },
                {
                    path: 'categories',
                    name: 'categories',
                    component: () => import('@/pages/CategoriesPage.vue'),
                },
                {
                    path: 'categories/:id',
                    name: 'category-detail',
                    component: () => import('@/pages/CategoryDetailPage.vue'),
                    props: true,
                },
                {
                    path: 'collections',
                    name: 'collections',
                    component: () => import('@/pages/CollectionsPage.vue'),
                },
                {
                    path: 'collections/:id',
                    name: 'collection-detail',
                    component: () => import('@/pages/CollectionDetailPage.vue'),
                    props: true,
                },
                {
                    path: 'inbox',
                    name: 'inbox',
                    component: () => import('@/pages/InboxPage.vue'),
                },
                {
                    path: 'settings',
                    name: 'settings',
                    component: () => import('@/pages/SettingsPage.vue'),
                },
                {
                    path: 'about',
                    name: 'about',
                    component: () => import('@/pages/AboutPage.vue'),
                },
                {
                    path: 'faq',
                    name: 'faq',
                    component: () => import('@/pages/FaqPage.vue'),
                },
            ],
        },
        // ─── 404 ────────────────────────────────────────
        {
            path: '/:pathMatch(.*)*',
            name: 'not-found',
            component: () => import('@/pages/NotFoundPage.vue'),
        },
    ],
});
// ── Navigation guards ──────────────────────────────
router.beforeEach((to) => {
    const auth = useAuthStore();
    if (to.meta.requiresAuth && !auth.isLoggedIn) {
        return { path: '/auth', query: { redirect: to.fullPath } };
    }
    if (to.meta.requiresGuest && auth.isLoggedIn) {
        return { path: '/' };
    }
});
export default router;
