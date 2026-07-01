/// <reference types="../../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useUiStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';
const { t, locale } = useI18n();
const router = useRouter();
const uiStore = useUiStore();
const authStore = useAuthStore();
const searchQuery = ref('');
function handleSearch() {
    if (searchQuery.value.trim()) {
        router.push({ path: '/search', query: { q: searchQuery.value } });
        searchQuery.value = '';
    }
}
function cycleTheme() {
    const order = ['light', 'dark', 'system'];
    const idx = order.indexOf(uiStore.theme);
    uiStore.setTheme(order[(idx + 1) % order.length]);
}
function toggleLocale() {
    const next = uiStore.locale === 'en' ? 'mon' : 'en';
    uiStore.setLocale(next);
    locale.value = next;
}
function logout() {
    authStore.logout();
    router.push('/');
}
const themeIcon = { light: '☀️', dark: '🌙', system: '💻' };
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({
    ...{ class: "h-14 flex items-center gap-3 px-4 bg-white dark:bg-surface-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.uiStore.toggleSidebar();
        } },
    ...{ class: "lg:hidden btn-ghost p-2 -ml-1" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)({
    ...{ class: "w-5 h-5" },
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
    'stroke-width': "2",
    d: "M4 6h16M4 12h16M4 18h16",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
    ...{ onSubmit: (__VLS_ctx.handleSearch) },
    ...{ class: "flex-1 max-w-xl" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "relative" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ class: "input pl-9 pr-4 h-9 text-sm" },
    placeholder: (__VLS_ctx.t('search.placeholder')),
});
(__VLS_ctx.searchQuery);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center gap-1 ml-auto" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.toggleLocale) },
    ...{ class: "btn-ghost px-2.5 py-1.5 text-xs font-semibold rounded-lg" },
});
(__VLS_ctx.uiStore.locale === 'en' ? 'မန်' : 'EN');
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.cycleTheme) },
    ...{ class: "btn-ghost p-2 rounded-lg text-base" },
    title: (`Theme: ${__VLS_ctx.uiStore.theme}`),
});
(__VLS_ctx.themeIcon[__VLS_ctx.uiStore.theme]);
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$router.push('/inbox');
        } },
    ...{ class: "btn-ghost p-2 rounded-lg text-base" },
});
if (__VLS_ctx.authStore.isLoggedIn) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-2 pl-1 border-l border-gray-200 dark:border-gray-700 ml-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block truncate max-w-[100px]" },
    });
    (__VLS_ctx.authStore.displayName);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.logout) },
        ...{ class: "btn-ghost px-2.5 py-1.5 text-xs" },
    });
    (__VLS_ctx.t('nav.logout'));
}
else {
    const __VLS_0 = {}.RouterLink;
    /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        to: "/auth",
        ...{ class: "ml-1 btn-primary px-3 py-1.5 text-xs" },
    }));
    const __VLS_2 = __VLS_1({
        to: "/auth",
        ...{ class: "ml-1 btn-primary px-3 py-1.5 text-xs" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_3.slots.default;
    (__VLS_ctx.t('nav.login'));
    var __VLS_3;
}
/** @type {__VLS_StyleScopedClasses['h-14']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-surface-900']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['sticky']} */ ;
/** @type {__VLS_StyleScopedClasses['top-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['-ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['left-3']} */ ;
/** @type {__VLS_StyleScopedClasses['top-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['-translate-y-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['pl-9']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-9']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pl-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border-l']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:block']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-[100px]']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            t: t,
            uiStore: uiStore,
            authStore: authStore,
            searchQuery: searchQuery,
            handleSearch: handleSearch,
            cycleTheme: cycleTheme,
            toggleLocale: toggleLocale,
            logout: logout,
            themeIcon: themeIcon,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
