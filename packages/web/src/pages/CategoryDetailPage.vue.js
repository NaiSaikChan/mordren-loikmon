/// <reference types="../../node_modules/.vue-global-types/vue_3.5_0_0_0.d.ts" />
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCategoriesStore } from '@/stores/categories';
import BookCard from '@/components/shared/BookCard.vue';
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
const props = defineProps();
const { t } = useI18n();
const catStore = useCategoriesStore();
const books = ref([]);
const loading = ref(false);
const catName = ref('');
const page = ref(0);
async function loadBooks(reset = true) {
    loading.value = true;
    if (reset) {
        page.value = 0;
        books.value = [];
    }
    const newBooks = await catStore.fetchBooksByCategory(props.id, undefined, page.value);
    books.value = reset ? newBooks : [...books.value, ...newBooks];
    loading.value = false;
}
onMounted(async () => {
    await catStore.fetchCategories();
    const cat = catStore.list.find(c => String(c.id) === props.id);
    catName.value = cat?.name ?? 'Category';
    loadBooks();
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
    to: "/categories",
    ...{ class: "inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-500 mb-6" },
}));
const __VLS_2 = __VLS_1({
    to: "/categories",
    ...{ class: "inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-500 mb-6" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
var __VLS_3;
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
    ...{ class: "text-2xl font-bold text-gray-900 dark:text-white mb-6" },
});
(__VLS_ctx.catName);
if (__VLS_ctx.loading && !__VLS_ctx.books.length) {
    /** @type {[typeof LoadingSpinner, ]} */ ;
    // @ts-ignore
    const __VLS_4 = __VLS_asFunctionalComponent(LoadingSpinner, new LoadingSpinner({}));
    const __VLS_5 = __VLS_4({}, ...__VLS_functionalComponentArgsRest(__VLS_4));
}
else if (!__VLS_ctx.loading && !__VLS_ctx.books.length) {
    /** @type {[typeof EmptyState, ]} */ ;
    // @ts-ignore
    const __VLS_7 = __VLS_asFunctionalComponent(EmptyState, new EmptyState({
        icon: "📚",
        title: (__VLS_ctx.t('common.notFound')),
    }));
    const __VLS_8 = __VLS_7({
        icon: "📚",
        title: (__VLS_ctx.t('common.notFound')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_7));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "content-grid" },
    });
    for (const [book] of __VLS_getVForSourceType((__VLS_ctx.books))) {
        /** @type {[typeof BookCard, ]} */ ;
        // @ts-ignore
        const __VLS_10 = __VLS_asFunctionalComponent(BookCard, new BookCard({
            key: (book.id),
            book: (book),
        }));
        const __VLS_11 = __VLS_10({
            key: (book.id),
            book: (book),
        }, ...__VLS_functionalComponentArgsRest(__VLS_10));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mt-8 text-center" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.loading && !__VLS_ctx.books.length))
                    return;
                if (!!(!__VLS_ctx.loading && !__VLS_ctx.books.length))
                    return;
                __VLS_ctx.page++;
                __VLS_ctx.loadBooks(false);
            } },
        ...{ class: "btn-secondary" },
        disabled: (__VLS_ctx.loading),
    });
    (__VLS_ctx.loading ? __VLS_ctx.t('common.loading') : __VLS_ctx.t('common.more'));
}
/** @type {__VLS_StyleScopedClasses['page-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-brand-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-brand-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['content-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            BookCard: BookCard,
            LoadingSpinner: LoadingSpinner,
            EmptyState: EmptyState,
            t: t,
            books: books,
            loading: loading,
            catName: catName,
            page: page,
            loadBooks: loadBooks,
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
