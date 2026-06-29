/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { onMounted, ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useMediaStore } from '@/stores/media';
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
const { t } = useI18n();
const route = useRoute();
const store = useMediaStore();
const selectedLeague = ref(route.query.league ?? '');
function fixUrl(url) {
    if (!url)
        return '';
    return url.replace(/\\/g, '/').replace(/ /g, '%20');
}
const filteredBooks = computed(() => {
    if (!selectedLeague.value)
        return store.books;
    return store.books.filter((b) => String(b.league ?? b.category ?? b.cat) === selectedLeague.value);
});
onMounted(async () => {
    await store.fetchLeagues();
    await store.fetchMediaBooks();
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
(__VLS_ctx.t('music.title'));
if (__VLS_ctx.store.leagues.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.store.leagues.length))
                    return;
                __VLS_ctx.selectedLeague = '';
            } },
        ...{ class: (['shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                !__VLS_ctx.selectedLeague ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-surface-800 text-gray-500 dark:text-gray-300 hover:bg-gray-200']) },
    });
    for (const [l] of __VLS_getVForSourceType((__VLS_ctx.store.leagues))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.store.leagues.length))
                        return;
                    __VLS_ctx.selectedLeague = String(l.id);
                } },
            key: (l.id),
            ...{ class: (['shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                    __VLS_ctx.selectedLeague === String(l.id) ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-surface-800 text-gray-500 dark:text-gray-300 hover:bg-gray-200']) },
        });
        (l.name ?? l.title);
    }
}
if (__VLS_ctx.store.loading && !__VLS_ctx.store.books.length) {
    /** @type {[typeof LoadingSpinner, ]} */ ;
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(LoadingSpinner, new LoadingSpinner({}));
    const __VLS_1 = __VLS_0({}, ...__VLS_functionalComponentArgsRest(__VLS_0));
}
else if (!__VLS_ctx.store.loading && !__VLS_ctx.filteredBooks.length) {
    /** @type {[typeof EmptyState, ]} */ ;
    // @ts-ignore
    const __VLS_3 = __VLS_asFunctionalComponent(EmptyState, new EmptyState({
        icon: "🎵",
        title: (__VLS_ctx.t('common.notFound')),
    }));
    const __VLS_4 = __VLS_3({
        icon: "🎵",
        title: (__VLS_ctx.t('common.notFound')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_3));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4" },
    });
    for (const [book] of __VLS_getVForSourceType((__VLS_ctx.filteredBooks))) {
        const __VLS_6 = {}.RouterLink;
        /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ]} */ ;
        // @ts-ignore
        const __VLS_7 = __VLS_asFunctionalComponent(__VLS_6, new __VLS_6({
            key: (book.id),
            to: (`/books/${book.id}`),
            ...{ class: "group block card overflow-hidden" },
        }));
        const __VLS_8 = __VLS_7({
            key: (book.id),
            to: (`/books/${book.id}`),
            ...{ class: "group block card overflow-hidden" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_7));
        __VLS_9.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "aspect-square bg-gray-100 dark:bg-surface-800 overflow-hidden relative" },
        });
        if (__VLS_ctx.fixUrl(book.thumbnail ?? book.coverphoto)) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
                ...{ onError: (...[$event]) => {
                        if (!!(__VLS_ctx.store.loading && !__VLS_ctx.store.books.length))
                            return;
                        if (!!(!__VLS_ctx.store.loading && !__VLS_ctx.filteredBooks.length))
                            return;
                        if (!(__VLS_ctx.fixUrl(book.thumbnail ?? book.coverphoto)))
                            return;
                        $event.target.style.display = 'none';
                    } },
                src: (__VLS_ctx.fixUrl(book.thumbnail ?? book.coverphoto)),
                alt: (book.title),
                ...{ class: "w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" },
                loading: "lazy",
            });
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "w-full h-full flex items-center justify-center text-4xl" },
            });
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "absolute bottom-2 right-2 bg-black/60 rounded-full px-2 py-0.5 text-white text-xs flex items-center gap-1" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "p-2.5" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
            ...{ class: "text-xs font-semibold text-gray-900 dark:text-white line-clamp-2 leading-tight" },
        });
        (book.title);
        if (book.authorname ?? book.author) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "text-xs text-gray-400 truncate mt-0.5" },
            });
            (book.authorname ?? book.author);
        }
        var __VLS_9;
    }
}
if (__VLS_ctx.store.books.length && !__VLS_ctx.store.loading) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mt-8 text-center" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.store.books.length && !__VLS_ctx.store.loading))
                    return;
                __VLS_ctx.store.fetchMediaBooks(undefined, true);
            } },
        ...{ class: "btn-secondary" },
    });
    (__VLS_ctx.t('common.more'));
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
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-3']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-4']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-5']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-6']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['group']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['aspect-square']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-surface-800']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['object-cover']} */ ;
/** @type {__VLS_StyleScopedClasses['group-hover:scale-105']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-transform']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-300']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-4xl']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-2']} */ ;
/** @type {__VLS_StyleScopedClasses['right-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/60']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['line-clamp-2']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-tight']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
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
            selectedLeague: selectedLeague,
            fixUrl: fixUrl,
            filteredBooks: filteredBooks,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
