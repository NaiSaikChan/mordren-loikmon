/**
 * Authors store — unit tests
 * Covers fetchAuthors pagination append, fetchDetail, toggleFollow.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
const mockFetchAuthors = vi.fn();
const mockGetAuthor = vi.fn();
const mockFollowUnfollow = vi.fn();
vi.mock('@loikmon/api', () => ({
    authors: {
        fetchAuthors: (...a) => mockFetchAuthors(...a),
        getAuthor: (...a) => mockGetAuthor(...a),
        followUnfollow: (...a) => mockFollowUnfollow(...a),
    }
}));
import { useAuthorsStore } from '../stores/authors';
const makeAuthor = (id) => ({ id, name: `Author ${id}`, thumbnail: '', bookscount: id, articlescount: 0 });
describe('authors store', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });
    it('initial state is empty', () => {
        const store = useAuthorsStore();
        expect(store.list).toEqual([]);
        expect(store.detail).toBeNull();
        expect(store.loading).toBe(false);
    });
    describe('fetchAuthors()', () => {
        it('populates list from body.authors', async () => {
            mockFetchAuthors.mockResolvedValue({ data: { authors: [makeAuthor(1), makeAuthor(2)] } });
            const store = useAuthorsStore();
            await store.fetchAuthors();
            expect(store.list).toHaveLength(2);
            expect(store.list[0].name).toBe('Author 1');
        });
        it('replaces list on page 0 (first load)', async () => {
            mockFetchAuthors.mockResolvedValue({ data: { authors: [makeAuthor(1)] } });
            const store = useAuthorsStore();
            store.list = [makeAuthor(99)];
            await store.fetchAuthors({ page: '0' });
            expect(store.list).toHaveLength(1);
            expect(store.list[0].id).toBe(1);
        });
        it('appends list on page > 0 (pagination)', async () => {
            mockFetchAuthors.mockResolvedValue({ data: { authors: [makeAuthor(3), makeAuthor(4)] } });
            const store = useAuthorsStore();
            store.list = [makeAuthor(1), makeAuthor(2)];
            await store.fetchAuthors({ page: '1' });
            expect(store.list).toHaveLength(4);
            expect(store.list[2].id).toBe(3);
        });
        it('handles array response directly', async () => {
            mockFetchAuthors.mockResolvedValue({ data: [makeAuthor(5)] });
            const store = useAuthorsStore();
            await store.fetchAuthors();
            expect(store.list).toHaveLength(1);
        });
        it('sets loading false after success', async () => {
            mockFetchAuthors.mockResolvedValue({ data: { authors: [] } });
            const store = useAuthorsStore();
            await store.fetchAuthors();
            expect(store.loading).toBe(false);
        });
        it('sets loading false after error', async () => {
            mockFetchAuthors.mockRejectedValue(new Error('network'));
            const store = useAuthorsStore();
            await store.fetchAuthors().catch(() => { });
            expect(store.loading).toBe(false);
        });
    });
    describe('fetchDetail()', () => {
        it('sets detail from body.author', async () => {
            const a = makeAuthor(7);
            mockGetAuthor.mockResolvedValue({ data: { author: a } });
            const store = useAuthorsStore();
            await store.fetchDetail(7);
            expect(store.detail?.id).toBe(7);
        });
        it('accepts body.data.author nested path', async () => {
            const a = makeAuthor(8);
            mockGetAuthor.mockResolvedValue({ data: { data: { author: a } } });
            const store = useAuthorsStore();
            await store.fetchDetail(8);
            expect(store.detail?.id).toBe(8);
        });
        it('sets detail null when author missing', async () => {
            mockGetAuthor.mockResolvedValue({ data: {} });
            const store = useAuthorsStore();
            await store.fetchDetail(99);
            expect(store.detail).toBeNull();
        });
        it('passes email to API when provided', async () => {
            mockGetAuthor.mockResolvedValue({ data: { author: makeAuthor(1) } });
            const store = useAuthorsStore();
            await store.fetchDetail(1, 'user@test.com');
            expect(mockGetAuthor).toHaveBeenCalledWith(1, 'user@test.com');
        });
    });
    describe('toggleFollow()', () => {
        it('updates detail.is_following on match', async () => {
            mockFollowUnfollow.mockResolvedValue({ data: { is_following: true } });
            const store = useAuthorsStore();
            store.detail = { ...makeAuthor(5), is_following: false };
            await store.toggleFollow(5);
            expect(store.detail?.is_following).toBe(true);
        });
        it('does not update detail when id does not match', async () => {
            mockFollowUnfollow.mockResolvedValue({ data: { is_following: true } });
            const store = useAuthorsStore();
            store.detail = { ...makeAuthor(5), is_following: false };
            await store.toggleFollow(99);
            expect(store.detail?.is_following).toBe(false);
        });
    });
});
