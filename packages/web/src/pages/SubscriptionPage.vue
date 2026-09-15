<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { formatPlanPrice } from '@loikmon/api'
import type { Plan, SubscriptionPlatform, SubscriptionStatus } from '@loikmon/api'
import { useAuthStore } from '@/stores/auth'
import { useSubscriptionStore } from '@/stores/subscription'
import { STORE_MANAGE_URLS } from '@/config'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import StoreButtons from '@/components/shared/StoreButtons.vue'

/**
 * Plans + the user's subscription status. Subscriptions are sold only in the
 * mobile apps (Google Play Billing / Apple IAP); entitlement is per account,
 * so a subscription bought on a phone unlocks the web too.
 */
const { t } = useI18n()
const route = useRoute()
const auth = useAuthStore()
const store = useSubscriptionStore()
const refreshing = ref(false)

function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  // Same unambiguous "15 October 2026" format in both UI languages.
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function price(plan: Plan) {
  return formatPlanPrice(plan)
}

function monthlyPrice(plan: Plan) {
  return formatPlanPrice({ price_cents: plan.monthly_price_cents, currency: plan.currency })
}

function billingLabel(plan: Plan) {
  if (plan.period_months === 1) return t('subscription.billedMonthly')
  if (plan.period_months === 12) return t('subscription.billedYearly')
  return t('subscription.billedEvery', { count: plan.period_months })
}

function platformLabel(platform: SubscriptionPlatform | null | undefined) {
  return platform ? t(`subscription.platforms.${platform}`) : ''
}

const entitlement = computed(() => store.status?.entitlement ?? auth.entitlement)
const subscription = computed(() => store.currentSubscription)
const subscriptionStatus = computed<SubscriptionStatus | null>(() => subscription.value?.status ?? null)
const currentPlan = computed(() => store.planByCode(subscription.value?.plan_code))
const storeName = computed(() => platformLabel(subscription.value?.platform))
const expiresAt = computed(() => formatDate(subscription.value?.expires_at ?? entitlement.value?.expires_at))

const manageUrl = computed(() => {
  const platform = subscription.value?.platform
  if (platform !== 'app_store' && platform !== 'google_play') return null
  return store.status?.manage_urls?.[platform] ?? STORE_MANAGE_URLS[platform]
})

/** Plain-language explanation of the subscription state. */
const statusNote = computed(() => {
  const status = subscriptionStatus.value
  const sub = subscription.value
  if (!status || !sub) return ''
  const params = { date: expiresAt.value, store: storeName.value }
  switch (status) {
    case 'active':
      return sub.auto_renew ? t('subscription.notes.activeRenewing', params) : t('subscription.notes.activeEnding', params)
    case 'canceled':
    case 'grace_period':
    case 'billing_retry':
    case 'paused':
    case 'pending':
    case 'expired':
    case 'revoked':
      return t(`subscription.notes.${status}`, params)
    default:
      return ''
  }
})

const statusTone = computed(() => {
  switch (subscriptionStatus.value) {
    case 'active': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
    case 'canceled':
    case 'paused':
    case 'pending': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
    case 'grace_period':
    case 'billing_retry': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200'
    default: return 'bg-gray-100 text-gray-700 dark:bg-surface-800 dark:text-gray-300'
  }
})

/** Access that does not come from a store subscription (team grant or admin). */
const nonStoreAccess = computed(() => {
  const e = entitlement.value
  if (!e?.active || e.source === 'subscription') return null
  return e.source === 'admin' ? t('subscription.adminActive') : t('subscription.grantActive')
})

function isCurrentPlan(plan: Plan) {
  return Boolean(entitlement.value?.active && subscription.value?.plan_code === plan.code)
}

async function loadStatus() {
  if (auth.token) await store.fetchStatus()
}

async function refreshStatus() {
  refreshing.value = true
  try {
    await Promise.all([loadStatus(), auth.refresh().catch(() => false)])
  } finally {
    refreshing.value = false
  }
}

onMounted(() => {
  void store.fetchPlans()
  void loadStatus()
})

// Signing in on another tab / after restore: load the status once a session exists.
watch(() => auth.isLoggedIn, (loggedIn) => { if (loggedIn && !store.status && !store.loadingStatus) void loadStatus() })
</script>

<template>
  <div class="page-wrapper max-w-5xl">
    <!-- Header -->
    <div class="relative mb-8 overflow-hidden rounded-4xl border border-amber-100 bg-linear-to-br from-amber-50 via-white to-brand-50 p-6 shadow-sm dark:border-amber-900/40 dark:from-amber-950/30 dark:via-surface-900 dark:to-brand-950/30 sm:p-8">
      <p class="mb-3 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-700 shadow-sm ring-1 ring-amber-100 dark:bg-surface-900/70 dark:text-amber-300 dark:ring-amber-800">
        👑 {{ t('subscription.title') }}
      </p>
      <h1 class="text-2xl font-black tracking-tight text-gray-900 dark:text-white sm:text-3xl">{{ t('subscription.subtitle') }}</h1>
      <ul class="mt-4 grid gap-2 text-sm text-gray-700 dark:text-gray-300 sm:grid-cols-2">
        <li>📚 {{ t('subscription.benefitBooks') }}</li>
        <li>📰 {{ t('subscription.benefitArticles') }}</li>
        <li>🎧 {{ t('subscription.benefitAudio') }}</li>
        <li>📱 {{ t('subscription.benefitDevices') }}</li>
      </ul>
    </div>

    <!-- Status -->
    <section class="mb-8" aria-labelledby="subscription-status">
      <h2 id="subscription-status" class="section-title">{{ t('subscription.statusTitle') }}</h2>

      <div v-if="!auth.token" class="card p-6 flex flex-wrap items-center justify-between gap-4" data-testid="subscription-signin">
        <p class="text-sm text-gray-600 dark:text-gray-300">🔐 {{ t('subscription.signInPrompt') }}</p>
        <RouterLink :to="{ name: 'auth', query: { redirect: route.fullPath } }" class="btn-primary">{{ t('auth.login') }}</RouterLink>
      </div>

      <LoadingSpinner v-else-if="store.loadingStatus && !store.status" />

      <div v-else-if="store.statusError && !store.status" class="card p-6 flex flex-wrap items-center justify-between gap-4">
        <p class="text-sm text-red-600 dark:text-red-300">{{ t('subscription.statusError') }}</p>
        <button type="button" class="btn-secondary" @click="loadStatus">{{ t('common.retry') }}</button>
      </div>

      <div v-else class="card p-6" data-testid="subscription-status">
        <!-- Store subscription (active or not) -->
        <template v-if="subscription">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <span v-if="entitlement?.active" class="text-lg font-bold text-gray-900 dark:text-white">👑 {{ t('subscription.premiumActive') }}</span>
                <span v-else class="text-lg font-bold text-gray-900 dark:text-white">{{ t('subscription.noSubscription') }}</span>
                <span v-if="subscriptionStatus" :class="['rounded-full px-2.5 py-0.5 text-xs font-bold', statusTone]" data-testid="subscription-status-label">
                  {{ t(`subscription.statuses.${subscriptionStatus}`) }}
                </span>
              </div>
              <p v-if="statusNote" class="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-300" data-testid="subscription-status-note">{{ statusNote }}</p>
            </div>
            <a v-if="manageUrl" :href="manageUrl" target="_blank" rel="noopener" class="btn-secondary" data-testid="subscription-manage">
              {{ t('subscription.manageIn', { store: storeName }) }}
            </a>
          </div>

          <dl class="mt-5 grid gap-4 text-sm sm:grid-cols-3">
            <div class="rounded-2xl bg-gray-50 p-3 dark:bg-surface-800">
              <dt class="text-xs text-gray-400">{{ t('subscription.plan') }}</dt>
              <dd class="mt-1 font-semibold text-gray-900 dark:text-white">{{ currentPlan?.name ?? subscription.plan_code ?? '—' }}</dd>
            </div>
            <div class="rounded-2xl bg-gray-50 p-3 dark:bg-surface-800">
              <dt class="text-xs text-gray-400">{{ t('subscription.status') }}</dt>
              <dd class="mt-1 font-semibold text-gray-900 dark:text-white">
                <template v-if="!expiresAt">—</template>
                <template v-else-if="subscriptionStatus === 'expired' || subscriptionStatus === 'revoked'">{{ t('subscription.expiredOn', { date: expiresAt }) }}</template>
                <template v-else-if="subscriptionStatus === 'active' && subscription.auto_renew">{{ t('subscription.renewsOn', { date: expiresAt }) }}</template>
                <template v-else>{{ t('subscription.accessUntil', { date: expiresAt }) }}</template>
              </dd>
            </div>
            <div class="rounded-2xl bg-gray-50 p-3 dark:bg-surface-800">
              <dt class="text-xs text-gray-400">{{ t('subscription.store') }}</dt>
              <dd class="mt-1 font-semibold text-gray-900 dark:text-white">{{ storeName || '—' }}</dd>
            </div>
          </dl>
        </template>

        <!-- Access granted by the team / admin -->
        <template v-else-if="nonStoreAccess">
          <p class="text-lg font-bold text-gray-900 dark:text-white">👑 {{ t('subscription.premiumActive') }}</p>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {{ nonStoreAccess }}<template v-if="entitlement?.expires_at"> · {{ t('subscription.accessUntil', { date: formatDate(entitlement.expires_at) }) }}</template>
          </p>
        </template>

        <!-- No subscription -->
        <template v-else>
          <p class="text-lg font-bold text-gray-900 dark:text-white">{{ t('subscription.noSubscription') }}</p>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{{ t('subscription.noSubscriptionHint') }}</p>
        </template>

        <div class="mt-5 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4 text-sm dark:border-surface-700">
          <span class="text-gray-500 dark:text-gray-400">{{ t('subscription.refreshHint') }}</span>
          <button type="button" class="btn-ghost" :disabled="refreshing" data-testid="subscription-refresh" @click="refreshStatus">
            {{ refreshing ? t('common.loading') : t('subscription.refreshStatus') }}
          </button>
        </div>
      </div>
    </section>

    <!-- Plans -->
    <section class="mb-8" aria-labelledby="subscription-plans">
      <h2 id="subscription-plans" class="section-title">{{ t('subscription.plansTitle') }}</h2>

      <LoadingSpinner v-if="store.loadingPlans && !store.plans.length" />
      <div v-else-if="store.plansError && !store.plans.length" class="card p-6 flex flex-wrap items-center justify-between gap-4">
        <p class="text-sm text-red-600 dark:text-red-300">{{ t('subscription.plansError') }}</p>
        <button type="button" class="btn-secondary" @click="store.fetchPlans(true)">{{ t('common.retry') }}</button>
      </div>
      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article
          v-for="plan in store.sortedPlans"
          :key="plan.code"
          :class="[
            'card relative flex flex-col p-5',
            isCurrentPlan(plan) ? 'ring-2 ring-amber-400' : '',
          ]"
          :data-plan="plan.code"
          data-testid="subscription-plan"
        >
          <span
            v-if="plan.savings_percent > 0"
            class="absolute right-3 top-3 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white"
          >{{ t('subscription.savePercent', { percent: plan.savings_percent }) }}</span>
          <h3 class="pr-16 font-semibold text-gray-900 dark:text-white">{{ plan.name }}</h3>
          <p class="mt-3 text-3xl font-black text-gray-900 dark:text-white" data-testid="subscription-plan-price">{{ price(plan) }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ billingLabel(plan) }}</p>
          <p v-if="plan.period_months > 1" class="mt-2 text-sm font-medium text-brand-600 dark:text-brand-400">
            {{ t('subscription.perMonth', { price: monthlyPrice(plan) }) }}
          </p>
          <p v-if="plan.description" class="mt-3 text-sm text-gray-600 dark:text-gray-300">{{ plan.description }}</p>
          <span v-if="isCurrentPlan(plan)" class="mt-auto pt-4 text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            ✓ {{ t('subscription.currentPlan') }}
          </span>
        </article>
      </div>
    </section>

    <!-- Where to subscribe -->
    <section class="card p-6 sm:p-8" aria-labelledby="subscription-cta" data-testid="subscription-cta">
      <h2 id="subscription-cta" class="text-xl font-bold text-gray-900 dark:text-white">📱 {{ t('subscription.subscribeTitle') }}</h2>
      <p class="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600 dark:text-gray-300">{{ t('subscription.subscribeBody') }}</p>
      <p class="mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('subscription.webNotice') }}</p>
      <StoreButtons class="mt-5" />
    </section>
  </div>
</template>
