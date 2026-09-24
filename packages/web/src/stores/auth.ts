import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { auth as authApi, errorMessage, isApiError } from '@loikmon/api'
import type { Entitlement, LoginPayload, RegisterPayload, User } from '@loikmon/api'
import { TOKEN_STORAGE_KEY } from '@/config'

/** Legacy key: the old PHP-API web app cached the user object here. */
const LEGACY_USER_KEY = 'user'

function readToken(): string | null {
  try {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
    // `local:` tokens were fabricated by the legacy client and are not valid sessions.
    return stored && !stored.startsWith('local:') ? stored : null
  } catch {
    return null
  }
}

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token)
    else localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(LEGACY_USER_KEY)
  } catch { /* storage unavailable */ }
}

export interface RegisterResult {
  /** True when the account was created but the user must verify their email before signing in. */
  requiresEmailVerification: boolean
}

export const useAuthStore = defineStore('auth', () => {
  // ── State ─────────────────────────────────────────
  const token       = ref<string | null>(readToken())
  const user        = ref<User | null>(null)
  const entitlement = ref<Entitlement | null>(null)
  const loading     = ref(false)
  const error       = ref<string | null>(null)
  /** True once the stored session (if any) has been validated with `auth.me()`. */
  const restored    = ref(!token.value)
  let restorePromise: Promise<void> | null = null

  // ── Getters ───────────────────────────────────────
  const isLoggedIn  = computed(() => Boolean(token.value && user.value))
  const isSubscribed = computed(() => entitlement.value?.active === true)
  const displayName = computed(() => {
    const u = user.value
    if (!u) return ''
    return u.name || [u.firstname, u.lastname].filter(Boolean).join(' ') || u.email.split('@')[0] || ''
  })
  const avatar      = computed(() => user.value?.avatar ?? user.value?.thumbnail ?? '')

  // ── Session helpers ───────────────────────────────
  function setSession(nextToken: string, nextUser: User, nextEntitlement: Entitlement | null) {
    token.value = nextToken
    user.value = nextUser
    entitlement.value = nextEntitlement
    restored.value = true
    writeToken(nextToken)
  }

  /** Forget the local session (no server call). Used on logout and when the server answers 401. */
  function clearSession() {
    token.value = null
    user.value = null
    entitlement.value = null
    restored.value = true
    writeToken(null)
  }

  function setEntitlement(next: Entitlement | null) {
    entitlement.value = next
  }

  // ── Actions ───────────────────────────────────────
  async function login(payload: LoginPayload) {
    loading.value = true
    error.value = null
    try {
      const { data } = await authApi.login(payload)
      if (!data.token) throw new Error('Please verify your email address before signing in')
      setSession(data.token, data.user, data.entitlement)
      return data
    } catch (err) {
      error.value = errorMessage(err, 'Login failed')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function register(payload: RegisterPayload): Promise<RegisterResult> {
    loading.value = true
    error.value = null
    try {
      const { data } = await authApi.register(payload)
      if (!data.token || data.requires_email_verification) {
        return { requiresEmailVerification: true }
      }
      setSession(data.token, data.user, data.entitlement)
      return { requiresEmailVerification: false }
    } catch (err) {
      error.value = errorMessage(err, 'Registration failed')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    const hadToken = Boolean(token.value)
    try {
      if (hadToken) await authApi.logout()
    } catch { /* the session is dropped locally either way */ }
    finally {
      clearSession()
    }
  }

  /** Reload the user and entitlement from the server. Returns false when there is no valid session. */
  async function refresh(): Promise<boolean> {
    if (!token.value) return false
    try {
      const { data } = await authApi.me()
      user.value = data.user
      entitlement.value = data.entitlement
      error.value = null
      return true
    } catch (err) {
      if (isApiError(err) && err.status === 401) {
        clearSession()
        return false
      }
      error.value = errorMessage(err)
      throw err
    } finally {
      restored.value = true
    }
  }

  /**
   * Validate the persisted token (if any) with `auth.me()`. A 401 clears the
   * session; network errors keep the token so a later `refresh()` can recover.
   */
  function restore(): Promise<void> {
    if (!token.value) {
      restored.value = true
      writeToken(null) // drops legacy `local:` tokens / cached users
      return Promise.resolve()
    }
    if (!restorePromise) {
      restorePromise = refresh()
        .then(() => undefined)
        .catch(() => undefined)
        .finally(() => { restorePromise = null })
    }
    return restorePromise
  }

  /** Resolves once the persisted session has been checked (used by route guards). */
  function ensureRestored(): Promise<void> {
    return restored.value ? Promise.resolve() : restore()
  }

  async function updateProfile(data: Parameters<typeof authApi.updateProfile>[0]) {
    const { data: body } = await authApi.updateProfile(data)
    user.value = body.user
    return body.user
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    const { data } = await authApi.changePassword(currentPassword, newPassword, true)
    // Revoking other sessions issues a fresh token for this one.
    if (data.token && user.value) setSession(data.token, user.value, entitlement.value)
    return data
  }

  /** Deletes the account and signs out. Returns the store whose subscription must still be cancelled, if any. */
  async function deleteAccount(password: string) {
    const { data } = await authApi.deleteAccount(password)
    clearSession()
    return data.manage_store_subscription ?? null
  }

  return {
    token, user, entitlement, loading, error, restored,
    isLoggedIn, isSubscribed, displayName, avatar,
    login, register, logout, refresh, restore, ensureRestored,
    clearSession, setEntitlement, updateProfile, changePassword, deleteAccount,
  }
})
