/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCollectionsStore } from '@/stores/collections';
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
const { t } = useI18n();
const store = useCollectionsStore();
onMounted(() => store.fetchCollections());
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
(__VLS_ctx.t('nav.collections'));
if (__VLS_ctx.store.loading) {
    /** @type {[typeof LoadingSpinner, ]} */ ;
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(LoadingSpinner, new LoadingSpinner({}));
    const __VLS_1 = __VLS_0({}, ...__VLS_functionalComponentArgsRest(__VLS_0));
}
else if (!__VLS_ctx.store.loading && !__VLS_ctx.store.list.length) {
    /** @type {[typeof EmptyState, ]} */ ;
    // @ts-ignore
    const __VLS_3 = __VLS_asFunctionalComponent(EmptyState, new EmptyState({
        icon: "📦",
        title: "No collections yet",
    }));
    const __VLS_4 = __VLS_3({
        icon: "📦",
        title: "No collections yet",
    }, ...__VLS_functionalComponentArgsRest(__VLS_3));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4" },
    });
    for (const [col] of __VLS_getVForSourceType((__VLS_ctx.store.list))) {
        const __VLS_6 = {}.RouterLink;
        /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ]} */ ;
        // @ts-ignore
        const __VLS_7 = __VLS_asFunctionalComponent(__VLS_6, new __VLS_6({
            key: (col.id),
            to: (`/collections/${col.id}`),
            ...{ class: "card overflow-hidden group hover:border-brand-400 transition-colors" },
        }));
        const __VLS_8 = __VLS_7({
            key: (col.id),
            to: (`/collections/${col.id}`),
            ...{ class: "card overflow-hidden group hover:border-brand-400 transition-colors" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_7));
        __VLS_9.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "h-36 bg-gradient-to-br from-brand-600/80 to-indigo-700/80 flex items-center justify-center" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-5xl" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "p-4" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
            ...{ class: "font-semibold text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors" },
        });
        (col.name ?? col.title);
        if (col.description) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "text-sm text-gray-400 mt-1 line-clamp-2" },
            });
            (col.description);
        }
        if (col.books_count) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "text-xs text-gray-400 mt-2" },
            });
            (col.books_count);
        }
        var __VLS_9;
    }
}
if (__VLS_ctx.store.list.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mt-8 text-center" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.store.list.length))
                    return;
                __VLS_ctx.store.fetchCollections(1);
            } },
        ...{ class: "btn-secondary" },
        disabled: (__VLS_ctx.store.loading),
    });
    (__VLS_ctx.t('common.more'));
}
/** @type {__VLS_StyleScopedClasses['page-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-3']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['group']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:border-brand-400']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['h-36']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gradient-to-br']} */ ;
/** @type {__VLS_StyleScopedClasses['from-brand-600/80']} */ ;
/** @type {__VLS_StyleScopedClasses['to-indigo-700/80']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-5xl']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['group-hover:text-brand-600']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:group-hover:text-brand-400']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['line-clamp-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            LoadingSpinner: LoadingSpinner,
            EmptyState: EmptyState,
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
