/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { onMounted, computed, ref } from 'vue';
import { useBooksStore } from '@/stores/books';
import { useI18n } from 'vue-i18n';
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue';
const props = defineProps();
const { t } = useI18n();
const store = useBooksStore();
const pdfError = ref(false);
function fixUrl(url) {
    if (!url)
        return '';
    let u = url.replace(/\\/g, '/');
    u = u.replace(/\u202f/gi, '%E2%80%AF').replace(/ /g, '%20');
    return u;
}
const book = computed(() => store.detail);
const pdfUrl = computed(() => fixUrl(store.detail?.pdf ?? ''));
const viewerUrl = computed(() => {
    if (!pdfUrl.value)
        return '';
    return `https://docs.google.com/viewer?url=${encodeURIComponent(pdfUrl.value)}&embedded=true`;
});
onMounted(async () => {
    if (!store.detail || String(store.detail.id) !== String(props.id)) {
        await store.fetchDetail(props.id);
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex flex-col h-full" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "h-12 bg-white dark:bg-surface-900 border-b border-gray-100 dark:border-gray-800 flex items-center px-4 gap-3 shrink-0" },
});
const __VLS_0 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    to: (`/books/${__VLS_ctx.id}`),
    ...{ class: "btn-ghost p-2 text-sm" },
}));
const __VLS_2 = __VLS_1({
    to: (`/books/${__VLS_ctx.id}`),
    ...{ class: "btn-ghost p-2 text-sm" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
(__VLS_ctx.t('common.back'));
var __VLS_3;
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
    ...{ class: "font-semibold text-sm text-gray-700 dark:text-gray-300 truncate flex-1" },
});
(__VLS_ctx.book?.title ?? 'Book Reader');
if (__VLS_ctx.pdfUrl) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        href: (__VLS_ctx.pdfUrl),
        target: "_blank",
        rel: "noopener",
        ...{ class: "btn-ghost text-xs px-3 py-1.5 hidden sm:flex items-center gap-1" },
    });
}
if (__VLS_ctx.store.loading && !__VLS_ctx.book) {
    /** @type {[typeof LoadingSpinner, ]} */ ;
    // @ts-ignore
    const __VLS_4 = __VLS_asFunctionalComponent(LoadingSpinner, new LoadingSpinner({}));
    const __VLS_5 = __VLS_4({}, ...__VLS_functionalComponentArgsRest(__VLS_4));
}
else if (__VLS_ctx.viewerUrl && !__VLS_ctx.pdfError) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-1 overflow-hidden" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.iframe)({
        ...{ onError: (...[$event]) => {
                if (!!(__VLS_ctx.store.loading && !__VLS_ctx.book))
                    return;
                if (!(__VLS_ctx.viewerUrl && !__VLS_ctx.pdfError))
                    return;
                __VLS_ctx.pdfError = true;
            } },
        src: (__VLS_ctx.viewerUrl),
        ...{ class: "w-full h-full border-0" },
        allow: "fullscreen",
    });
}
else if (__VLS_ctx.pdfUrl) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-6xl" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-gray-600 dark:text-gray-300" },
    });
    (__VLS_ctx.book?.title);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        href: (__VLS_ctx.pdfUrl),
        target: "_blank",
        rel: "noopener",
        ...{ class: "btn-primary" },
    });
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-1 flex items-center justify-center text-gray-400 text-center p-8" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-5xl mb-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
}
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-12']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-surface-900']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['p-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-6xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-5xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            LoadingSpinner: LoadingSpinner,
            t: t,
            store: store,
            pdfError: pdfError,
            book: book,
            pdfUrl: pdfUrl,
            viewerUrl: viewerUrl,
        };
    },
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
