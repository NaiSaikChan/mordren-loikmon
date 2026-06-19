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
            list.value = res.data.data?.authors ?? [];
        }
        finally {
            loading.value = false;
        }
    }
    async function fetchDetail(id) {
        loading.value = true;
        try {
            const res = await authorsApi.getAuthor(id);
            detail.value = res.data.data?.author ?? null;
        }
        finally {
            loading.value = false;
        }
    }
    async function toggleFollow(id) {
        const res = await authorsApi.followUnfollow(id);
        if (detail.value && detail.value.id === id) {
            detail.value = { ...detail.value, is_following: res.data.data?.is_following };
        }
    }
    return { list, detail, loading, fetchAuthors, fetchDetail, toggleFollow };
});
