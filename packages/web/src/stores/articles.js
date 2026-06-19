import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import { articles as articlesApi } from '@loikmon/api';
export const useArticlesStore = defineStore('articles', () => {
    const list = ref([]);
    const detail = shallowRef(null);
    const loading = ref(false);
    async function fetchArticles(params) {
        loading.value = true;
        try {
            const res = await articlesApi.fetchArticles(params);
            const body = res.data;
            list.value = body.articles ?? body.data?.articles ?? (Array.isArray(body) ? body : []);
        }
        finally {
            loading.value = false;
        }
    }
    function setDetail(article) {
        detail.value = article;
    }
    return { list, detail, loading, fetchArticles, setDetail };
});
