/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthorsStore } from '@/stores/authors';
import AuthorCard from '@/components/shared/AuthorCard.vue';
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue';
const { t } = useI18n();
const store = useAuthorsStore();
onMounted(() => store.fetchAuthors());
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
(__VLS_ctx.t('authors.title'));
if (__VLS_ctx.store.loading) {
    /** @type {[typeof LoadingSpinner, ]} */ ;
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(LoadingSpinner, new LoadingSpinner({}));
    const __VLS_1 = __VLS_0({}, ...__VLS_functionalComponentArgsRest(__VLS_0));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4" },
    });
    for (const [author] of __VLS_getVForSourceType((__VLS_ctx.store.list))) {
        /** @type {[typeof AuthorCard, ]} */ ;
        // @ts-ignore
        const __VLS_3 = __VLS_asFunctionalComponent(AuthorCard, new AuthorCard({
            key: (author.id),
            author: (author),
        }));
        const __VLS_4 = __VLS_3({
            key: (author.id),
            author: (author),
        }, ...__VLS_functionalComponentArgsRest(__VLS_3));
    }
}
/** @type {__VLS_StyleScopedClasses['page-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-3']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-4']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-5']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-6']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            AuthorCard: AuthorCard,
            LoadingSpinner: LoadingSpinner,
            t: t,
            store: store,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
