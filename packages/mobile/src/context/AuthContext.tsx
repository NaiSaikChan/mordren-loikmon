import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { auth as authApi, errorCode, errorMessage, isApiError } from '@loikmon/api'
import type { AuthResponse, Entitlement, LoginPayload, RegisterPayload, User } from '@loikmon/api'
import { normaliseUser } from '@/lib/user'
import { secureStorage } from '@/services/storage'
import { getSessionToken, isSessionRejected, setSessionToken, setUnauthorizedHandler } from '@/services/api'

const USER_KEY = 'user'

export type StoreName = 'app_store' | 'google_play'

interface AuthContextValue {
  user: User | null
  token: string | null
  /** Server-computed access to premium content (null when signed out). */
  entitlement: Entitlement | null
  /** True while the stored session is being restored at start-up. */
  initializing: boolean
  /** True while a login/register/profile action is running. */
  loading: boolean
  error: string | null
  isLoggedIn: boolean
  login: (payload: LoginPayload) => Promise<void>
  /** Resolves with `requiresEmailVerification` when the account must be verified before signing in. */
  register: (payload: RegisterPayload) => Promise<{ requiresEmailVerification: boolean }>
  logout: () => Promise<void>
  forgotPassword: (email: string) => Promise<string>
  resendVerification: (email: string) => Promise<void>
  updateProfile: (data: Partial<Pick<User, 'name' | 'firstname' | 'lastname' | 'phone'>>) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  /** Deletes the account; resolves with the store whose subscription must still be cancelled there. */
  deleteAccount: (password: string) => Promise<{ manageStoreSubscription: StoreName | null }>
  /** Re-reads the user + entitlement from the backend. */
  refreshSession: () => Promise<void>
  setEntitlement: (entitlement: Entitlement | null) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tokenRef = useRef<string | null>(null)

  const clearSession = useCallback(async () => {
    tokenRef.current = null
    setUser(null)
    setToken(null)
    setEntitlement(null)
    await Promise.all([setSessionToken(null), secureStorage.remove(USER_KEY)])
  }, [])

  const applySession = useCallback(async (nextToken: string, rawUser: User, nextEntitlement: Entitlement | null) => {
    const normalised = normaliseUser(rawUser)
    tokenRef.current = nextToken
    setToken(nextToken)
    setUser(normalised)
    setEntitlement(nextEntitlement)
    await Promise.all([setSessionToken(nextToken), secureStorage.set(USER_KEY, JSON.stringify(normalised))])
  }, [])

  // Restore the stored session: validate the token with `auth.me()`.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const stored = await getSessionToken() // drops legacy `local:` tokens
        if (!stored) {
          await secureStorage.remove(USER_KEY)
          await setSessionToken(null)
          return
        }
        tokenRef.current = stored
        // Show the cached profile immediately (also keeps the app usable offline).
        const cached = await secureStorage.get(USER_KEY)
        if (active && cached) {
          try {
            setUser(normaliseUser(JSON.parse(cached)))
            setToken(stored)
          } catch {
            /* corrupt cache */
          }
        }
        try {
          const { data } = await authApi.me()
          if (!active || tokenRef.current !== stored) return
          await applySession(stored, data.user, data.entitlement)
        } catch (err) {
          if (isApiError(err) && isSessionRejected(err)) {
            if (active) await clearSession()
          } else if (active && !cached) {
            // Offline with no cached profile: keep the token, retry on next refresh.
            setToken(stored)
          }
        }
      } finally {
        if (active) setInitializing(false)
      }
    })()
    return () => {
      active = false
    }
  }, [applySession, clearSession])

  // Expired / revoked sessions (401 UNAUTHORIZED on an authenticated request) sign out.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (tokenRef.current) void clearSession()
    })
    return () => setUnauthorizedHandler(null)
  }, [clearSession])

  const run = useCallback(async <T,>(fallback: string, action: () => Promise<T>): Promise<T> => {
    setLoading(true)
    setError(null)
    try {
      return await action()
    } catch (err) {
      const message = errorMessage(err, fallback)
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const login = useCallback(
    (payload: LoginPayload) =>
      run('Login failed', async () => {
        const { data } = await authApi.login(payload)
        if (!data.token) {
          throw Object.assign(new Error('Please verify your email address before signing in'), { code: 'EMAIL_NOT_VERIFIED' })
        }
        await applySession(data.token, data.user, data.entitlement)
      }),
    [run, applySession],
  )

  const register = useCallback(
    (payload: RegisterPayload) =>
      run('Registration failed', async () => {
        const { data }: { data: AuthResponse } = await authApi.register(payload)
        if (data.token) {
          await applySession(data.token, data.user, data.entitlement)
          return { requiresEmailVerification: false }
        }
        return { requiresEmailVerification: true }
      }),
    [run, applySession],
  )

  const logout = useCallback(async () => {
    if (tokenRef.current) {
      // Revoke the session server-side; sign out locally regardless of the result.
      await authApi.logout().catch(() => undefined)
    }
    await clearSession()
  }, [clearSession])

  const forgotPassword = useCallback(
    (email: string) =>
      run('Could not send the reset link', async () => {
        const { data } = await authApi.forgotPassword(email)
        return data.message ?? 'If an account exists for this email, a reset link has been sent.'
      }),
    [run],
  )

  const resendVerification = useCallback(async (email: string) => {
    await authApi.resendVerifyLink(email)
  }, [])

  const updateProfile = useCallback(
    (data: Partial<Pick<User, 'name' | 'firstname' | 'lastname' | 'phone'>>) =>
      run('Could not update your profile', async () => {
        const res = await authApi.updateProfile(data)
        const normalised = normaliseUser(res.data.user)
        setUser(normalised)
        await secureStorage.set(USER_KEY, JSON.stringify(normalised))
      }),
    [run],
  )

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const { data } = await authApi.changePassword(currentPassword, newPassword, true)
    // Revoking other sessions issues a fresh token for this device.
    if (data.token) {
      tokenRef.current = data.token
      setToken(data.token)
      await setSessionToken(data.token)
    }
  }, [])

  const deleteAccount = useCallback(
    async (password: string) => {
      const { data } = await authApi.deleteAccount(password)
      await clearSession()
      return { manageStoreSubscription: data.manage_store_subscription ?? null }
    },
    [clearSession],
  )

  const refreshSession = useCallback(async () => {
    if (!tokenRef.current) return
    const current = tokenRef.current
    try {
      const { data } = await authApi.me()
      if (tokenRef.current === current) await applySession(current, data.user, data.entitlement)
    } catch (err) {
      if (errorCode(err) === 'UNAUTHORIZED') await clearSession()
    }
  }, [applySession, clearSession])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      entitlement,
      initializing,
      loading,
      error,
      isLoggedIn: Boolean(user && token),
      login,
      register,
      logout,
      forgotPassword,
      resendVerification,
      updateProfile,
      changePassword,
      deleteAccount,
      refreshSession,
      setEntitlement,
    }),
    [
      user,
      token,
      entitlement,
      initializing,
      loading,
      error,
      login,
      register,
      logout,
      forgotPassword,
      resendVerification,
      updateProfile,
      changePassword,
      deleteAccount,
      refreshSession,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
