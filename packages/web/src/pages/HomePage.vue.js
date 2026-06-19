/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBooksStore } from '@/stores/books';
import { useAuthStore } from '@/stores/auth';
import BookCard from '@/components/shared/BookCard.vue';
import SectionHeader from '@/components/shared/SectionHeader.vue';
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue';
const { t } = useI18n();
const booksStore = useBooksStore();
const authStore = useAuthStore();
onMounted(() => {
    booksStore.fetchBooks({}, true);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "page-wrapper" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "mb-8 rounded-2xl bg-linear-to-br from-brand-600 to-indigo-700 p-6 text-white shadow-lg" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "text-brand-200 text-sm font-medium mb-1" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
    ...{ class: "text-2xl font-bold" },
});
(__VLS_ctx.authStore.displayName || 'Reader');
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "mt-2 text-brand-100 text-sm" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "mt-4 flex gap-3" },
});
const __VLS_0 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    to: "/books",
    ...{ class: "inline-flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors" },
}));
const __VLS_2 = __VLS_1({
    to: "/books",
    ...{ class: "inline-flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
var __VLS_3;
const __VLS_4 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    to: "/music",
    ...{ class: "inline-flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors" },
}));
const __VLS_6 = __VLS_5({
    to: "/music",
    ...{ class: "inline-flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors" },
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_7.slots.default;
var __VLS_7;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8" },
});
for (const [item] of __VLS_getVForSourceType(([
    { to: '/books', icon: '📚', label: __VLS_ctx.t('nav.books'), color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' },
    { to: '/articles', icon: '📰', label: __VLS_ctx.t('nav.articles'), color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' },
    { to: '/music', icon: '🎵', label: __VLS_ctx.t('nav.music'), color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' },
    { to: '/library', icon: '📁', label: __VLS_ctx.t('nav.library'), color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' },
]))) {
    const __VLS_8 = {}.RouterLink;
    /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        key: (item.to),
        to: (item.to),
        ...{ class: (['flex flex-col items-center gap-2 p-4 rounded-2xl transition-transform hover:scale-105', item.color]) },
    }));
    const __VLS_10 = __VLS_9({
        key: (item.to),
        to: (item.to),
        ...{ class: (['flex flex-col items-center gap-2 p-4 rounded-2xl transition-transform hover:scale-105', item.color]) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    __VLS_11.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-2xl" },
    });
    (item.icon);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-xs font-semibold" },
    });
    (item.label);
    var __VLS_11;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "mb-8" },
});
/** @type {[typeof SectionHeader, ]} */ ;
// @ts-ignore
const __VLS_12 = __VLS_asFunctionalComponent(SectionHeader, new SectionHeader({
    title: (__VLS_ctx.t('books.title')),
    viewAllPath: "/books",
}));
const __VLS_13 = __VLS_12({
    title: (__VLS_ctx.t('books.title')),
    viewAllPath: "/books",
}, ...__VLS_functionalComponentArgsRest(__VLS_12));
if (__VLS_ctx.booksStore.loading && __VLS_ctx.booksStore.list.length === 0) {
    /** @type {[typeof LoadingSpinner, ]} */ ;
    // @ts-ignore
    const __VLS_15 = __VLS_asFunctionalComponent(LoadingSpinner, new LoadingSpinner({}));
    const __VLS_16 = __VLS_15({}, ...__VLS_functionalComponentArgsRest(__VLS_15));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "content-grid" },
    });
    for (const [book] of __VLS_getVForSourceType((__VLS_ctx.booksStore.list.slice(0, 12)))) {
        /** @type {[typeof BookCard, ]} */ ;
        // @ts-ignore
        const __VLS_18 = __VLS_asFunctionalComponent(BookCard, new BookCard({
            key: (book.id),
            book: (book),
        }));
        const __VLS_19 = __VLS_18({
            key: (book.id),
            book: (book),
        }, ...__VLS_functionalComponentArgsRest(__VLS_18));
    }
}
/** @type {__VLS_StyleScopedClasses['page-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-8']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-linear-to-br']} */ ;
/** @type {__VLS_StyleScopedClasses['from-brand-600']} */ ;
/** @type {__VLS_StyleScopedClasses['to-indigo-700']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-brand-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-brand-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white/20']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-white/30']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white/20']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-white/30']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-4']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-8']} */ ;
/** @type {__VLS_StyleScopedClasses['content-grid']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            BookCard: BookCard,
            SectionHeader: SectionHeader,
            LoadingSpinner: LoadingSpinner,
            t: t,
            booksStore: booksStore,
            authStore: authStore,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
