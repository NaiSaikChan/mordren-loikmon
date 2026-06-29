/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useBooksStore } from '@/stores/books';
import { useCategoriesStore } from '@/stores/categories';
import BookCard from '@/components/shared/BookCard.vue';
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
const { t } = useI18n();
const route = useRoute();
const store = useBooksStore();
const catStore = useCategoriesStore();
const page = ref(0);
const selectedCat = ref(route.query.cat ?? '');
const isLastPage = ref(false);
async function loadBooks(reset = true) {
    if (reset) {
        page.value = 0;
        store.list = [];
    }
    const params = { page: String(page.value) };
    if (selectedCat.value)
        params.cat = selectedCat.value;
    await store.fetchBooks(params);
}
async function loadMore() {
    page.value++;
    const params = { page: String(page.value) };
    if (selectedCat.value)
        params.cat = selectedCat.value;
    const prevLen = store.list.length;
    await store.fetchBooks(params);
    if (store.list.length === prevLen)
        isLastPage.value = true;
}
onMounted(async () => {
    await Promise.all([catStore.fetchCategories(), loadBooks()]);
});
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
if (__VLS_ctx.catStore.list.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.catStore.list.length))
                    return;
                __VLS_ctx.selectedCat = '';
                __VLS_ctx.loadBooks();
            } },
        ...{ class: (['shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                !__VLS_ctx.selectedCat ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-surface-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-surface-700']) },
    });
    for (const [cat] of __VLS_getVForSourceType((__VLS_ctx.catStore.list))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.catStore.list.length))
                        return;
                    __VLS_ctx.selectedCat = String(cat.id);
                    __VLS_ctx.loadBooks();
                } },
            key: (cat.id),
            ...{ class: (['shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                    __VLS_ctx.selectedCat === String(cat.id) ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-surface-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-surface-700']) },
        });
        (cat.name);
    }
}
if (__VLS_ctx.store.loading && !__VLS_ctx.store.list.length) {
    /** @type {[typeof LoadingSpinner, ]} */ ;
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(LoadingSpinner, new LoadingSpinner({}));
    const __VLS_1 = __VLS_0({}, ...__VLS_functionalComponentArgsRest(__VLS_0));
}
else if (!__VLS_ctx.store.loading && !__VLS_ctx.store.list.length) {
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
    if (!__VLS_ctx.isLastPage) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "mt-8 text-center" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.loadMore) },
            ...{ class: "btn-secondary" },
            disabled: (__VLS_ctx.store.loading),
        });
        (__VLS_ctx.store.loading ? __VLS_ctx.t('common.loading') : __VLS_ctx.t('common.more'));
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
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['scrollbar-none']} */ ;
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
            catStore: catStore,
            selectedCat: selectedCat,
            isLastPage: isLastPage,
            loadBooks: loadBooks,
            loadMore: loadMore,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
