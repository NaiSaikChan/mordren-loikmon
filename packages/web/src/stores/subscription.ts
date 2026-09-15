import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { errorMessage, subscriptions as subscriptionsApi } from '@loikmon/api'
import type { Plan, PlansResponse, SubscriptionStatusResponse } from '@loikmon/api'
import { useAuthStore } from './auth'

/**
 * Plans and the signed-in user's subscription status.
 * The web app never sells subscriptions — purchases happen in the mobile apps.
 */
export const useSubscriptionStore = defineStore('subscription', () => {
  const plans          = ref<Plan[]>([])
  const platforms      = ref<PlansResponse['platforms'] | null>(null)
  const status         = ref<SubscriptionStatusResponse | null>(null)
  const loadingPlans   = ref(false)
  const loadingStatus  = ref(false)
  const plansError     = ref<string | null>(null)
  const statusError    = ref<string | null>(null)

  // The status belongs to the user: drop it on sign-out or when another user signs in.
  const auth = useAuthStore()
  watch(() => auth.user?.id ?? null, (next, prev) => { if (prev !== null && next !== prev) reset() })

  const sortedPlans = computed(() => [...plans.value].sort((a, b) => a.period_months - b.period_months))

  /** The subscription to describe: the one granting access, otherwise the most recent record. */
  const currentSubscription = computed(() => {
    const s = status.value
    if (!s) return null
    if (s.entitlement.subscription) return s.entitlement.subscription
    const [latest] = [...s.subscriptions].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
    return latest ?? null
  })

  function planByCode(code: string | null | undefined): Plan | null {
    if (!code) return null
    return plans.value.find((p) => p.code === code) ?? null
  }

  async function fetchPlans(force = false) {
    if (plans.value.length && !force) return plans.value
    loadingPlans.value = true
    plansError.value = null
    try {
      const { data } = await subscriptionsApi.fetchPlans()
      plans.value = data.plans ?? []
      platforms.value = data.platforms ?? null
    } catch (err) {
      plansError.value = errorMessage(err)
    } finally {
      loadingPlans.value = false
    }
    return plans.value
  }

  async function fetchStatus() {
    if (!auth.token) {
      status.value = null
      return null
    }
    loadingStatus.value = true
    statusError.value = null
    try {
      const { data } = await subscriptionsApi.getStatus()
      status.value = data
      auth.setEntitlement(data.entitlement)
    } catch (err) {
      status.value = null
      statusError.value = errorMessage(err)
    } finally {
      loadingStatus.value = false
    }
    return status.value
  }

  function reset() {
    status.value = null
    statusError.value = null
  }

  return {
    plans, platforms, status, loadingPlans, loadingStatus, plansError, statusError,
    sortedPlans, currentSubscription, planByCode, fetchPlans, fetchStatus, reset,
  }
})
