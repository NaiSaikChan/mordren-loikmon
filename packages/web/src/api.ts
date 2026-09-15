import { configureClient } from '@loikmon/api'
import type { Pinia } from 'pinia'
import type { Router } from 'vue-router'
import { API_BASE_URL } from '@/config'
import { useAuthStore } from '@/stores/auth'

/**
 * Configures the shared `@loikmon/api` client. Call once at start-up, after
 * Pinia is installed and before any request is made.
 *
 * - The bearer token is read from the auth store (persisted in localStorage `token`).
 * - A 401 on an authenticated request means the session expired or was revoked:
 *   the local session is cleared and protected pages send the user to sign in.
 */
export function installApiClient({ pinia, router }: { pinia: Pinia; router?: Router }) {
  return configureClient({
    baseURL: API_BASE_URL,
    getToken: () => useAuthStore(pinia).token,
    onUnauthorized: () => {
      useAuthStore(pinia).clearSession()
      const current = router?.currentRoute.value
      if (router && current?.meta?.requiresAuth) {
        void router.replace({ name: 'auth', query: { redirect: current.fullPath } })
      }
    },
  })
}
