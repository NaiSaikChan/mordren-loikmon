import { vi } from 'vitest';
// Stub localStorage globally for all tests
const _store = {};
const localStorageMock = {
    getItem: (k) => _store[k] ?? null,
    setItem: (k, v) => { _store[k] = v; },
    removeItem: (k) => { delete _store[k]; },
    clear: () => { Object.keys(_store).forEach(k => delete _store[k]); },
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
// Stub window.matchMedia (jsdom doesn't implement it)
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
        matches: false, media: query,
        onchange: null,
        addListener: vi.fn(), removeListener: vi.fn(),
        addEventListener: vi.fn(), removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});
