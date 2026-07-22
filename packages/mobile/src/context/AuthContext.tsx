import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react'
import { auth as authApi } from '@loikmon/api'
import type { User, LoginPayload, RegisterPayload } from '@loikmon/api'
import { normaliseUser, makeSessionKey } from '@/lib/user'
import { secureStorage } from '@/services/storage'

const TOKEN_KEY = 'token'
const USER_KEY = 'user'

interface AuthContextValue {
  user: User | null
  token: string | null
  loading: boolean
  error: string | null
  isLoggedIn: boolean
  coinBalance: number
  login: (payload: LoginPayload) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<string>
  updateProfile: (data: Partial<User> & { password?: string }) => Promise<void>
  refreshUser: (next: User) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function messageFromError(err: unknown, fallback: string): string {
  if (typeof err === 'string') return err
  const e = err as { response?: { data?: { message?: string } }; message?: string }
  return e?.response?.data?.message ?? e?.message ?? fallback
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Restore persisted session on startup.
  useEffect(() => {
    ;(async () => {
      const [savedToken, savedUser] = await Promise.all([
        secureStorage.get(TOKEN_KEY),
        secureStorage.get(USER_KEY),
      ])
      if (savedToken) setToken(savedToken)
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser) as User)
        } catch {
          /* corrupt storage — ignore */
        }
      }
    })()
  }, [])

  const persist = useCallback(async (nextUser: User, nextToken: string) => {
    await Promise.all([
      secureStorage.set(TOKEN_KEY, nextToken),
      secureStorage.set(USER_KEY, JSON.stringify(nextUser)),
    ])
  }, [])

  const login = useCallback(
    async (payload: LoginPayload) => {
      setLoading(true)
      setError(null)
      try {
        const res = await authApi.login(payload)
        const body = res.data
        if (body.status === 'error' || body.status === 'fail') {
          throw body.message ?? 'Login failed'
        }
        if (!body.user) throw 'No user data received'

        const normUser = normaliseUser(body.user as Record<string, unknown>)
        const sessionToken = body.token ?? makeSessionKey(body.user as Record<string, unknown>)
        setUser(normUser)
        setToken(sessionToken)
        await persist(normUser, sessionToken)
      } catch (err) {
        const msg = messageFromError(err, 'Login failed')
        setError(msg)
        throw new Error(msg)
      } finally {
        setLoading(false)
      }
    },
    [persist],
  )

  const register = useCallback(
    async (payload: RegisterPayload) => {
      setLoading(true)
      setError(null)
      try {
        const res = await authApi.register(payload)
        const body = res.data
        if (body.status === 'error' || body.status === 'fail') {
          throw body.message ?? 'Registration failed'
        }
        if (body.user) {
          const normUser = normaliseUser(body.user as Record<string, unknown>)
          const sessionToken = body.token ?? makeSessionKey(body.user as Record<string, unknown>)
          setUser(normUser)
          setToken(sessionToken)
          await persist(normUser, sessionToken)
        }
      } catch (err) {
        const msg = messageFromError(err, 'Registration failed')
        setError(msg)
        throw new Error(msg)
      } finally {
        setLoading(false)
      }
    },
    [persist],
  )

  const logout = useCallback(async () => {
    setUser(null)
    setToken(null)
    await Promise.all([secureStorage.remove(TOKEN_KEY), secureStorage.remove(USER_KEY)])
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await authApi.resetPassword(email)
      return res.data.message ?? 'Password reset link sent.'
    } catch (err) {
      const msg = messageFromError(err, 'Could not reset password')
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  const updateProfile = useCallback(
    async (data: Partial<User> & { password?: string }) => {
      setLoading(true)
      try {
        const res = await authApi.updateProfile(data as Record<string, unknown>)
        const body = res.data
        if (body.status !== 'error' && body.user) {
          const normUser = normaliseUser(body.user as Record<string, unknown>)
          setUser(normUser)
          if (token) await secureStorage.set(USER_KEY, JSON.stringify(normUser))
        }
      } finally {
        setLoading(false)
      }
    },
    [token],
  )

  const refreshUser = useCallback(async (next: User) => {
    setUser(next)
    await secureStorage.set(USER_KEY, JSON.stringify(next))
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      error,
      isLoggedIn: !!token && !!user,
      coinBalance: Number(user?.coins ?? 0),
      login,
      register,
      logout,
      resetPassword,
      updateProfile,
      refreshUser,
    }),
    [user, token, loading, error, login, register, logout, resetPassword, updateProfile, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
