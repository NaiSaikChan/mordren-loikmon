/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { onMounted, computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthorsStore } from '@/stores/authors';
import { useBooksStore } from '@/stores/books';
import { useArticlesStore } from '@/stores/articles';
import BookCard from '@/components/shared/BookCard.vue';
import ArticleCard from '@/components/shared/ArticleCard.vue';
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue';
const props = defineProps();
const { t } = useI18n();
const authorsStore = useAuthorsStore();
const booksStore = useBooksStore();
const articlesStore = useArticlesStore();
const author = computed(() => authorsStore.detail);
const tab = ref('books');
const authorBooks = ref([]);
const authorArticles = ref([]);
function fixUrl(url) {
    if (!url)
        return '';
    return url.replace(/\\/g, '/').replace(/ /g, '%20');
}
onMounted(async () => {
    await authorsStore.fetchDetail(props.id);
    // Fetch books and articles by this author in parallel
    const [br, ar] = await Promise.all([
        booksStore.fetchBooks({ id: props.id, page: '0' }),
        articlesStore.fetchArticles({ id: props.id, page: '0' }),
    ]);
    authorBooks.value = booksStore.list;
    authorArticles.value = articlesStore.list;
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
    to: "/authors",
    ...{ class: "inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-500 mb-6" },
}));
const __VLS_2 = __VLS_1({
    to: "/authors",
    ...{ class: "inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-500 mb-6" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
(__VLS_ctx.t('common.back'));
var __VLS_3;
if (__VLS_ctx.authorsStore.loading && !__VLS_ctx.author) {
    /** @type {[typeof LoadingSpinner, ]} */ ;
    // @ts-ignore
    const __VLS_4 = __VLS_asFunctionalComponent(LoadingSpinner, new LoadingSpinner({}));
    const __VLS_5 = __VLS_4({}, ...__VLS_functionalComponentArgsRest(__VLS_4));
}
else if (__VLS_ctx.author) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card p-6 flex gap-5 items-start mb-6 flex-col sm:flex-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "w-24 h-24 rounded-full overflow-hidden bg-brand-100 dark:bg-brand-900/30 shrink-0 flex items-center justify-center" },
    });
    if (__VLS_ctx.fixUrl(__VLS_ctx.author.avatar_url ?? __VLS_ctx.author.avatar)) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
            ...{ onError: (...[$event]) => {
                    if (!!(__VLS_ctx.authorsStore.loading && !__VLS_ctx.author))
                        return;
                    if (!(__VLS_ctx.author))
                        return;
                    if (!(__VLS_ctx.fixUrl(__VLS_ctx.author.avatar_url ?? __VLS_ctx.author.avatar)))
                        return;
                    $event.target.style.display = 'none';
                } },
            src: (__VLS_ctx.fixUrl(__VLS_ctx.author.avatar_url ?? __VLS_ctx.author.avatar)),
            alt: (__VLS_ctx.author.name),
            ...{ class: "w-full h-full object-cover" },
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-3xl font-bold text-brand-600" },
        });
        (__VLS_ctx.author.name?.charAt(0));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
        ...{ class: "text-xl font-bold text-gray-900 dark:text-white mb-1" },
    });
    (__VLS_ctx.author.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-sm text-gray-400 mb-3" },
    });
    (__VLS_ctx.author.books_count ?? __VLS_ctx.authorBooks.length);
    if (__VLS_ctx.author.followers_count) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.author.followers_count);
    }
    if (__VLS_ctx.author.bio) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "text-sm text-gray-600 dark:text-gray-300 mb-4" },
        });
        (__VLS_ctx.author.bio);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.authorsStore.loading && !__VLS_ctx.author))
                    return;
                if (!(__VLS_ctx.author))
                    return;
                __VLS_ctx.authorsStore.toggleFollow(props.id);
            } },
        ...{ class: (__VLS_ctx.author.is_following ? 'btn-secondary' : 'btn-primary') },
    });
    (__VLS_ctx.author.is_following ? __VLS_ctx.t('authors.unfollow') : __VLS_ctx.t('authors.follow'));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex gap-2 mb-6" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.authorsStore.loading && !__VLS_ctx.author))
                    return;
                if (!(__VLS_ctx.author))
                    return;
                __VLS_ctx.tab = 'books';
            } },
        ...{ class: (['px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                __VLS_ctx.tab === 'books' ? 'bg-brand-600 text-white' : 'btn-ghost']) },
    });
    (__VLS_ctx.authorBooks.length);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.authorsStore.loading && !__VLS_ctx.author))
                    return;
                if (!(__VLS_ctx.author))
                    return;
                __VLS_ctx.tab = 'articles';
            } },
        ...{ class: (['px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                __VLS_ctx.tab === 'articles' ? 'bg-brand-600 text-white' : 'btn-ghost']) },
    });
    (__VLS_ctx.authorArticles.length);
    if (__VLS_ctx.tab === 'books') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        if (__VLS_ctx.authorBooks.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "content-grid" },
            });
            for (const [b] of __VLS_getVForSourceType((__VLS_ctx.authorBooks))) {
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
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "text-center text-gray-400 py-8" },
            });
        }
    }
    if (__VLS_ctx.tab === 'articles') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        if (__VLS_ctx.authorArticles.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "space-y-3" },
            });
            for (const [a] of __VLS_getVForSourceType((__VLS_ctx.authorArticles))) {
                /** @type {[typeof ArticleCard, ]} */ ;
                // @ts-ignore
                const __VLS_10 = __VLS_asFunctionalComponent(ArticleCard, new ArticleCard({
                    key: (a.id),
                    article: (a),
                }));
                const __VLS_11 = __VLS_10({
                    key: (a.id),
                    article: (a),
                }, ...__VLS_functionalComponentArgsRest(__VLS_10));
            }
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "text-center text-gray-400 py-8" },
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
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-5']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['w-24']} */ ;
/** @type {__VLS_StyleScopedClasses['h-24']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-brand-100']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-brand-900/30']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['object-cover']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-brand-600']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['content-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['py-8']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['py-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-20']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-5xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            BookCard: BookCard,
            ArticleCard: ArticleCard,
            LoadingSpinner: LoadingSpinner,
            t: t,
            authorsStore: authorsStore,
            author: author,
            tab: tab,
            authorBooks: authorBooks,
            authorArticles: authorArticles,
            fixUrl: fixUrl,
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
