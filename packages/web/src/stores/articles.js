import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import { articles as articlesApi } from '@loikmon/api';
export const useArticlesStore = defineStore('articles', () => {
    const list = ref([]);
    const detail = shallowRef(null); // ← was undefined, must be null
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
    async function fetchDetail(id) {
        loading.value = true;
        try {
            // 1. Check list cache first — avoids an extra API round-trip
            const cached = list.value.find(a => String(a.id) === String(id));
            if (cached) {
                detail.value = cached;
                return;
            }
            // 2. Call getarticle endpoint
            try {
                const res = await articlesApi.getArticle(id);
                const body = res.data;
                const found = body.article ?? body.data?.article ?? null;
                if (found && found.id) {
                    detail.value = found;
                    return;
                }
            }
            catch { /* fallthrough to bulk fetch */ }
            // 3. Last resort: fetch all articles and find by id
            const res = await articlesApi.fetchArticles();
            const body = res.data;
            list.value = body.articles ?? [];
            detail.value = list.value.find(a => String(a.id) === String(id)) ?? null;
        }
        finally {
            loading.value = false;
        }
    }
    function setDetail(article) {
        detail.value = article;
    }
    return { list, detail, loading, fetchArticles, fetchDetail, setDetail };
});
