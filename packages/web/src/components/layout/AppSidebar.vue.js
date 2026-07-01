/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const uiStore = useUiStore();
const navItems = computed(() => [
    { key: 'home', icon: '🏠', label: t('nav.home'), path: '/' },
    { key: 'books', icon: '📚', label: t('nav.books'), path: '/books' },
    { key: 'articles', icon: '📰', label: t('nav.articles'), path: '/articles' },
    { key: 'authors', icon: '✍️', label: t('nav.authors'), path: '/authors' },
    { key: 'music', icon: '🎵', label: t('nav.music'), path: '/music' },
    { key: 'search', icon: '🔍', label: t('nav.search'), path: '/search' },
    { key: 'library', icon: '📁', label: t('nav.library'), path: '/library' },
    { key: 'purchases', icon: '💳', label: t('nav.purchases'), path: '/purchases' },
    { key: 'collections', icon: '📦', label: t('nav.collections'), path: '/collections' },
    { key: 'inbox', icon: '📬', label: 'Inbox', path: '/inbox' },
]);
const bottomItems = computed(() => [
    { key: 'settings', icon: '⚙️', label: t('nav.settings'), path: '/settings' },
    { key: 'faq', icon: '❓', label: t('nav.faq'), path: '/faq' },
    { key: 'about', icon: 'ℹ️', label: t('nav.about'), path: '/about' },
]);
function isActive(path) {
    if (path === '/')
        return route.path === '/';
    return route.path.startsWith(path);
}
function navigate(path) {
    router.push(path);
    uiStore.closeSidebar();
}
async function handleLogout() {
    await authStore.logout();
    router.push('/auth');
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.aside, __VLS_intrinsicElements.aside)({
    ...{ class: ([
            'fixed inset-y-0 left-0 z-30 flex flex-col w-64 bg-white dark:bg-surface-900',
            'border-r border-gray-100 dark:border-gray-800 transition-transform duration-200',
            'lg:translate-x-0 lg:static lg:z-auto',
            __VLS_ctx.uiStore.sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        ]) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center gap-3 px-4 py-5 border-b border-gray-100 dark:border-gray-800" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white text-lg" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "font-bold text-gray-900 dark:text-white text-sm leading-tight" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "text-xs text-gray-400" },
});
if (__VLS_ctx.authStore.user) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "px-3 py-3 border-b border-gray-100 dark:border-gray-800" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-2.5 px-2 py-2 rounded-xl bg-gray-50 dark:bg-surface-800" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "w-8 h-8 rounded-full bg-brand-200 dark:bg-brand-800 flex items-center justify-center text-brand-700 dark:text-brand-300 font-semibold text-sm" },
    });
    (__VLS_ctx.authStore.displayName.charAt(0).toUpperCase());
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-1 min-w-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-sm font-medium text-gray-900 dark:text-white truncate" },
    });
    (__VLS_ctx.authStore.displayName);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-xs text-gray-400 truncate" },
    });
    (__VLS_ctx.authStore.coinBalance);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.nav, __VLS_intrinsicElements.nav)({
    ...{ class: "flex-1 overflow-y-auto px-3 py-3 space-y-0.5" },
});
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.navItems))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.navigate(item.path);
            } },
        key: (item.key),
        ...{ class: (['nav-link w-full text-left', __VLS_ctx.isActive(item.path) && 'nav-link-active']) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-base leading-none" },
    });
    (item.icon);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (item.label);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "px-3 py-3 border-t border-gray-100 dark:border-gray-800 space-y-0.5" },
});
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.bottomItems))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.navigate(item.path);
            } },
        key: (item.key),
        ...{ class: (['nav-link w-full text-left', __VLS_ctx.isActive(item.path) && 'nav-link-active']) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-base leading-none" },
    });
    (item.icon);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (item.label);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.handleLogout) },
    ...{ class: "nav-link w-full text-left text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-5']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['w-9']} */ ;
/** @type {__VLS_StyleScopedClasses['h-9']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-brand-600']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-tight']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-surface-800']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-brand-200']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-brand-800']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-brand-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-brand-300']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-none']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-none']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-link']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-red-50']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:hover:bg-red-900/20']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            authStore: authStore,
            uiStore: uiStore,
            navItems: navItems,
            bottomItems: bottomItems,
            isActive: isActive,
            navigate: navigate,
            handleLogout: handleLogout,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
