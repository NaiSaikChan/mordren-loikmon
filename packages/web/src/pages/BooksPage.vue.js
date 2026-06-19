/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBooksStore } from '@/stores/books';
import BookCard from '@/components/shared/BookCard.vue';
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
const { t } = useI18n();
const store = useBooksStore();
const categoryFilter = ref('');
onMounted(() => store.fetchBooks());
function applyFilter() {
    store.fetchBooks(categoryFilter.value ? { category_id: categoryFilter.value } : {});
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "page-wrapper" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-between mb-6" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
    ...{ class: "text-2xl font-bold text-gray-900 dark:text-white" },
});
(__VLS_ctx.t('books.title'));
if (__VLS_ctx.store.loading && __VLS_ctx.store.list.length === 0) {
    /** @type {[typeof LoadingSpinner, ]} */ ;
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(LoadingSpinner, new LoadingSpinner({}));
    const __VLS_1 = __VLS_0({}, ...__VLS_functionalComponentArgsRest(__VLS_0));
}
else if (!__VLS_ctx.store.loading && __VLS_ctx.store.list.length === 0) {
    /** @type {[typeof EmptyState, ]} */ ;
    // @ts-ignore
    const __VLS_3 = __VLS_asFunctionalComponent(EmptyState, new EmptyState({
        icon: "📚",
        title: (__VLS_ctx.t('common.notFound')),
    }));
    const __VLS_4 = __VLS_3({
        icon: "📚",
        title: (__VLS_ctx.t('common.notFound')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_3));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "content-grid" },
    });
    for (const [book] of __VLS_getVForSourceType((__VLS_ctx.store.list))) {
        /** @type {[typeof BookCard, ]} */ ;
        // @ts-ignore
        const __VLS_6 = __VLS_asFunctionalComponent(BookCard, new BookCard({
            key: (book.id),
            book: (book),
        }));
        const __VLS_7 = __VLS_6({
            key: (book.id),
            book: (book),
        }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mt-8 text-center" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.applyFilter) },
        ...{ class: "btn-secondary" },
        disabled: (__VLS_ctx.store.loading),
    });
    if (__VLS_ctx.store.loading) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.t('common.loading'));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.t('common.more'));
    }
}
/** @type {__VLS_StyleScopedClasses['page-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['content-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            BookCard: BookCard,
            LoadingSpinner: LoadingSpinner,
            EmptyState: EmptyState,
            t: t,
            store: store,
            applyFilter: applyFilter,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
