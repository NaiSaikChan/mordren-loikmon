import { defineStore } from 'pinia';
import { ref } from 'vue';
import { misc } from '@loikmon/api';
export const useCollectionsStore = defineStore('collections', () => {
    const list = ref([]);
    const detail = ref(null);
    const loading = ref(false);
    async function fetchCollections(page = 0) {
        loading.value = true;
        try {
            const res = await misc.fetchCollections(page);
            const body = res.data;
            list.value = body.collections ?? body.data?.collections ?? [];
        }
        finally {
            loading.value = false;
        }
    }
    async function fetchDetail(id) {
        loading.value = true;
        try {
            const res = await misc.fetchSingleCollection(id);
            const body = res.data;
            detail.value = body.collection ?? body.data?.collection ?? null;
        }
        finally {
            loading.value = false;
        }
    }
    return { list, detail, loading, fetchCollections, fetchDetail };
});
