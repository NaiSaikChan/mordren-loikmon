import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import { authors as authorsApi } from '@loikmon/api';
export const useAuthorsStore = defineStore('authors', () => {
    const list = ref([]);
    const detail = shallowRef(null);
    const loading = ref(false);
    async function fetchAuthors(params) {
        loading.value = true;
        try {
            const res = await authorsApi.fetchAuthors(params);
            const body = res.data;
            list.value = body.authors ?? body.data?.authors ?? (Array.isArray(body) ? body : []);
        }
        finally {
            loading.value = false;
        }
    }
    async function fetchDetail(id) {
        loading.value = true;
        try {
            const res = await authorsApi.getAuthor(id);
            const body = res.data;
            detail.value = body.author ?? body.data?.author ?? null;
        }
        finally {
            loading.value = false;
        }
    }
    async function toggleFollow(id) {
        const res = await authorsApi.followUnfollow(id);
        const body = res.data;
        if (detail.value && detail.value.id === id) {
            detail.value = { ...detail.value, is_following: body.is_following ?? body.data?.is_following };
        }
    }
    return { list, detail, loading, fetchAuthors, fetchDetail, toggleFollow };
});
