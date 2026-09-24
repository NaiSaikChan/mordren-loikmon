<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { LockReason } from '@/utils/access'

/**
 * Call to action shown wherever the server refused access:
 * - `login_required` → sign in (and come back here)
 * - `subscription_required` → subscription page (plans are sold in the mobile apps)
 */
const props = withDefaults(defineProps<{
  reason: LockReason
  title?: string
  message?: string
  /** Where to come back to after signing in (defaults to the current page). */
  redirect?: string
  compact?: boolean
}>(), { title: undefined, message: undefined, redirect: undefined, compact: false })

const emit = defineEmits<{
  /** A call-to-action link was followed (dialogs close on it). */
  navigate: []
  /** The entitlement was refreshed and is now active — reload the content. */
  unlocked: []
}>()

const { t } = useI18n()
const route = useRoute()
const auth = useAuthStore()
const refreshing = ref(false)
const stillLocked = ref(false)

const isLogin = computed(() => props.reason === 'login_required')
const heading = computed(() => props.title ?? (isLogin.value ? t('paywall.loginTitle') : t('paywall.subscribeTitle')))
const body = computed(() => props.message ?? (isLogin.value ? t('paywall.loginMessage') : t('paywall.subscribeMessage')))
const loginTo = computed(() => ({ name: 'auth', query: { redirect: props.redirect ?? route.fullPath } }))

async function refreshEntitlement() {
  refreshing.value = true
  stillLocked.value = false
  try {
    await auth.refresh()
    if (auth.isSubscribed) emit('unlocked')
    else stillLocked.value = true
  } catch {
    stillLocked.value = true
  } finally {
    refreshing.value = false
  }
}
</script>

<template>
  <div
    :class="[
      'rounded-2xl border text-center',
      compact ? 'p-4' : 'p-6 sm:p-8',
      isLogin
        ? 'border-brand-100 bg-brand-50/70 dark:border-brand-900/50 dark:bg-brand-950/20'
        : 'border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/20',
    ]"
    role="region"
    :aria-label="heading"
    :data-reason="reason"
    data-testid="paywall"
  >
    <div :class="compact ? 'text-3xl mb-2' : 'text-4xl mb-3'" aria-hidden="true">{{ isLogin ? '🔐' : '👑' }}</div>
    <p class="font-semibold text-gray-900 dark:text-white mb-1">{{ heading }}</p>
    <p class="text-sm text-gray-600 dark:text-gray-300 mb-4 max-w-md mx-auto">{{ body }}</p>

    <div class="flex flex-wrap items-center justify-center gap-2">
      <template v-if="isLogin">
        <RouterLink :to="loginTo" class="btn-primary" data-testid="paywall-login" @click="emit('navigate')">
          {{ t('paywall.loginAction') }}
        </RouterLink>
        <RouterLink to="/subscription" class="btn-ghost" @click="emit('navigate')">
          {{ t('paywall.subscribeAction') }}
        </RouterLink>
      </template>
      <template v-else>
        <RouterLink to="/subscription" class="btn-primary" data-testid="paywall-subscribe" @click="emit('navigate')">
          👑 {{ t('paywall.subscribeAction') }}
        </RouterLink>
        <button
          v-if="auth.isLoggedIn"
          type="button"
          class="btn-ghost"
          :disabled="refreshing"
          @click="refreshEntitlement"
        >
          {{ refreshing ? t('common.loading') : t('paywall.refresh') }}
        </button>
      </template>
    </div>

    <p v-if="!isLogin" class="mt-3 text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
      {{ t('paywall.subscribeHint') }}
    </p>
    <p v-if="stillLocked" class="mt-2 text-xs text-amber-700 dark:text-amber-300" role="status">
      {{ t('paywall.stillLocked') }}
    </p>
    <slot />
  </div>
</template>
