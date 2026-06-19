import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import { articles as articlesApi } from '@loikmon/api';
export const useArticlesStore = defineStore('articles', () => {
    const list = ref([]);
    const detail = shallowRef(null);
    const loading = ref(false);
    const page = ref(1);
    const hasMore = ref(true);
    async function fetchArticles(params, reset = false) {
        if (reset) {
            list.value = [];
            page.value = 1;
            hasMore.value = true;
        }
        if (!hasMore.value)
            return;
        loading.value = true;
        try {
            const res = await articlesApi.fetchArticles({ page: page.value, ...params });
            const incoming = res.data.data?.articles ?? [];
            list.value = reset ? incoming : [...list.value, ...incoming];
            if (incoming.length === 0)
                hasMore.value = false;
            else
                page.value++;
        }
        finally {
            loading.value = false;
        }
    }
    return { list, detail, loading, hasMore, fetchArticles };
});
