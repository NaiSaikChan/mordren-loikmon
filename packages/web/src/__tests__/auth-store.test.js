/**
 * Auth store — unit tests
 * All external API calls are mocked via vi.mock so no real HTTP is made.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
// ── Mock @loikmon/api auth module ─────────────────────────────────────────────
const mockLogin = vi.fn();
const mockRegister = vi.fn();
const mockUpdateProfile = vi.fn();
vi.mock('@loikmon/api', () => ({
    auth: {
        login: (...args) => mockLogin(...args),
        register: (...args) => mockRegister(...args),
        updateProfile: (...args) => mockUpdateProfile(...args),
    },
}));
import { useAuthStore } from '../stores/auth';
// ── Helper: a realistic server login response ─────────────────────────────────
function makeLoginResponse(overrides = {}) {
    return {
        data: {
            status: 'ok',
            message: 'User Authenticated',
            user: {
                id: '196',
                seller: '0',
                author: '0',
                email: 'maraohnonpon@gmail.com',
                username: '',
                firstname: '',
                lastname: '',
                thumbnail: '',
                coins: '0',
                ...overrides,
            },
            isadminuser: '0',
            statuscode: 0,
        },
    };
}
describe('auth store', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        localStorage.clear();
        vi.clearAllMocks();
    });
    // ── Initial state ──────────────────────────────────────────────────────────
    describe('initial state', () => {
        it('user is null before login', () => {
            const store = useAuthStore();
            expect(store.user).toBeNull();
        });
        it('isLoggedIn is false before login', () => {
            const store = useAuthStore();
            expect(store.isLoggedIn).toBe(false);
        });
        it('loading starts false', () => {
            const store = useAuthStore();
            expect(store.loading).toBe(false);
        });
        it('error starts null', () => {
            const store = useAuthStore();
            expect(store.error).toBeNull();
        });
    });
    // ── normaliseUser ──────────────────────────────────────────────────────────
    describe('normaliseUser (via login)', () => {
        it('derives name from firstname + lastname', async () => {
            mockLogin.mockResolvedValueOnce(makeLoginResponse({ firstname: 'Nai', lastname: 'Chan' }));
            const store = useAuthStore();
            await store.login({ email: 'test@test.com', password: 'pass' });
            expect(store.user.name).toBe('Nai Chan');
        });
        it('falls back to username when no firstname/lastname', async () => {
            mockLogin.mockResolvedValueOnce(makeLoginResponse({ username: 'naichan', firstname: '', lastname: '' }));
            const store = useAuthStore();
            await store.login({ email: 'test@test.com', password: 'pass' });
            expect(store.user.name).toBe('naichan');
        });
        it('falls back to email prefix when username also empty', async () => {
            mockLogin.mockResolvedValueOnce(makeLoginResponse({ username: '', firstname: '', lastname: '' }));
            const store = useAuthStore();
            await store.login({ email: 'maraohnonpon@gmail.com', password: 'pass' });
            expect(store.user.name).toBe('maraohnonpon');
        });
        it('maps thumbnail → avatar', async () => {
            mockLogin.mockResolvedValueOnce(makeLoginResponse({ thumbnail: '/uploads/avatar.jpg' }));
            const store = useAuthStore();
            await store.login({ email: 'test@test.com', password: 'pass' });
            expect(store.user.avatar).toBe('/uploads/avatar.jpg');
        });
        it('converts coins string → number', async () => {
            mockLogin.mockResolvedValueOnce(makeLoginResponse({ coins: '150' }));
            const store = useAuthStore();
            await store.login({ email: 'test@test.com', password: 'pass' });
            expect(store.coinBalance).toBe(150);
        });
        it('coinBalance is 0 when coins is "0"', async () => {
            mockLogin.mockResolvedValueOnce(makeLoginResponse({ coins: '0' }));
            const store = useAuthStore();
            await store.login({ email: 'test@test.com', password: 'pass' });
            expect(store.coinBalance).toBe(0);
        });
    });
    // ── login() ────────────────────────────────────────────────────────────────
    describe('login()', () => {
        it('sets user and token on status:ok', async () => {
            mockLogin.mockResolvedValueOnce(makeLoginResponse());
            const store = useAuthStore();
            await store.login({ email: 'maraohnonpon@gmail.com', password: 'pass' });
            expect(store.user).not.toBeNull();
            expect(store.token).toBe('user_196'); // generated from id when no JWT
            expect(store.isLoggedIn).toBe(true);
        });
        it('persists token + user to localStorage', async () => {
            mockLogin.mockResolvedValueOnce(makeLoginResponse());
            const store = useAuthStore();
            await store.login({ email: 'test@test.com', password: 'pass' });
            expect(localStorage.getItem('token')).toBe('user_196');
            expect(JSON.parse(localStorage.getItem('user')).email).toBe('maraohnonpon@gmail.com');
        });
        it('uses server-provided token when present', async () => {
            const response = makeLoginResponse();
            response.data = { ...response.data, token: 'jwt-abc123' };
            mockLogin.mockResolvedValueOnce(response);
            const store = useAuthStore();
            await store.login({ email: 'test@test.com', password: 'pass' });
            expect(store.token).toBe('jwt-abc123');
        });
        it('sets error and throws on status:error', async () => {
            mockLogin.mockResolvedValueOnce({ data: { status: 'error', message: 'Invalid credentials' } });
            const store = useAuthStore();
            await expect(store.login({ email: 'bad@bad.com', password: 'wrong' })).rejects.toBe('Invalid credentials');
            expect(store.error).toBe('Invalid credentials');
            expect(store.isLoggedIn).toBe(false);
        });
        it('sets error on missing user in response', async () => {
            mockLogin.mockResolvedValueOnce({ data: { status: 'ok', user: null } });
            const store = useAuthStore();
            await expect(store.login({ email: 'test@test.com', password: 'pass' })).rejects.toBeTruthy();
            expect(store.error).toBe('No user data received');
        });
        it('loading is false after successful login', async () => {
            mockLogin.mockResolvedValueOnce(makeLoginResponse());
            const store = useAuthStore();
            await store.login({ email: 'test@test.com', password: 'pass' });
            expect(store.loading).toBe(false);
        });
        it('loading is false after failed login', async () => {
            mockLogin.mockResolvedValueOnce({ data: { status: 'error', message: 'Bad creds' } });
            const store = useAuthStore();
            await store.login({ email: 'x@x.com', password: 'x' }).catch(() => { });
            expect(store.loading).toBe(false);
        });
    });
    // ── logout() ───────────────────────────────────────────────────────────────
    describe('logout()', () => {
        it('clears user, token, localStorage', async () => {
            mockLogin.mockResolvedValueOnce(makeLoginResponse());
            const store = useAuthStore();
            await store.login({ email: 'test@test.com', password: 'pass' });
            await store.logout();
            expect(store.user).toBeNull();
            expect(store.token).toBeNull();
            expect(store.isLoggedIn).toBe(false);
            expect(localStorage.getItem('token')).toBeNull();
            expect(localStorage.getItem('user')).toBeNull();
        });
    });
    // ── restore() ─────────────────────────────────────────────────────────────
    describe('restore()', () => {
        it('restores token + user from localStorage', () => {
            const savedUser = { id: '10', name: 'Test', email: 'test@test.com', avatar: '', coins: 0 };
            localStorage.setItem('token', 'user_10');
            localStorage.setItem('user', JSON.stringify(savedUser));
            const store = useAuthStore();
            store.restore();
            expect(store.token).toBe('user_10');
            expect(store.user.email).toBe('test@test.com');
            expect(store.isLoggedIn).toBe(true);
        });
        it('handles corrupt user JSON gracefully', () => {
            localStorage.setItem('token', 'user_99');
            localStorage.setItem('user', 'NOT_VALID_JSON{{{');
            const store = useAuthStore();
            expect(() => store.restore()).not.toThrow();
            expect(store.token).toBe('user_99');
            expect(store.user).toBeNull();
        });
        it('does nothing when localStorage is empty', () => {
            const store = useAuthStore();
            store.restore();
            expect(store.user).toBeNull();
            expect(store.token).toBeNull();
        });
    });
    // ── register() ────────────────────────────────────────────────────────────
    describe('register()', () => {
        it('sets user on successful register', async () => {
            mockRegister.mockResolvedValueOnce(makeLoginResponse({ id: '200', email: 'new@test.com' }));
            const store = useAuthStore();
            await store.register({ name: 'New User', email: 'new@test.com', password: 'pass', password_confirmation: 'pass' });
            expect(store.user).not.toBeNull();
        });
        it('does not set user when no user in response (email verification pending)', async () => {
            mockRegister.mockResolvedValueOnce({ data: { status: 'ok', message: 'Verify email' } });
            const store = useAuthStore();
            await store.register({ name: 'Test', email: 'x@x.com', password: 'pass', password_confirmation: 'pass' });
            expect(store.user).toBeNull();
        });
        it('throws on status:error', async () => {
            mockRegister.mockResolvedValueOnce({ data: { status: 'error', message: 'Email taken' } });
            const store = useAuthStore();
            await expect(store.register({ name: 'T', email: 'x@x.com', password: 'p', password_confirmation: 'p' }))
                .rejects.toBe('Email taken');
        });
    });
    // ── computed: displayName / avatar ─────────────────────────────────────────
    describe('computed values', () => {
        it('displayName returns empty string when logged out', () => {
            const store = useAuthStore();
            expect(store.displayName).toBe('');
        });
        it('avatar returns empty string when no user', () => {
            const store = useAuthStore();
            expect(store.avatar).toBe('');
        });
        it('coinBalance returns 0 when no user', () => {
            const store = useAuthStore();
            expect(store.coinBalance).toBe(0);
        });
    });
});
