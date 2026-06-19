/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { ref, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useSearchStore } from '@/stores/search';
import BookCard from '@/components/shared/BookCard.vue';
import ArticleCard from '@/components/shared/ArticleCard.vue';
import AuthorCard from '@/components/shared/AuthorCard.vue';
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue';
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const store = useSearchStore();
const query = ref(route.query.q ?? '');
let debounceTimer = null;
watch(query, (q) => {
    if (debounceTimer)
        clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        router.replace({ query: q ? { q } : {} });
        if (q.trim())
            store.search(q.trim());
    }, 350);
});
onMounted(() => {
    if (query.value)
        store.search(query.value);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "page-wrapper" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "max-w-2xl mx-auto mb-8" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "relative" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ class: "input pl-10 h-12 text-base" },
    placeholder: (__VLS_ctx.t('search.placeholder')),
    autofocus: true,
});
(__VLS_ctx.query);
if (__VLS_ctx.store.loading) {
    /** @type {[typeof LoadingSpinner, ]} */ ;
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(LoadingSpinner, new LoadingSpinner({}));
    const __VLS_1 = __VLS_0({}, ...__VLS_functionalComponentArgsRest(__VLS_0));
}
else if (__VLS_ctx.store.results) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    if (__VLS_ctx.store.results.books?.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            ...{ class: "mb-8" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
            ...{ class: "section-title" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "content-grid" },
        });
        for (const [b] of __VLS_getVForSourceType((__VLS_ctx.store.results.books))) {
            /** @type {[typeof BookCard, ]} */ ;
            // @ts-ignore
            const __VLS_3 = __VLS_asFunctionalComponent(BookCard, new BookCard({
                key: (b.id),
                book: (b),
            }));
            const __VLS_4 = __VLS_3({
                key: (b.id),
                book: (b),
            }, ...__VLS_functionalComponentArgsRest(__VLS_3));
        }
    }
    if (__VLS_ctx.store.results.articles?.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            ...{ class: "mb-8" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
            ...{ class: "section-title" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "space-y-3" },
        });
        for (const [a] of __VLS_getVForSourceType((__VLS_ctx.store.results.articles))) {
            /** @type {[typeof ArticleCard, ]} */ ;
            // @ts-ignore
            const __VLS_6 = __VLS_asFunctionalComponent(ArticleCard, new ArticleCard({
                key: (a.id),
                article: (a),
            }));
            const __VLS_7 = __VLS_6({
                key: (a.id),
                article: (a),
            }, ...__VLS_functionalComponentArgsRest(__VLS_6));
        }
    }
    if (__VLS_ctx.store.results.authors?.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            ...{ class: "mb-8" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
            ...{ class: "section-title" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "grid grid-cols-2 sm:grid-cols-4 gap-4" },
        });
        for (const [a] of __VLS_getVForSourceType((__VLS_ctx.store.results.authors))) {
            /** @type {[typeof AuthorCard, ]} */ ;
            // @ts-ignore
            const __VLS_9 = __VLS_asFunctionalComponent(AuthorCard, new AuthorCard({
                key: (a.id),
                author: (a),
            }));
            const __VLS_10 = __VLS_9({
                key: (a.id),
                author: (a),
            }, ...__VLS_functionalComponentArgsRest(__VLS_9));
        }
    }
    if (__VLS_ctx.query && !__VLS_ctx.store.loading && !__VLS_ctx.store.results.books?.length && !__VLS_ctx.store.results.articles?.length && !__VLS_ctx.store.results.authors?.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-center py-16 text-gray-400" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-5xl mb-3" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        (__VLS_ctx.t('search.noResults', { query: __VLS_ctx.query }));
    }
}
else if (!__VLS_ctx.query) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-center py-16 text-gray-400" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-5xl mb-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.t('search.placeholder'));
}
/** @type {__VLS_StyleScopedClasses['page-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-8']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['left-3']} */ ;
/** @type {__VLS_StyleScopedClasses['top-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['-translate-y-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['pl-10']} */ ;
/** @type {__VLS_StyleScopedClasses['h-12']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-8']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['content-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-8']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-8']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-4']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-16']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-5xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-16']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-5xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            BookCard: BookCard,
            ArticleCard: ArticleCard,
            AuthorCard: AuthorCard,
            LoadingSpinner: LoadingSpinner,
            t: t,
            store: store,
            query: query,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
