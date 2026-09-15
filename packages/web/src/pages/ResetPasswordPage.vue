<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { auth as authApi, errorMessage } from '@loikmon/api'
import logoUrl from '@/assets/logo.png'

/** Target of the password-reset email: `/auth/reset-password?token=…` */
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const form = reactive({ password: '', confirmPassword: '' })
const busy = ref(false)
const done = ref(false)
const errorMsg = ref('')

async function submit() {
  errorMsg.value = ''
  if (form.password !== form.confirmPassword) {
    errorMsg.value = t('auth.passwordMismatch')
    return
  }
  busy.value = true
  try {
    await authApi.confirmPasswordReset(token.value, form.password)
    done.value = true
    form.password = ''
    form.confirmPassword = ''
  } catch (err) {
    errorMsg.value = errorMessage(err, t('common.error'))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-[linear-gradient(135deg,_#f6f0ff_0%,_#eef4ff_38%,_#f7fafc_100%)] dark:bg-[linear-gradient(135deg,_#0b1020_0%,_#111827_40%,_#020617_100%)]">
    <div class="w-full max-w-md">
      <div class="mb-8 text-center">
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow ring-1 ring-brand-200 dark:bg-surface-900 dark:ring-brand-800/60">
          <img :src="logoUrl" alt="Loikmon" class="h-full w-full object-contain" />
        </div>
        <h1 class="text-2xl font-black tracking-tight text-gray-900 dark:text-white">{{ t('auth.resetPasswordTitle') }}</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('auth.resetPasswordSubtitle') }}</p>
      </div>

      <div class="rounded-[28px] border border-white/60 bg-white/85 p-5 shadow-[0_25px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl dark:border-surface-700 dark:bg-surface-900/85 sm:p-7">
        <!-- Missing token -->
        <div v-if="!token" class="space-y-4 text-center" data-testid="reset-missing-token">
          <p class="text-sm text-red-600 dark:text-red-300">{{ t('auth.resetPasswordMissingToken') }}</p>
          <RouterLink :to="{ name: 'auth', query: { mode: 'forgot' } }" class="btn-primary inline-flex">{{ t('auth.requestNewLink') }}</RouterLink>
        </div>

        <!-- Success -->
        <div v-else-if="done" class="space-y-4 text-center" data-testid="reset-success">
          <div class="text-4xl" aria-hidden="true">✅</div>
          <p class="text-sm text-emerald-700 dark:text-emerald-300">{{ t('auth.resetPasswordSuccess') }}</p>
          <button type="button" class="btn-primary" @click="router.push({ name: 'auth' })">{{ t('auth.login') }}</button>
        </div>

        <form v-else class="space-y-4" @submit.prevent="submit">
          <div v-if="errorMsg" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300" role="alert">
            {{ errorMsg }}
            <RouterLink :to="{ name: 'auth', query: { mode: 'forgot' } }" class="mt-1 block font-medium underline">{{ t('auth.requestNewLink') }}</RouterLink>
          </div>
          <div>
            <label for="reset-password" class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('auth.newPassword') }}</label>
            <input id="reset-password" v-model="form.password" type="password" autocomplete="new-password" minlength="8" class="input" required />
            <p class="mt-1 text-xs text-gray-400">{{ t('auth.passwordHint') }}</p>
          </div>
          <div>
            <label for="reset-confirm" class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('auth.passwordConfirmation') }}</label>
            <input id="reset-confirm" v-model="form.confirmPassword" type="password" autocomplete="new-password" minlength="8" class="input" required />
          </div>
          <button type="submit" class="btn-primary w-full justify-center rounded-xl py-3" :disabled="busy">
            {{ busy ? t('common.loading') : t('auth.resetPassword') }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
