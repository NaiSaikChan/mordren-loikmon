/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBooksStore } from '@/stores/books';
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue';
import BookCard from '@/components/shared/BookCard.vue';
const props = defineProps();
const { t } = useI18n();
const store = useBooksStore();
const book = computed(() => store.detail);
function fixUrl(url) {
    if (!url)
        return '';
    let u = url.replace(/\\/g, '/');
    u = u.replace(/\u202f/gi, '%E2%80%AF').replace(/ /g, '%20');
    return u;
}
const cover = computed(() => fixUrl(book.value?.thumbnail ?? book.value?.coverphoto ?? book.value?.cover_url ?? book.value?.cover ?? ''));
const pdfUrl = computed(() => fixUrl(book.value?.pdf ?? ''));
const authorName = computed(() => book.value?.authorname ?? book.value?.author ?? '');
const isFree = computed(() => {
    const p = book.value?.amount ?? book.value?.price;
    return book.value?.is_free || !p || Number(p) === 0;
});
onMounted(async () => {
    await store.fetchDetail(props.id);
    store.fetchRelated(props.id);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "page-wrapper" },
});
const __VLS_0 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    to: "/books",
    ...{ class: "inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-500 mb-6" },
}));
const __VLS_2 = __VLS_1({
    to: "/books",
    ...{ class: "inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-500 mb-6" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
(__VLS_ctx.t('common.back'));
var __VLS_3;
if (__VLS_ctx.store.loading && !__VLS_ctx.book) {
    /** @type {[typeof LoadingSpinner, ]} */ ;
    // @ts-ignore
    const __VLS_4 = __VLS_asFunctionalComponent(LoadingSpinner, new LoadingSpinner({}));
    const __VLS_5 = __VLS_4({}, ...__VLS_functionalComponentArgsRest(__VLS_4));
}
else if (__VLS_ctx.book) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "max-w-4xl mx-auto" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex gap-6 mb-8 flex-col sm:flex-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "w-40 shrink-0 rounded-2xl overflow-hidden shadow-lg bg-gray-100 dark:bg-surface-800 aspect-[3/4]" },
    });
    if (__VLS_ctx.cover) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
            ...{ onError: (...[$event]) => {
                    if (!!(__VLS_ctx.store.loading && !__VLS_ctx.book))
                        return;
                    if (!(__VLS_ctx.book))
                        return;
                    if (!(__VLS_ctx.cover))
                        return;
                    $event.target.style.display = 'none';
                } },
            src: (__VLS_ctx.cover),
            alt: (__VLS_ctx.book.title),
            ...{ class: "w-full h-full object-cover" },
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "w-full h-full flex items-center justify-center text-5xl" },
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
        ...{ class: "text-2xl font-bold text-gray-900 dark:text-white mb-2" },
    });
    (__VLS_ctx.book.title);
    if (__VLS_ctx.authorName) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "text-brand-600 dark:text-brand-400 font-medium mb-3" },
        });
        (__VLS_ctx.t('common.by'));
        (__VLS_ctx.authorName);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-wrap gap-2 mb-4" },
    });
    if (__VLS_ctx.isFree) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "badge-green" },
        });
        (__VLS_ctx.t('books.free'));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "badge-brand" },
        });
        (__VLS_ctx.book.amount ?? __VLS_ctx.book.price);
    }
    if (__VLS_ctx.book.rating) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "badge-yellow" },
        });
        (Number(__VLS_ctx.book.rating).toFixed(1));
    }
    if (__VLS_ctx.book.pages) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "badge-gray" },
        });
        (__VLS_ctx.book.pages);
    }
    if (__VLS_ctx.book.categoryname) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "badge-gray" },
        });
        (__VLS_ctx.book.categoryname);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-wrap gap-3" },
    });
    if (__VLS_ctx.pdfUrl) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
            href: (__VLS_ctx.pdfUrl),
            target: "_blank",
            rel: "noopener",
            ...{ class: "btn-primary" },
        });
        (__VLS_ctx.t('books.read'));
    }
    else {
        const __VLS_7 = {}.RouterLink;
        /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ]} */ ;
        // @ts-ignore
        const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
            to: (`/books/${__VLS_ctx.id}/read`),
            ...{ class: "btn-primary" },
        }));
        const __VLS_9 = __VLS_8({
            to: (`/books/${__VLS_ctx.id}/read`),
            ...{ class: "btn-primary" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_8));
        __VLS_10.slots.default;
        (__VLS_ctx.t('books.read'));
        var __VLS_10;
    }
    if (!__VLS_ctx.isFree && !__VLS_ctx.book.is_purchased) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ class: "btn-secondary" },
        });
        (__VLS_ctx.t('books.purchase'));
    }
    if (__VLS_ctx.book.description) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "mb-6" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
            ...{ class: "section-title" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "text-gray-600 dark:text-gray-300 text-sm leading-relaxed" },
        });
        (__VLS_ctx.book.description);
    }
    if (__VLS_ctx.store.related.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
            ...{ class: "section-title" },
        });
        (__VLS_ctx.t('books.related'));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "content-grid" },
        });
        for (const [b] of __VLS_getVForSourceType((__VLS_ctx.store.related.slice(0, 6)))) {
            /** @type {[typeof BookCard, ]} */ ;
            // @ts-ignore
            const __VLS_11 = __VLS_asFunctionalComponent(BookCard, new BookCard({
                key: (b.id),
                book: (b),
            }));
            const __VLS_12 = __VLS_11({
                key: (b.id),
                book: (b),
            }, ...__VLS_functionalComponentArgsRest(__VLS_11));
        }
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
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-brand-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-brand-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-4xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-6']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-8']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['w-40']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-surface-800']} */ ;
/** @type {__VLS_StyleScopedClasses['aspect-[3/4]']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['object-cover']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-5xl']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-brand-600']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-brand-400']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-green']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-brand']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-yellow']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-gray']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-gray']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['content-grid']} */ ;
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
            BookCard: BookCard,
            t: t,
            store: store,
            book: book,
            cover: cover,
            pdfUrl: pdfUrl,
            authorName: authorName,
            isFree: isFree,
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
