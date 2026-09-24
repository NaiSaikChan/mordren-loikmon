import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { cms, errorMessage, isApiError } from '@loikmon/api'
import type { CmsSession, PermissionGroup, RoleScope } from '@loikmon/api'

/**
 * CMS session: which permissions the signed-in account holds, whether its
 * reach is the whole catalogue or only its own author profiles, and the
 * permission catalogue used by the role editor.
 *
 * This is a UI convenience only — the server re-checks every permission on
 * every request. Hiding a button never makes an endpoint safe.
 */
export const useCmsSessionStore = defineStore('cms-session', () => {
  const session = ref<CmsSession | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  /** Null until the first `load()` settles; route guards wait for it. */
  const loaded = ref(false)
  let inflight: Promise<CmsSession | null> | null = null

  const permissions = computed(() => new Set(session.value?.permissions ?? []))
  const canAccess = computed(() => session.value?.can_access === true)
  const scope = computed<RoleScope>(() => session.value?.scope ?? 'own')
  const isOwnScope = computed(() => scope.value === 'own')
  const authorProfiles = computed(() => session.value?.author_profiles ?? [])
  const primaryRole = computed(() => session.value?.user.primary_role ?? 'user')
  const permissionGroups = computed<PermissionGroup[]>(() => session.value?.permission_groups ?? [])

  /** True only when every listed permission is held. */
  function can(...required: string[]): boolean {
    return required.every((permission) => permissions.value.has(permission))
  }

  /** True when at least one of the listed permissions is held. */
  function canAny(...required: string[]): boolean {
    return required.some((permission) => permissions.value.has(permission))
  }

  async function load(force = false): Promise<CmsSession | null> {
    if (session.value && !force) return session.value
    if (inflight) return inflight
    loading.value = true
    error.value = null
    inflight = cms
      .me()
      .then(({ data }) => {
        session.value = data
        return data
      })
      .catch((err) => {
        // 401/403 simply mean "no CMS for this account"; anything else is worth showing.
        if (!isApiError(err) || (err.status !== 401 && err.status !== 403)) error.value = errorMessage(err)
        session.value = null
        return null
      })
      .finally(() => {
        loading.value = false
        loaded.value = true
        inflight = null
      })
    return inflight
  }

  /** Resolves once the session has been fetched at least once. */
  function ensureLoaded(): Promise<CmsSession | null> {
    return loaded.value && !inflight ? Promise.resolve(session.value) : load()
  }

  function reset() {
    session.value = null
    loaded.value = false
    error.value = null
  }

  return {
    session,
    loading,
    error,
    loaded,
    permissions,
    permissionGroups,
    canAccess,
    scope,
    isOwnScope,
    authorProfiles,
    primaryRole,
    can,
    canAny,
    load,
    ensureLoaded,
    reset,
  }
})
