import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import { books as booksApi } from '@loikmon/api';
export const useBooksStore = defineStore('books', () => {
    const list = ref([]);
    const detail = shallowRef(null);
    const chapters = ref([]);
    const related = ref([]);
    const loading = ref(false);
    async function fetchBooks(params) {
        loading.value = true;
        try {
            const res = await booksApi.fetchBooks(params);
            // API returns top-level array directly in many cases, or {books:[...]}
            const body = res.data;
            list.value = body.books ?? (Array.isArray(body) ? body : []);
        }
        finally {
            loading.value = false;
        }
    }
    async function fetchDetail(id) {
        loading.value = true;
        try {
            const res = await booksApi.getItem(id);
            const body = res.data;
            detail.value = body.book ?? body.data?.book ?? null;
        }
        finally {
            loading.value = false;
        }
    }
    async function fetchChapters(bookId) {
        const res = await booksApi.getChapters(bookId);
        const body = res.data;
        chapters.value = body.chapters ?? body.data?.chapters ?? [];
    }
    async function fetchRelated(bookId) {
        const res = await booksApi.relatedBooks(bookId);
        const body = res.data;
        related.value = body.books ?? body.data?.books ?? [];
    }
    async function rateBook(bookId, rating) {
        await booksApi.rateBook(bookId, rating);
    }
    return { list, detail, chapters, related, loading, fetchBooks, fetchDetail, fetchChapters, fetchRelated, rateBook };
});
