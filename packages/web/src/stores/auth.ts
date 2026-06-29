import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { auth as authApi } from '@loikmon/api'
import type { User, LoginPayload, RegisterPayload } from '@loikmon/api'

export const useAuthStore = defineStore('auth', () => {
  // ── State ────────────────────────────────────────
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ── Getters ──────────────────────────────────────
  const isLoggedIn = computed(() => !!token.value)
  const displayName = computed(() => user.value?.name ?? '')
  const avatar = computed(() => user.value?.avatar ?? '')
  const coinBalance = computed(() => user.value?.coins ?? 0)

  // ── Actions ──────────────────────────────────────
  async function login(payload: LoginPayload) {
    loading.value = true
    error.value = null
    try {
      const res = await authApi.login(payload)
      const body = res.data
      // loikmon.org returns: { status: 'ok'|'error', token?, user?, message? }
      if (body.status === 'error') {
        error.value = body.message ?? 'Login failed'
        throw error.value
      }
      if (!body.token) {
        error.value = 'No token received'
        throw error.value
      }
      token.value = body.token
      user.value = (body.user as User) ?? null
      localStorage.setItem('token', body.token)
    } catch (err: unknown) {
      if (typeof err === 'string') throw err
      const e = err as { response?: { data?: { message?: string } }; message?: string }
      error.value = e.response?.data?.message ?? e.message ?? 'Login failed'
      throw error.value
    } finally {
      loading.value = false
    }
  }

  async function register(payload: RegisterPayload) {
    loading.value = true
    error.value = null
    try {
      const res = await authApi.register(payload)
      const body = res.data
      if (body.status === 'error') {
        error.value = body.message ?? 'Registration failed'
        throw error.value
      }
      // Some accounts require email verification — token may not be present
      if (body.token) {
        token.value = body.token
        user.value = (body.user as User) ?? null
        localStorage.setItem('token', body.token)
      }
    } catch (err: unknown) {
      if (typeof err === 'string') throw err
      const e = err as { response?: { data?: { message?: string } }; message?: string }
      error.value = e.response?.data?.message ?? e.message ?? 'Registration failed'
      throw error.value
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
  }

  async function updateProfile(data: Partial<User> & { password?: string }) {
    loading.value = true
    try {
      const res = await authApi.updateProfile(data)
      const body = res.data
      if (body.status !== 'error' && body.user) {
        user.value = body.user as unknown as User
      }
    } finally {
      loading.value = false
    }
  }

  // Restore session on app mount
  function restore() {
    const saved = localStorage.getItem('token')
    if (saved) token.value = saved
  }

  return {
    user, token, loading, error, isLoggedIn, displayName, avatar, coinBalance,
    login, register, logout, updateProfile, restore,
  }
})
