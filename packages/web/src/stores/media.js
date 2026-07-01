import { defineStore } from 'pinia';
import { ref } from 'vue';
import { media as mediaApi, misc } from '@loikmon/api';
export const useMediaStore = defineStore('media', () => {
    const leagues = ref([]);
    const books = ref([]);
    const loading = ref(false);
    const page = ref(0);
    async function fetchLeagues() {
        loading.value = true;
        try {
            const res = await misc.fetchLeagues();
            leagues.value = res.data.leagues ?? [];
        }
        finally {
            loading.value = false;
        }
    }
    async function fetchMediaBooks(email, nextPage = false) {
        loading.value = true;
        if (nextPage)
            page.value++;
        else {
            page.value = 0;
            books.value = [];
        }
        try {
            const res = await mediaApi.fetchMediaBooks(page.value, email);
            const body = res.data;
            const newBooks = body.books ?? [];
            books.value = nextPage ? [...books.value, ...newBooks] : newBooks;
        }
        finally {
            loading.value = false;
        }
    }
    return { leagues, books, loading, page, fetchLeagues, fetchMediaBooks };
});
