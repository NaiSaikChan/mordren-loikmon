import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { auth as authApi, errorCode, isApiError } from '@loikmon/api'
import type { AuthResponse, Entitlement, LoginPayload, RegisterPayload, User } from '@loikmon/api'
import { normaliseUser } from '@/lib/user'
import { queryClient } from '@/lib/queryClient'
import { markFirstAuthCompleted } from '@/lib/authGate'
import { secureStorage } from '@/services/storage'
import { getSessionToken, isSessionRejected, setSessionToken, setUnauthorizedHandler } from '@/services/api'

const USER_KEY = 'user'

export type StoreName = 'app_store' | 'google_play'

interface AuthContextValue {
  user: User | null
  /** Server-computed access to premium content (null when signed out). */
  entitlement: Entitlement | null
  /** True while the stored session is being restored at start-up. */
  initializing: boolean
  /**
   * True while a login/register/forgot-password/profile action is running.
   * Tracked lazily: only components that actually read it re-render when it changes.
   */
  loading: boolean
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

type SessionValue = Omit<AuthContextValue, 'loading'>

// ── Pending-action flag (outside the session value) ────────────────────────

interface FlagStore {
  get: () => boolean
  subscribe: (listener: () => void) => () => void
  /** Runs `action` with the flag raised (overlapping actions are counted). */
  track: <T>(action: () => Promise<T>) => Promise<T>
}

function createFlagStore(): FlagStore {
  let pending = 0
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((listener) => listener())
  return {
    get: () => pending > 0,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    async track(action) {
      pending++
      if (pending === 1) emit()
      try {
        return await action()
      } finally {
        pending--
        if (pending === 0) emit()
      }
    },
  }
}

/** Records whether a component has read `loading` from `useAuth()`. */
interface ReadTracker {
  readsLoading: boolean
}

/** The session value plus a `loading` getter that opts the reader into loading updates. */
function withLoadingGetter(session: SessionValue, store: FlagStore, tracker: ReadTracker): AuthContextValue {
  const value = { ...session } as AuthContextValue
  Object.defineProperty(value, 'loading', {
    enumerable: true,
    get() {
      tracker.readsLoading = true
      return store.get()
    },
  })
  return value
}

const AuthContext = createContext<SessionValue | undefined>(undefined)
const ActionStateContext = createContext<FlagStore | null>(null)

// Narrow slices, so list cards and data hooks re-render only when what they use changes.
const UserIdContext = createContext<string | null>(null)
const EntitlementActiveContext = createContext(false)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [hasToken, setHasToken] = useState(false)
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [actionState] = useState(createFlagStore)
  const tokenRef = useRef<string | null>(null)

  const clearSession = useCallback(async () => {
    tokenRef.current = null
    setUser(null)
    setHasToken(false)
    setEntitlement(null)
    // Nothing fetched for the previous account may leak into the next one.
    queryClient.clear()
    try {
      await Promise.all([setSessionToken(null), secureStorage.remove(USER_KEY)])
    } catch (err) {
      // The in-memory session is already gone; a stale secure-store entry is re-validated on next launch.
      if (__DEV__) console.warn('[auth] could not clear the stored session:', err)
    }
  }, [])

  const applySession = useCallback(async (nextToken: string, rawUser: User, nextEntitlement: Entitlement | null) => {
    const normalised = normaliseUser(rawUser)
    tokenRef.current = nextToken
    setHasToken(true)
    setUser(normalised)
    setEntitlement(nextEntitlement)
    await Promise.all([
      setSessionToken(nextToken),
      secureStorage.set(USER_KEY, JSON.stringify(normalised)),
      markFirstAuthCompleted(),
    ])
  }, [])

  // Restore the stored session: validate the token with `auth.me()`.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const stored = await getSessionToken() // drops legacy `local:` tokens
        if (!stored) {
          await Promise.all([secureStorage.remove(USER_KEY), setSessionToken(null)]).catch(() => undefined)
          return
        }
        tokenRef.current = stored
        // Show the cached profile immediately (also keeps the app usable offline).
        const cached = await secureStorage.get(USER_KEY).catch(() => null)
        if (active && cached) {
          try {
            setUser(normaliseUser(JSON.parse(cached)))
            setHasToken(true)
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
            setHasToken(true)
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

  const login = useCallback(
    (payload: LoginPayload) =>
      actionState.track(async () => {
        const { data } = await authApi.login(payload)
        if (!data.token) {
          throw Object.assign(new Error('Please verify your email address before signing in'), { code: 'EMAIL_NOT_VERIFIED' })
        }
        await applySession(data.token, data.user, data.entitlement)
      }),
    [actionState, applySession],
  )

  const register = useCallback(
    (payload: RegisterPayload) =>
      actionState.track(async () => {
        const { data }: { data: AuthResponse } = await authApi.register(payload)
        if (data.token) {
          await applySession(data.token, data.user, data.entitlement)
          return { requiresEmailVerification: false }
        }
        return { requiresEmailVerification: true }
      }),
    [actionState, applySession],
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
      actionState.track(async () => {
        const { data } = await authApi.forgotPassword(email)
        return data.message ?? 'If an account exists for this email, a reset link has been sent.'
      }),
    [actionState],
  )

  const resendVerification = useCallback(async (email: string) => {
    await authApi.resendVerifyLink(email)
  }, [])

  const updateProfile = useCallback(
    (data: Partial<Pick<User, 'name' | 'firstname' | 'lastname' | 'phone'>>) =>
      actionState.track(async () => {
        const res = await authApi.updateProfile(data)
        const normalised = normaliseUser(res.data.user)
        setUser(normalised)
        await secureStorage.set(USER_KEY, JSON.stringify(normalised))
      }),
    [actionState],
  )

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const { data } = await authApi.changePassword(currentPassword, newPassword, true)
    // Revoking other sessions issues a fresh token for this device.
    if (data.token) {
      tokenRef.current = data.token
      setHasToken(true)
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

  const value = useMemo<SessionValue>(
    () => ({
      user,
      entitlement,
      initializing,
      isLoggedIn: Boolean(user && hasToken),
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
      hasToken,
      entitlement,
      initializing,
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

  const userId = user?.id || null
  const entitlementActive = Boolean(entitlement?.active)

  return (
    <ActionStateContext.Provider value={actionState}>
      <AuthContext.Provider value={value}>
        <UserIdContext.Provider value={userId}>
          <EntitlementActiveContext.Provider value={entitlementActive}>{children}</EntitlementActiveContext.Provider>
        </UserIdContext.Provider>
      </AuthContext.Provider>
    </ActionStateContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const session = useContext(AuthContext)
  const actionState = useContext(ActionStateContext)
  if (!session || !actionState) throw new Error('useAuth must be used within an AuthProvider')
  // Mutable per-component record (not state): flipped by the `loading` getter on first read.
  const [tracker] = useState<ReadTracker>(() => ({ readsLoading: false }))
  // Components that never read `loading` get a constant snapshot, so login/profile
  // actions don't re-render every `useAuth()` consumer.
  const loading = useSyncExternalStore(actionState.subscribe, () => (tracker.readsLoading ? actionState.get() : false))
  return useMemo(
    () => withLoadingGetter(session, actionState, tracker),
    // `loading` is a dependency so readers get a new object when it flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, actionState, tracker, loading],
  )
}

/** Signed-in user's id (null when signed out). Cheaper than `useAuth()` for keys. */
export function useSessionUserId(): string | null {
  return useContext(UserIdContext)
}

/** Whether the viewer's subscription currently unlocks premium content. */
export function useEntitlementActive(): boolean {
  return useContext(EntitlementActiveContext)
}

/** Cache-key fragment for content whose server response depends on who is viewing. */
export function useAccessKey(): string {
  const userId = useSessionUserId()
  const active = useEntitlementActive()
  return `${userId ?? ''}:${active ? 1 : 0}`
}
