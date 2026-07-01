/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCategoriesStore } from '@/stores/categories';
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue';
const { t } = useI18n();
const store = useCategoriesStore();
onMounted(() => store.fetchCategories());
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
if (__VLS_ctx.store.loading) {
    /** @type {[typeof LoadingSpinner, ]} */ ;
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(LoadingSpinner, new LoadingSpinner({}));
    const __VLS_1 = __VLS_0({}, ...__VLS_functionalComponentArgsRest(__VLS_0));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4" },
    });
    for (const [cat] of __VLS_getVForSourceType((__VLS_ctx.store.list))) {
        const __VLS_3 = {}.RouterLink;
        /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ]} */ ;
        // @ts-ignore
        const __VLS_4 = __VLS_asFunctionalComponent(__VLS_3, new __VLS_3({
            key: (cat.id),
            to: (`/categories/${cat.id}`),
            ...{ class: "card p-5 flex flex-col items-center gap-3 text-center hover:border-brand-400 transition-colors" },
        }));
        const __VLS_5 = __VLS_4({
            key: (cat.id),
            to: (`/categories/${cat.id}`),
            ...{ class: "card p-5 flex flex-col items-center gap-3 text-center hover:border-brand-400 transition-colors" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_4));
        __VLS_6.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-2xl" },
        });
        (cat.icon ?? '📂');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "font-semibold text-sm text-gray-900 dark:text-white" },
        });
        (cat.name);
        if (cat.books_count) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "text-xs text-gray-400 mt-0.5" },
            });
            (cat.books_count);
        }
        var __VLS_6;
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
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:border-brand-400']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['w-12']} */ ;
/** @type {__VLS_StyleScopedClasses['h-12']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-brand-50']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-brand-900/20']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            LoadingSpinner: LoadingSpinner,
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
