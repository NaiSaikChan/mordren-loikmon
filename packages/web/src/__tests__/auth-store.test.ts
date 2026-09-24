/**
 * Auth store — login / register / session restore / logout against the new
 * `/api/v1/auth` endpoints (mocked).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { activeEntitlement, apiError, inactiveEntitlement, makeUser, response } from './helpers'

const mockLogin    = vi.fn()
const mockRegister = vi.fn()
const mockLogout   = vi.fn()
const mockMe       = vi.fn()
const mockDelete   = vi.fn()
const mockChangePassword = vi.fn()

vi.mock('@loikmon/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@loikmon/api')>()
  return {
    ...actual,
    auth: {
      login: (...a: unknown[]) => mockLogin(...a),
      register: (...a: unknown[]) => mockRegister(...a),
      logout: (...a: unknown[]) => mockLogout(...a),
      me: (...a: unknown[]) => mockMe(...a),
      deleteAccount: (...a: unknown[]) => mockDelete(...a),
      changePassword: (...a: unknown[]) => mockChangePassword(...a),
    },
  }
})

import { useAuthStore } from '../stores/auth'

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('is signed out without a stored token', () => {
      const store = useAuthStore()
      expect(store.user).toBeNull()
      expect(store.token).toBeNull()
      expect(store.isLoggedIn).toBe(false)
      expect(store.isSubscribed).toBe(false)
      expect(store.restored).toBe(true)
    })

    it('ignores fake `local:` tokens from the legacy client', () => {
      localStorage.setItem('token', 'local:196')
      const store = useAuthStore()
      expect(store.token).toBeNull()
    })
  })

  describe('login()', () => {
    it('stores the bearer token, user and entitlement', async () => {
      mockLogin.mockReturnValueOnce(response({ status: 'ok', token: 'tok-1', user: makeUser(), entitlement: activeEntitlement() }))
      const store = useAuthStore()

      await store.login({ email: 'reader@loikmon.org', password: 'secret123' })

      expect(mockLogin).toHaveBeenCalledWith({ email: 'reader@loikmon.org', password: 'secret123' })
      expect(store.token).toBe('tok-1')
      expect(store.user?.email).toBe('reader@loikmon.org')
      expect(store.isLoggedIn).toBe(true)
      expect(store.isSubscribed).toBe(true)
      expect(localStorage.getItem('token')).toBe('tok-1')
      // The user object is no longer cached in localStorage.
      expect(localStorage.getItem('user')).toBeNull()
    })

    it('sets the error message and rethrows the ApiError on failure', async () => {
      mockLogin.mockRejectedValueOnce(apiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password'))
      const store = useAuthStore()

      await expect(store.login({ email: 'x@x.com', password: 'wrong' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
      expect(store.error).toBe('Invalid email or password')
      expect(store.isLoggedIn).toBe(false)
      expect(store.loading).toBe(false)
      expect(localStorage.getItem('token')).toBeNull()
    })
  })

  describe('register()', () => {
    it('signs in when the server returns a token', async () => {
      mockRegister.mockReturnValueOnce(response({ status: 'ok', token: 'tok-new', user: makeUser(), entitlement: inactiveEntitlement, requires_email_verification: false }))
      const store = useAuthStore()

      const result = await store.register({ name: 'Nai', email: 'new@loikmon.org', password: 'secret123' })

      expect(result.requiresEmailVerification).toBe(false)
      expect(store.token).toBe('tok-new')
      expect(store.isSubscribed).toBe(false)
    })

    it('does not sign in when email verification is required', async () => {
      mockRegister.mockReturnValueOnce(response({ status: 'ok', token: null, user: makeUser(), entitlement: inactiveEntitlement, requires_email_verification: true }))
      const store = useAuthStore()

      const result = await store.register({ email: 'new@loikmon.org', password: 'secret123' })

      expect(result.requiresEmailVerification).toBe(true)
      expect(store.token).toBeNull()
      expect(store.isLoggedIn).toBe(false)
    })

    it('rethrows EMAIL_TAKEN', async () => {
      mockRegister.mockRejectedValueOnce(apiError(409, 'EMAIL_TAKEN', 'An account with this email already exists'))
      const store = useAuthStore()
      await expect(store.register({ email: 'x@x.com', password: 'secret123' })).rejects.toMatchObject({ code: 'EMAIL_TAKEN' })
      expect(store.error).toBe('An account with this email already exists')
    })
  })

  describe('restore()', () => {
    it('validates the stored token with auth.me()', async () => {
      localStorage.setItem('token', 'tok-stored')
      mockMe.mockReturnValueOnce(response({ status: 'ok', user: makeUser(), entitlement: activeEntitlement() }))
      const store = useAuthStore()
      expect(store.restored).toBe(false)

      await store.restore()

      expect(mockMe).toHaveBeenCalledTimes(1)
      expect(store.isLoggedIn).toBe(true)
      expect(store.isSubscribed).toBe(true)
      expect(store.restored).toBe(true)
    })

    it('clears the session when the token was rejected (401)', async () => {
      localStorage.setItem('token', 'tok-expired')
      mockMe.mockRejectedValueOnce(apiError(401, 'UNAUTHORIZED'))
      const store = useAuthStore()

      await store.restore()

      expect(store.token).toBeNull()
      expect(store.user).toBeNull()
      expect(localStorage.getItem('token')).toBeNull()
    })

    it('keeps the token on network errors so a later refresh can recover', async () => {
      localStorage.setItem('token', 'tok-offline')
      mockMe.mockRejectedValueOnce(apiError(0, 'NETWORK_ERROR', 'Cannot reach the server'))
      const store = useAuthStore()

      await store.restore()

      expect(store.token).toBe('tok-offline')
      expect(store.isLoggedIn).toBe(false)
      expect(store.restored).toBe(true)
    })

    it('does not call the API without a token and removes the legacy cached user', async () => {
      localStorage.setItem('user', JSON.stringify({ id: '196', name: 'legacy' }))
      const store = useAuthStore()
      await store.restore()
      expect(mockMe).not.toHaveBeenCalled()
      expect(localStorage.getItem('user')).toBeNull()
    })

    it('shares one request between concurrent callers (route guard + main.ts)', async () => {
      localStorage.setItem('token', 'tok-stored')
      mockMe.mockReturnValueOnce(response({ status: 'ok', user: makeUser(), entitlement: inactiveEntitlement }))
      const store = useAuthStore()
      await Promise.all([store.restore(), store.ensureRestored()])
      expect(mockMe).toHaveBeenCalledTimes(1)
    })
  })

  describe('logout()', () => {
    it('revokes the server session and clears local state', async () => {
      mockLogin.mockReturnValueOnce(response({ status: 'ok', token: 'tok-1', user: makeUser(), entitlement: activeEntitlement() }))
      mockLogout.mockReturnValueOnce(response({ status: 'ok' }))
      const store = useAuthStore()
      await store.login({ email: 'reader@loikmon.org', password: 'secret123' })

      await store.logout()

      expect(mockLogout).toHaveBeenCalledTimes(1)
      expect(store.token).toBeNull()
      expect(store.entitlement).toBeNull()
      expect(localStorage.getItem('token')).toBeNull()
    })

    it('still clears the session when the server call fails', async () => {
      localStorage.setItem('token', 'tok-1')
      mockLogout.mockRejectedValueOnce(apiError(0, 'NETWORK_ERROR'))
      const store = useAuthStore()
      await store.logout()
      expect(store.token).toBeNull()
    })
  })

  describe('account actions', () => {
    it('changePassword() swaps in the fresh token', async () => {
      mockLogin.mockReturnValueOnce(response({ status: 'ok', token: 'tok-old', user: makeUser(), entitlement: inactiveEntitlement }))
      mockChangePassword.mockReturnValueOnce(response({ status: 'ok', token: 'tok-rotated' }))
      const store = useAuthStore()
      await store.login({ email: 'reader@loikmon.org', password: 'secret123' })

      await store.changePassword('secret123', 'newsecret456')

      expect(mockChangePassword).toHaveBeenCalledWith('secret123', 'newsecret456', true)
      expect(store.token).toBe('tok-rotated')
      expect(localStorage.getItem('token')).toBe('tok-rotated')
    })

    it('deleteAccount() signs out and reports a still-renewing store subscription', async () => {
      localStorage.setItem('token', 'tok-1')
      mockDelete.mockReturnValueOnce(response({ status: 'ok', manage_store_subscription: 'app_store' }))
      const store = useAuthStore()

      const store_ = await store.deleteAccount('secret123')

      expect(mockDelete).toHaveBeenCalledWith('secret123')
      expect(store_).toBe('app_store')
      expect(store.token).toBeNull()
    })
  })
})
