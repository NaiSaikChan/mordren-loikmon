import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { auth as authApi } from '@loikmon/api';
// ── Helpers ───────────────────────────────────────────────────────────────────
/** Normalise the raw server user object into a consistent User shape */
function normaliseUser(raw) {
    const first = raw.firstname ?? '';
    const last = raw.lastname ?? '';
    const full = [first, last].filter(Boolean).join(' ').trim();
    return {
        ...raw,
        // computed display name: full name → username → email prefix
        name: full || raw.username || (raw.email?.split('@')[0] ?? 'User'),
        // avatar: thumbnail field is what the server actually sends
        avatar: raw.thumbnail || raw.avatar || '',
        coins: raw.coins ? Number(raw.coins) : 0,
    };
}
/** Session key stored in localStorage (server has no token — use user id) */
function makeSessionKey(user) {
    return `user_${user.id}`;
}
// ── Store ─────────────────────────────────────────────────────────────────────
export const useAuthStore = defineStore('auth', () => {
    // ── State ─────────────────────────────────────────
    const user = ref(null);
    const token = ref(localStorage.getItem('token'));
    const loading = ref(false);
    const error = ref(null);
    // ── Getters ───────────────────────────────────────
    const isLoggedIn = computed(() => !!token.value && !!user.value);
    const displayName = computed(() => user.value?.name ?? '');
    const avatar = computed(() => user.value?.avatar ?? user.value?.thumbnail ?? '');
    const coinBalance = computed(() => Number(user.value?.coins ?? 0));
    // ── Actions ───────────────────────────────────────
    async function login(payload) {
        loading.value = true;
        error.value = null;
        try {
            const res = await authApi.login(payload);
            const body = res.data;
            // Server returns status:'ok' on success, 'error' on failure
            if (body.status === 'error' || body.status === 'fail') {
                error.value = body.message ?? 'Login failed';
                throw error.value;
            }
            if (!body.user) {
                error.value = 'No user data received';
                throw error.value;
            }
            const normUser = normaliseUser(body.user);
            user.value = normUser;
            // Server doesn't issue a JWT — create a local session token from user id
            const sessionToken = body.token ?? makeSessionKey(body.user);
            token.value = sessionToken;
            // Persist session
            localStorage.setItem('token', sessionToken);
            localStorage.setItem('user', JSON.stringify(normUser));
        }
        catch (err) {
            if (typeof err === 'string')
                throw err;
            const e = err;
            error.value = e.response?.data?.message ?? e.message ?? 'Login failed';
            throw error.value;
        }
        finally {
            loading.value = false;
        }
    }
    async function register(payload) {
        loading.value = true;
        error.value = null;
        try {
            const res = await authApi.register(payload);
            const body = res.data;
            if (body.status === 'error' || body.status === 'fail') {
                error.value = body.message ?? 'Registration failed';
                throw error.value;
            }
            if (body.user) {
                const normUser = normaliseUser(body.user);
                user.value = normUser;
                const sessionToken = body.token ?? makeSessionKey(body.user);
                token.value = sessionToken;
                localStorage.setItem('token', sessionToken);
                localStorage.setItem('user', JSON.stringify(normUser));
            }
        }
        catch (err) {
            if (typeof err === 'string')
                throw err;
            const e = err;
            error.value = e.response?.data?.message ?? e.message ?? 'Registration failed';
            throw error.value;
        }
        finally {
            loading.value = false;
        }
    }
    async function logout() {
        token.value = null;
        user.value = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
    async function updateProfile(data) {
        loading.value = true;
        try {
            const res = await authApi.updateProfile(data);
            const body = res.data;
            if (body.status !== 'error' && body.user) {
                user.value = normaliseUser(body.user);
                localStorage.setItem('user', JSON.stringify(user.value));
            }
        }
        finally {
            loading.value = false;
        }
    }
    /** Restore session persisted from previous page load */
    function restore() {
        const savedToken = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');
        if (savedToken)
            token.value = savedToken;
        if (savedUser) {
            try {
                user.value = JSON.parse(savedUser);
            }
            catch { /* corrupt storage — ignore */ }
        }
    }
    return {
        user, token, loading, error,
        isLoggedIn, displayName, avatar, coinBalance,
        login, register, logout, updateProfile, restore,
    };
});
