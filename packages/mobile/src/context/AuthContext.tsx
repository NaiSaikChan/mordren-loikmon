import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react'
import { auth as authApi, getClient } from '@loikmon/api'
import type { User, LoginPayload, RegisterPayload } from '@loikmon/api'
import { normaliseUser } from '@/lib/user'
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

function deriveLocalSessionToken(user: User): string {
  return `local:${String(user.id ?? user.email ?? 'session')}`
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
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser) as User
          setUser(parsed)
          setToken(savedToken ?? deriveLocalSessionToken(parsed))
        } catch {
          /* corrupt storage — ignore */
        }
      } else if (savedToken) {
        setToken(savedToken)
      }
    })()
  }, [])

  const persist = useCallback(async (nextUser: User, nextToken?: string | null) => {
    const tokenToStore = nextToken ?? deriveLocalSessionToken(nextUser)
    await Promise.all([
      secureStorage.set(TOKEN_KEY, tokenToStore),
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
          throw new Error(String(body.message ?? 'Login failed'))
        }
        if (!body.user) throw new Error('No user data received')

        const normUser = normaliseUser(body.user as Record<string, unknown>)
        const sessionToken = body.token ?? deriveLocalSessionToken(normUser)
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
          throw new Error(String(body.message ?? 'Registration failed'))
        }
        if (body.user) {
          const normUser = normaliseUser(body.user as Record<string, unknown>)
          const sessionToken = body.token ?? deriveLocalSessionToken(normUser)
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
          await secureStorage.set(USER_KEY, JSON.stringify(normUser))
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
      isLoggedIn: !!user,
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
