/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { usePurchasesStore } from '@/stores/purchases';
import BookCard from '@/components/shared/BookCard.vue';
import ArticleCard from '@/components/shared/ArticleCard.vue';
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue';
const { t } = useI18n();
const authStore = useAuthStore();
const store = usePurchasesStore();
const tab = ref('books');
onMounted(() => {
    if (authStore.isLoggedIn)
        store.fetchAll();
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
(__VLS_ctx.t('library.title'));
if (!__VLS_ctx.authStore.isLoggedIn) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card p-12 text-center text-gray-400" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-6xl mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "mb-4" },
    });
    const __VLS_0 = {}.RouterLink;
    /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        to: "/auth",
        ...{ class: "btn-primary inline-flex" },
    }));
    const __VLS_2 = __VLS_1({
        to: "/auth",
        ...{ class: "btn-primary inline-flex" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_3.slots.default;
    var __VLS_3;
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex gap-2 mb-6" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.authStore.isLoggedIn))
                    return;
                __VLS_ctx.tab = 'books';
            } },
        ...{ class: (['px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                __VLS_ctx.tab === 'books' ? 'bg-brand-600 text-white' : 'btn-ghost']) },
    });
    (__VLS_ctx.store.books.length);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.authStore.isLoggedIn))
                    return;
                __VLS_ctx.tab = 'articles';
            } },
        ...{ class: (['px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                __VLS_ctx.tab === 'articles' ? 'bg-brand-600 text-white' : 'btn-ghost']) },
    });
    (__VLS_ctx.store.articles.length);
    if (__VLS_ctx.store.loading) {
        /** @type {[typeof LoadingSpinner, ]} */ ;
        // @ts-ignore
        const __VLS_4 = __VLS_asFunctionalComponent(LoadingSpinner, new LoadingSpinner({}));
        const __VLS_5 = __VLS_4({}, ...__VLS_functionalComponentArgsRest(__VLS_4));
    }
    else if (__VLS_ctx.tab === 'books') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        if (__VLS_ctx.store.books.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "content-grid" },
            });
            for (const [b] of __VLS_getVForSourceType((__VLS_ctx.store.books))) {
                /** @type {[typeof BookCard, ]} */ ;
                // @ts-ignore
                const __VLS_7 = __VLS_asFunctionalComponent(BookCard, new BookCard({
                    key: (b.id),
                    book: (b),
                }));
                const __VLS_8 = __VLS_7({
                    key: (b.id),
                    book: (b),
                }, ...__VLS_functionalComponentArgsRest(__VLS_7));
            }
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "card p-12 text-center text-gray-400" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "text-5xl mb-3" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
            const __VLS_10 = {}.RouterLink;
            /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ]} */ ;
            // @ts-ignore
            const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({
                to: "/books",
                ...{ class: "btn-primary inline-flex mt-4" },
            }));
            const __VLS_12 = __VLS_11({
                to: "/books",
                ...{ class: "btn-primary inline-flex mt-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_11));
            __VLS_13.slots.default;
            var __VLS_13;
        }
    }
    else if (__VLS_ctx.tab === 'articles') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        if (__VLS_ctx.store.articles.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "space-y-3" },
            });
            for (const [a] of __VLS_getVForSourceType((__VLS_ctx.store.articles))) {
                /** @type {[typeof ArticleCard, ]} */ ;
                // @ts-ignore
                const __VLS_14 = __VLS_asFunctionalComponent(ArticleCard, new ArticleCard({
                    key: (a.id),
                    article: (a),
                }));
                const __VLS_15 = __VLS_14({
                    key: (a.id),
                    article: (a),
                }, ...__VLS_functionalComponentArgsRest(__VLS_14));
            }
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "card p-12 text-center text-gray-400" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "text-5xl mb-3" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
            const __VLS_17 = {}.RouterLink;
            /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ]} */ ;
            // @ts-ignore
            const __VLS_18 = __VLS_asFunctionalComponent(__VLS_17, new __VLS_17({
                to: "/articles",
                ...{ class: "btn-primary inline-flex mt-4" },
            }));
            const __VLS_19 = __VLS_18({
                to: "/articles",
                ...{ class: "btn-primary inline-flex mt-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_18));
            __VLS_20.slots.default;
            var __VLS_20;
        }
    }
}
/** @type {__VLS_StyleScopedClasses['page-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['p-12']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-6xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['content-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['p-12']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-5xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['p-12']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-5xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            BookCard: BookCard,
            ArticleCard: ArticleCard,
            LoadingSpinner: LoadingSpinner,
            t: t,
            authStore: authStore,
            store: store,
            tab: tab,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
