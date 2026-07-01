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
const tab = ref('about');
const authorBooks = ref([]);
const authorArticles = ref([]);
function fixUrl(url) {
    if (!url)
        return '';
    return url.replace(/\\/g, '/').replace(/ /g, '%20');
}
function getAuthorImage() {
    const url = author.value?.thumbnail ?? author.value?.avatar_url ?? author.value?.avatar ?? '';
    return fixUrl(url);
}
function getStats() {
    return [
        { label: '📚 Books', value: author.value?.books_count ?? author.value?.bookscount ?? authorBooks.value.length ?? 0 },
        { label: '📰 Articles', value: author.value?.articles_count ?? author.value?.articlescount ?? authorArticles.value.length ?? 0 },
        { label: '👥 Followers', value: Number(author.value?.followers_count ?? 0), show: Number(author.value?.followers_count ?? 0) > 0 },
    ];
}
onMounted(async () => {
    await authorsStore.fetchDetail(props.id);
    // Fetch books and articles by this author in parallel
    const [br, ar] = await Promise.all([
        booksStore.fetchBooks({
            email: 'null',
            id: props.id,
            type: 1,
            page: '0',
            cat: 0,
            sub: '0'
        }),
        articlesStore.fetchArticles({
            category: 0,
            email: 'null',
            itm: props.id,
            itmtype: 1,
            page: '0',
            sub: '0',
            type: 0
        }),
    ]);
    authorBooks.value = booksStore.list;
    authorArticles.value = articlesStore.list;
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "page-wrapper max-w-4xl" },
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
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "space-y-6" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card overflow-hidden" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "h-40 bg-linear-to-r from-brand-500 to-brand-600 dark:from-brand-700 dark:to-brand-800" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "px-6 pb-6" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-col sm:flex-row gap-6 -mt-20 sm:-mt-20" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "shrink-0" },
    });
    if (__VLS_ctx.getAuthorImage()) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "w-32 h-32 rounded-2xl overflow-hidden border-4 border-white dark:border-surface-900 shadow-lg bg-gray-200 dark:bg-surface-700" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
            src: (__VLS_ctx.getAuthorImage()),
            alt: (__VLS_ctx.author.name),
            ...{ class: "w-full h-full object-cover" },
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "w-32 h-32 rounded-2xl overflow-hidden border-4 border-white dark:border-surface-900 shadow-lg bg-linear-to-br from-brand-400 to-brand-600 flex items-center justify-center" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-5xl font-bold text-white" },
        });
        (__VLS_ctx.author.name?.charAt(0));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-1 pt-4 sm:pt-12" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
        ...{ class: "text-3xl font-bold text-gray-900 dark:text-white mb-2" },
    });
    (__VLS_ctx.author.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-wrap gap-4 mb-4" },
    });
    for (const [stat] of __VLS_getVForSourceType((__VLS_ctx.getStats()))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (stat.label),
            ...{ class: "flex items-center gap-2" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vShow)(null, { ...__VLS_directiveBindingRestFields, value: (stat.show !== false) }, null, null);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-lg" },
        });
        (stat.label.split(' ')[0]);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "font-semibold text-gray-700 dark:text-gray-300" },
        });
        (stat.value);
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
        ...{ class: "flex gap-2 border-b border-gray-200 dark:border-gray-800" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.authorsStore.loading && !__VLS_ctx.author))
                    return;
                if (!(__VLS_ctx.author))
                    return;
                __VLS_ctx.tab = 'about';
            } },
        ...{ class: ([
                'px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px',
                __VLS_ctx.tab === 'about'
                    ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            ]) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.authorsStore.loading && !__VLS_ctx.author))
                    return;
                if (!(__VLS_ctx.author))
                    return;
                __VLS_ctx.tab = 'books';
            } },
        ...{ class: ([
                'px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px',
                __VLS_ctx.tab === 'books'
                    ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            ]) },
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
        ...{ class: ([
                'px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px',
                __VLS_ctx.tab === 'articles'
                    ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            ]) },
    });
    (__VLS_ctx.authorArticles.length);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "space-y-6" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.tab === 'about') }, null, null);
    if (__VLS_ctx.author.bio) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "card p-6" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
            ...{ class: "text-xl font-semibold text-gray-900 dark:text-white mb-3" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap" },
        });
        (__VLS_ctx.author.bio);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card p-6" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
        ...{ class: "text-lg font-semibold text-gray-900 dark:text-white mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-wrap gap-3" },
    });
    if (__VLS_ctx.author.facebook) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
            href: __VLS_ctx.author.facebook,
            target: "_blank",
            rel: "noopener",
            ...{ class: "inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
    if (__VLS_ctx.author.instagram) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
            href: __VLS_ctx.author.instagram,
            target: "_blank",
            rel: "noopener",
            ...{ class: "inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-linear-to-br from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-medium transition-colors" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
    if (__VLS_ctx.author.youtube) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
            href: __VLS_ctx.author.youtube,
            target: "_blank",
            rel: "noopener",
            ...{ class: "inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
    if (__VLS_ctx.author.email) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
            href: (`mailto:${__VLS_ctx.author.email}`),
            ...{ class: "inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white font-medium transition-colors" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card p-6" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
        ...{ class: "text-lg font-semibold text-gray-900 dark:text-white mb-4" },
    });
    if (__VLS_ctx.author.description) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "mb-6 pb-6 border-b border-gray-200 dark:border-gray-700" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase font-semibold" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap" },
        });
        (__VLS_ctx.author.description);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "space-y-3 text-sm" },
    });
    if (__VLS_ctx.author.joined_date ?? __VLS_ctx.author.created_at) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex justify-between" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-gray-600 dark:text-gray-400" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "font-medium text-gray-900 dark:text-white" },
        });
        (new Date((__VLS_ctx.author.joined_date ?? __VLS_ctx.author.created_at ?? '')).toLocaleDateString());
    }
    if (__VLS_ctx.author.verified) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex justify-between" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-gray-600 dark:text-gray-400" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "font-medium text-green-600 dark:text-green-400" },
        });
    }
    if (__VLS_ctx.author.status) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex justify-between" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-gray-600 dark:text-gray-400" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "font-medium text-gray-900 dark:text-white" },
        });
        (__VLS_ctx.author.status);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalDirective(__VLS_directives.vShow)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.tab === 'books') }, null, null);
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
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "card p-12 text-center text-gray-400" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-5xl mb-3" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalDirective(__VLS_directives.vShow)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.tab === 'articles') }, null, null);
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
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "card p-12 text-center text-gray-400" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-5xl mb-3" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
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
/** @type {__VLS_StyleScopedClasses['max-w-4xl']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-brand-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-brand-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['h-40']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-linear-to-r']} */ ;
/** @type {__VLS_StyleScopedClasses['from-brand-500']} */ ;
/** @type {__VLS_StyleScopedClasses['to-brand-600']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:from-brand-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:to-brand-800']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-6']} */ ;
/** @type {__VLS_StyleScopedClasses['-mt-20']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:-mt-20']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-32']} */ ;
/** @type {__VLS_StyleScopedClasses['h-32']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['border-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-white']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:border-surface-900']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-surface-700']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['object-cover']} */ ;
/** @type {__VLS_StyleScopedClasses['w-32']} */ ;
/** @type {__VLS_StyleScopedClasses['h-32']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['border-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-white']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:border-surface-900']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-linear-to-br']} */ ;
/** @type {__VLS_StyleScopedClasses['from-brand-400']} */ ;
/** @type {__VLS_StyleScopedClasses['to-brand-600']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-5xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:pt-12']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:border-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-linear-to-br']} */ ;
/** @type {__VLS_StyleScopedClasses['from-pink-500']} */ ;
/** @type {__VLS_StyleScopedClasses['to-purple-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:from-pink-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:to-purple-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-red-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:border-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-600']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-green-400']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['content-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['p-12']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-5xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['p-12']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['text-5xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
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
            getAuthorImage: getAuthorImage,
            getStats: getStats,
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
