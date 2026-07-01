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
            // Handle both direct array and nested response formats
            const authors = body.authors ?? body.data?.authors ?? (Array.isArray(body) ? body : []);
            // Append on pagination (if page > 0), otherwise replace
            if (params?.page && params.page !== '0') {
                list.value = [...list.value, ...authors];
            }
            else {
                list.value = authors;
            }
        }
        finally {
            loading.value = false;
        }
    }
    async function fetchDetail(id, email) {
        loading.value = true;
        try {
            const res = await authorsApi.getAuthor(id, email);
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
