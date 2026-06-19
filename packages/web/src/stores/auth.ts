import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { auth as authApi, setClient } from '@loikmon/api'
import type { User, LoginPayload, RegisterPayload } from '@loikmon/api'
import axios from 'axios'

export const useAuthStore = defineStore('auth', () => {
  // ── State ────────────────────────────────────────
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ── Getters ──────────────────────────────────────
  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const displayName = computed(() => user.value?.name ?? '')
  const avatar = computed(() => user.value?.avatar ?? '')
  const coinBalance = computed(() => user.value?.coins ?? 0)

  // ── Init axios with base URL ──────────────────────
  function _initClient() {
    const instance = axios.create({
      baseURL: '/api',
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    })
    instance.interceptors.request.use((config) => {
      if (token.value) config.headers['Authorization'] = `Bearer ${token.value}`
      return config
    })
    setClient(instance)
  }

  // ── Actions ──────────────────────────────────────
  async function login(payload: LoginPayload) {
    loading.value = true
    error.value = null
    try {
      _initClient()
      const res = await authApi.login(payload)
      const result = res.data.data
      token.value = result.token
      user.value = result.user
      localStorage.setItem('token', result.token)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message: string }
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
      _initClient()
      const res = await authApi.register(payload)
      const result = res.data.data
      token.value = result.token
      user.value = result.user
      localStorage.setItem('token', result.token)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message: string }
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
      user.value = res.data.data
    } finally {
      loading.value = false
    }
  }

  // Restore session on app mount
  function restore() {
    const saved = localStorage.getItem('token')
    if (saved) {
      token.value = saved
      _initClient()
    }
  }

  return { user, token, loading, error, isLoggedIn, displayName, avatar, coinBalance,
           login, register, logout, updateProfile, restore }
})
