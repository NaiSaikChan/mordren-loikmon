/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useArticlesStore } from '@/stores/articles';
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue';
const props = defineProps();
const { t } = useI18n();
const store = useArticlesStore();
const article = computed(() => store.detail);
function fixUrl(url) {
    if (!url)
        return '';
    let u = url.replace(/\\/g, '/');
    u = u.replace(/\u202f/gi, '%E2%80%AF').replace(/ /g, '%20');
    return u;
}
const thumbnail = computed(() => fixUrl(article.value?.thumbnail ?? article.value?.thumbnail_url ?? ''));
onMounted(async () => {
    await store.fetchDetail(props.id);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "page-wrapper max-w-3xl mx-auto" },
});
const __VLS_0 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    to: "/articles",
    ...{ class: "inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-500 mb-6" },
}));
const __VLS_2 = __VLS_1({
    to: "/articles",
    ...{ class: "inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-500 mb-6" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
(__VLS_ctx.t('common.back'));
var __VLS_3;
if (__VLS_ctx.store.loading && !__VLS_ctx.article) {
    /** @type {[typeof LoadingSpinner, ]} */ ;
    // @ts-ignore
    const __VLS_4 = __VLS_asFunctionalComponent(LoadingSpinner, new LoadingSpinner({}));
    const __VLS_5 = __VLS_4({}, ...__VLS_functionalComponentArgsRest(__VLS_4));
}
else if (__VLS_ctx.article) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
        ...{ class: "card overflow-hidden" },
    });
    if (__VLS_ctx.thumbnail) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "w-full aspect-video overflow-hidden bg-gray-100 dark:bg-surface-800" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
            ...{ onError: (...[$event]) => {
                    if (!!(__VLS_ctx.store.loading && !__VLS_ctx.article))
                        return;
                    if (!(__VLS_ctx.article))
                        return;
                    if (!(__VLS_ctx.thumbnail))
                        return;
                    $event.target.style.display = 'none';
                } },
            src: (__VLS_ctx.thumbnail),
            alt: (__VLS_ctx.article.title),
            ...{ class: "w-full h-full object-cover" },
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "p-6 sm:p-8" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
        ...{ class: "text-2xl font-bold text-gray-900 dark:text-white mb-3" },
    });
    (__VLS_ctx.article.title);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-wrap gap-2 mb-6 text-xs text-gray-500 dark:text-gray-400" },
    });
    if (__VLS_ctx.article.authorname ?? __VLS_ctx.article.author) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.article.authorname ?? __VLS_ctx.article.author);
    }
    if (__VLS_ctx.article.categoryname) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.article.categoryname);
    }
    if (__VLS_ctx.article.articledate ?? __VLS_ctx.article.date) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.article.articledate ?? __VLS_ctx.article.date);
    }
    if (__VLS_ctx.article.content) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
            ...{ class: "prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vHtml)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.article.content) }, null, null);
    }
    else if (__VLS_ctx.article.description) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "text-gray-600 dark:text-gray-300 leading-relaxed" },
        });
        (__VLS_ctx.article.description);
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "text-gray-400 italic" },
        });
    }
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-center py-20 text-gray-400" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-5xl mb-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    (__VLS_ctx.t('common.notFound'));
}
/** @type {__VLS_StyleScopedClasses['page-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-brand-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-brand-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['aspect-video']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-surface-800']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['object-cover']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:p-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['prose']} */ ;
/** @type {__VLS_StyleScopedClasses['prose-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:prose-invert']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['italic']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-20']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-5xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            LoadingSpinner: LoadingSpinner,
            t: t,
            store: store,
            article: article,
            thumbnail: thumbnail,
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
