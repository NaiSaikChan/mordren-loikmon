/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useArticlesStore } from '@/stores/articles';
import { useCategoriesStore } from '@/stores/categories';
import ArticleCard from '@/components/shared/ArticleCard.vue';
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
const { t } = useI18n();
const store = useArticlesStore();
const catStore = useCategoriesStore();
const page = ref(0);
const selectedCat = ref(0);
const isLastPage = ref(false);
async function loadArticles(reset = true) {
    if (reset) {
        page.value = 0;
        store.list = [];
    }
    const params = {
        page: page.value,
        type: 1,
        query: '',
        category: selectedCat.value
    };
    await store.fetchArticles(params);
}
async function loadMore() {
    page.value++;
    const prevLen = store.list.length;
    await store.fetchArticles({
        page: page.value,
        type: 1,
        query: '',
        category: selectedCat.value
    });
    if (store.list.length === prevLen)
        isLastPage.value = true;
}
onMounted(async () => {
    await Promise.all([catStore.fetchCategories(), loadArticles()]);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "page-wrapper" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
    ...{ class: "text-2xl font-bold text-gray-900 dark:text-white mb-6" },
});
(__VLS_ctx.t('articles.title'));
if (__VLS_ctx.catStore.list.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.catStore.list.length))
                    return;
                __VLS_ctx.selectedCat = 0;
                __VLS_ctx.loadArticles();
            } },
        ...{ class: (['shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                __VLS_ctx.selectedCat === 0 ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-surface-800 text-gray-600 dark:text-gray-300']) },
    });
    for (const [cat] of __VLS_getVForSourceType((__VLS_ctx.catStore.list))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.catStore.list.length))
                        return;
                    __VLS_ctx.selectedCat = cat.id;
                    __VLS_ctx.loadArticles();
                } },
            key: (cat.id),
            ...{ class: (['shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                    __VLS_ctx.selectedCat === cat.id ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-surface-800 text-gray-600 dark:text-gray-300']) },
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
        icon: "📰",
        title: (__VLS_ctx.t('common.notFound')),
    }));
    const __VLS_4 = __VLS_3({
        icon: "📰",
        title: (__VLS_ctx.t('common.notFound')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_3));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "space-y-3" },
    });
    for (const [article] of __VLS_getVForSourceType((__VLS_ctx.store.list))) {
        /** @type {[typeof ArticleCard, ]} */ ;
        // @ts-ignore
        const __VLS_6 = __VLS_asFunctionalComponent(ArticleCard, new ArticleCard({
            key: (article.id),
            article: (article),
        }));
        const __VLS_7 = __VLS_6({
            key: (article.id),
            article: (article),
        }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    }
}
if (!__VLS_ctx.isLastPage && __VLS_ctx.store.list.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mt-6 text-center" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.loadMore) },
        ...{ class: "btn-secondary" },
        disabled: (__VLS_ctx.store.loading),
    });
    (__VLS_ctx.store.loading ? __VLS_ctx.t('common.loading') : __VLS_ctx.t('common.more'));
}
/** @type {__VLS_StyleScopedClasses['page-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['scrollbar-none']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            ArticleCard: ArticleCard,
            LoadingSpinner: LoadingSpinner,
            EmptyState: EmptyState,
            t: t,
            store: store,
            catStore: catStore,
            selectedCat: selectedCat,
            isLastPage: isLastPage,
            loadArticles: loadArticles,
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
