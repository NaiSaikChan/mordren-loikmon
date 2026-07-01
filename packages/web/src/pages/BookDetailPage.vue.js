/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { onMounted, computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBooksStore } from '@/stores/books';
import { useReviewsStore } from '@/stores/reviews';
import { useAuthStore } from '@/stores/auth';
import { books as booksApi } from '@loikmon/api';
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue';
import BookCard from '@/components/shared/BookCard.vue';
const props = defineProps();
const { t } = useI18n();
const store = useBooksStore();
const reviews = useReviewsStore();
const auth = useAuthStore();
const book = computed(() => store.detail);
const cover = computed(() => {
    if (!book.value)
        return '';
    return fixUrl(book.value.thumbnail ?? book.value.coverphoto ?? book.value.cover_url ?? book.value.cover ?? '');
});
const tab = ref('details');
const coverError = ref(false);
const newReview = ref('');
const newRating = ref(5);
const submitting = ref(false);
const reviewMsg = ref('');
function fixUrl(url) {
    if (!url)
        return '';
    return url.replace(/\\/g, '/').replace(/ /g, '%20').replace(/\u202f/gi, '%20');
}
function openReader() {
    window.open(`/mordren-loikmon/reader/${props.id}`, '_blank');
}
async function submitReview() {
    if (!newReview.value.trim())
        return;
    submitting.value = true;
    try {
        await reviews.submitReview(props.id, 'book', newReview.value, newRating.value);
        newReview.value = '';
        reviewMsg.value = 'Review submitted!';
    }
    catch {
        reviewMsg.value = 'Failed to submit';
    }
    finally {
        submitting.value = false;
    }
}
async function loadBook() {
    coverError.value = false;
    await store.fetchDetail(props.id);
    await reviews.loadReviews(props.id, 'book');
    booksApi.updateTotalViews(props.id);
    if (book.value)
        store.fetchRelated(props.id);
}
onMounted(loadBook);
// Handle route param changes (navigating between different books)
watch(() => props.id, loadBook);
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
(__VLS_ctx.t('books.title'));
var __VLS_3;
if (__VLS_ctx.store.loading && !__VLS_ctx.book) {
    /** @type {[typeof LoadingSpinner, ]} */ ;
    // @ts-ignore
    const __VLS_4 = __VLS_asFunctionalComponent(LoadingSpinner, new LoadingSpinner({}));
    const __VLS_5 = __VLS_4({}, ...__VLS_functionalComponentArgsRest(__VLS_4));
}
else if (__VLS_ctx.book) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card overflow-hidden mb-6" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-col sm:flex-row gap-6 p-6" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "w-full sm:w-40 shrink-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "aspect-3/4 rounded-xl overflow-hidden bg-gray-100 dark:bg-surface-800 shadow-lg" },
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
                    __VLS_ctx.coverError = true;
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
        ...{ class: "text-xl font-bold text-gray-900 dark:text-white mb-2" },
    });
    (__VLS_ctx.book.title);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-brand-600 dark:text-brand-400 text-sm font-medium mb-1" },
    });
    (__VLS_ctx.book.authorname ?? __VLS_ctx.book.author);
    if (__VLS_ctx.book.category ?? __VLS_ctx.book.cat) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "text-xs text-gray-400 mb-3" },
        });
        (__VLS_ctx.book.category ?? __VLS_ctx.book.cat);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-4 text-xs text-gray-400 mb-4 flex-wrap" },
    });
    if (__VLS_ctx.book.pages ?? __VLS_ctx.book.pagecount) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.book.pages ?? __VLS_ctx.book.pagecount);
    }
    if (__VLS_ctx.book.rating) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.book.rating);
    }
    if (__VLS_ctx.book.views ?? __VLS_ctx.book.total_views) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.book.views ?? __VLS_ctx.book.total_views);
    }
    if (__VLS_ctx.book.is_free) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-green-500 font-semibold" },
        });
    }
    else if (__VLS_ctx.book.price) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-brand-600 font-semibold" },
        });
        (__VLS_ctx.book.price);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex gap-3 flex-wrap" },
    });
    if (__VLS_ctx.book.pdf ?? __VLS_ctx.book.pdffile) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.openReader) },
            ...{ class: "btn-primary" },
        });
    }
    if (__VLS_ctx.book.pdf ?? __VLS_ctx.book.pdffile) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
            href: (__VLS_ctx.fixUrl(__VLS_ctx.book.pdf ?? __VLS_ctx.book.pdffile)),
            target: "_blank",
            ...{ class: "btn-secondary" },
        });
    }
    if (__VLS_ctx.store.chapters.length) {
        const __VLS_7 = {}.RouterLink;
        /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ]} */ ;
        // @ts-ignore
        const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
            to: (`/books/${props.id}/reader`),
            ...{ class: "btn-secondary" },
        }));
        const __VLS_9 = __VLS_8({
            to: (`/books/${props.id}/reader`),
            ...{ class: "btn-secondary" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_8));
        __VLS_10.slots.default;
        (__VLS_ctx.store.chapters.length);
        var __VLS_10;
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex gap-2 mb-6" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.store.loading && !__VLS_ctx.book))
                    return;
                if (!(__VLS_ctx.book))
                    return;
                __VLS_ctx.tab = 'details';
            } },
        ...{ class: (['px-4 py-2 rounded-xl text-sm font-medium', __VLS_ctx.tab === 'details' ? 'bg-brand-600 text-white' : 'btn-ghost']) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.store.loading && !__VLS_ctx.book))
                    return;
                if (!(__VLS_ctx.book))
                    return;
                __VLS_ctx.tab = 'reviews';
            } },
        ...{ class: (['px-4 py-2 rounded-xl text-sm font-medium', __VLS_ctx.tab === 'reviews' ? 'bg-brand-600 text-white' : 'btn-ghost']) },
    });
    (__VLS_ctx.reviews.list.length);
    if (__VLS_ctx.tab === 'details') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        if (__VLS_ctx.book.description ?? __VLS_ctx.book.about) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "card p-5 mb-6" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
                ...{ class: "font-semibold text-gray-800 dark:text-gray-200 mb-2" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line" },
            });
            (__VLS_ctx.book.description ?? __VLS_ctx.book.about);
        }
        if (__VLS_ctx.store.related.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
                ...{ class: "section-title" },
            });
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
    if (__VLS_ctx.tab === 'reviews') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        if (__VLS_ctx.auth.isLoggedIn) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "card p-5 mb-6" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
                ...{ class: "font-semibold text-gray-800 dark:text-gray-200 mb-3" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex gap-1 mb-3" },
            });
            for (const [s] of __VLS_getVForSourceType((5))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.store.loading && !__VLS_ctx.book))
                                return;
                            if (!(__VLS_ctx.book))
                                return;
                            if (!(__VLS_ctx.tab === 'reviews'))
                                return;
                            if (!(__VLS_ctx.auth.isLoggedIn))
                                return;
                            __VLS_ctx.newRating = s;
                        } },
                    key: (s),
                    ...{ class: (['text-2xl transition-transform hover:scale-110', s <= __VLS_ctx.newRating ? 'text-yellow-400' : 'text-gray-300']) },
                });
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.textarea)({
                value: (__VLS_ctx.newReview),
                ...{ class: "input w-full h-24 resize-none" },
                placeholder: "Share your thoughts...",
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex items-center justify-between mt-3" },
            });
            if (__VLS_ctx.reviewMsg) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                    ...{ class: "text-sm text-green-500" },
                });
                (__VLS_ctx.reviewMsg);
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (__VLS_ctx.submitReview) },
                ...{ class: "btn-primary ml-auto" },
                disabled: (__VLS_ctx.submitting || !__VLS_ctx.newReview.trim()),
            });
            (__VLS_ctx.submitting ? 'Submitting...' : 'Submit Review');
        }
        if (__VLS_ctx.reviews.list.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "space-y-4" },
            });
            for (const [r] of __VLS_getVForSourceType((__VLS_ctx.reviews.list))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    key: (r.id),
                    ...{ class: "card p-4" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "flex items-start gap-3" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center shrink-0 font-bold text-brand-600" },
                });
                ((r.author_name ?? r.username ?? 'U').charAt(0).toUpperCase());
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "flex-1" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "flex items-center gap-2" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "font-medium text-sm text-gray-900 dark:text-white" },
                });
                (r.author_name ?? r.username);
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "text-yellow-400 text-xs" },
                });
                ('★'.repeat(r.rating ?? 0));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                    ...{ class: "text-sm text-gray-600 dark:text-gray-300 mt-1" },
                });
                (r.content ?? r.comment);
                if (r.created_at) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                        ...{ class: "text-xs text-gray-400 mt-1" },
                    });
                    (new Date(r.created_at).toLocaleDateString());
                }
            }
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "text-center py-8 text-gray-400" },
            });
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
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-6']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:w-40']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['aspect-3/4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-surface-800']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ ;
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
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-brand-600']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-brand-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-500']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-brand-600']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-pre-line']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['content-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-24']} */ ;
/** @type {__VLS_StyleScopedClasses['resize-none']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-500']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['w-9']} */ ;
/** @type {__VLS_StyleScopedClasses['h-9']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-brand-100']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-brand-900/30']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-brand-600']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['text-yellow-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
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
            reviews: reviews,
            auth: auth,
            book: book,
            cover: cover,
            tab: tab,
            coverError: coverError,
            newReview: newReview,
            newRating: newRating,
            submitting: submitting,
            reviewMsg: reviewMsg,
            fixUrl: fixUrl,
            openReader: openReader,
            submitReview: submitReview,
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
