<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { auth as authApi, errorCode, errorMessage } from '@loikmon/api'
import { useAuthStore } from '@/stores/auth'
import { safeRedirect } from '@/utils/access'
import logoUrl from '@/assets/logo.png'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

type Mode = 'login' | 'register' | 'forgot'
const mode = ref<Mode>(route.query.mode === 'forgot' ? 'forgot' : route.query.mode === 'register' ? 'register' : 'login')

const form = reactive({
  name: '',
  email: typeof route.query.email === 'string' ? route.query.email : '',
  password: '',
  confirmPassword: '',
})
const errorMsg = ref('')
const successMsg = ref('')
const busy = ref(false)
/** Offer to resend the verification email after EMAIL_NOT_VERIFIED / sign-up. */
const canResendVerification = ref(false)

onMounted(() => {
  if (route.query.verified) successMsg.value = t('auth.emailVerified')
})

function switchMode(nextMode: Mode) {
  mode.value = nextMode
  errorMsg.value = ''
  successMsg.value = ''
  canResendVerification.value = false
}

function redirectTarget() {
  return safeRedirect(route.query.redirect)
}

async function handleSubmit() {
  errorMsg.value = ''
  successMsg.value = ''
  canResendVerification.value = false
  busy.value = true
  try {
    if (mode.value === 'login') {
      await authStore.login({ email: form.email.trim(), password: form.password })
      await router.push(redirectTarget())
    } else if (mode.value === 'register') {
      if (form.password !== form.confirmPassword) {
        errorMsg.value = t('auth.passwordMismatch')
        return
      }
      const result = await authStore.register({
        name: form.name.trim() || undefined,
        email: form.email.trim(),
        password: form.password,
      })
      if (result.requiresEmailVerification) {
        mode.value = 'login'
        form.password = ''
        form.confirmPassword = ''
        successMsg.value = t('auth.verifyEmailSent')
        canResendVerification.value = true
      } else {
        await router.push(redirectTarget())
      }
    } else {
      const { data } = await authApi.forgotPassword(form.email.trim())
      successMsg.value = data.message ?? t('auth.resetLinkSent')
    }
  } catch (err) {
    if (errorCode(err) === 'EMAIL_NOT_VERIFIED') {
      errorMsg.value = t('auth.emailNotVerified')
      canResendVerification.value = true
    } else {
      errorMsg.value = errorMessage(err, t('common.error'))
    }
  } finally {
    busy.value = false
  }
}

async function resendVerification() {
  if (!form.email.trim()) return
  busy.value = true
  try {
    await authApi.resendVerifyLink(form.email.trim())
    errorMsg.value = ''
    successMsg.value = t('auth.verificationResent')
    canResendVerification.value = false
  } catch (err) {
    errorMsg.value = errorMessage(err, t('common.error'))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.12),_transparent_25%),linear-gradient(135deg,_#f6f0ff_0%,_#eef4ff_38%,_#f7fafc_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.12),_transparent_25%),linear-gradient(135deg,_#0b1020_0%,_#111827_40%,_#020617_100%)]">
    <div class="w-full max-w-md">
      <div class="mb-8 text-center">
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow-[0_18px_45px_rgba(59,130,246,0.18)] ring-1 ring-brand-200 dark:bg-surface-900 dark:ring-brand-800/60">
          <img :src="logoUrl" alt="Loikmon" class="h-full w-full object-contain" />
        </div>
        <h1 class="text-3xl font-black tracking-tight text-gray-900 dark:text-white">{{ t('app.name') }}</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('app.tagline') }}</p>
      </div>

      <div class="overflow-hidden rounded-[28px] border border-white/60 bg-white/85 p-5 shadow-[0_25px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl dark:border-surface-700 dark:bg-surface-900/85 sm:p-7">
        <button
          type="button"
          class="mb-5 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:border-brand-200 hover:text-brand-700 dark:border-surface-700 dark:bg-surface-800 dark:text-gray-300 dark:hover:border-brand-800 dark:hover:text-brand-300"
          @click="router.push('/')"
        >
          <span>←</span>
          <span>{{ t('auth.backToHome') }}</span>
        </button>

        <div v-if="mode !== 'forgot'" class="mb-6 flex rounded-2xl bg-gray-100 p-1 dark:bg-surface-800">
          <button
            v-for="m in (['login', 'register'] as const)"
            :key="m"
            type="button"
            :class="[
              'flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
              mode === m
                ? 'bg-white text-brand-700 shadow-[0_4px_14px_rgba(15,23,42,0.08)] dark:bg-surface-700 dark:text-brand-300'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            ]"
            @click="switchMode(m)"
          >
            {{ m === 'login' ? t('auth.login') : t('auth.register') }}
          </button>
        </div>
        <div v-else class="mb-6">
          <h2 class="text-lg font-bold text-gray-900 dark:text-white">{{ t('auth.resetPassword') }}</h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('auth.forgotPasswordHint') }}</p>
        </div>

        <div v-if="errorMsg" class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300" role="alert" data-testid="auth-error">
          {{ errorMsg }}
        </div>
        <div v-if="successMsg" class="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300" role="status" data-testid="auth-success">
          {{ successMsg }}
        </div>
        <div v-if="canResendVerification" class="mb-4 text-right">
          <button type="button" class="text-sm font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400" :disabled="busy" @click="resendVerification">
            {{ t('auth.resendVerification') }}
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div v-if="mode === 'register'">
            <label for="auth-name" class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('auth.name') }}</label>
            <input id="auth-name" v-model="form.name" type="text" autocomplete="name" class="input" :placeholder="t('auth.namePlaceholder')" required />
          </div>

          <div>
            <label for="auth-email" class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('auth.email') }}</label>
            <input id="auth-email" v-model="form.email" type="email" autocomplete="email" class="input" placeholder="you@example.com" required />
          </div>

          <div v-if="mode !== 'forgot'">
            <label for="auth-password" class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('auth.password') }}</label>
            <input
              id="auth-password"
              v-model="form.password"
              type="password"
              class="input"
              placeholder="••••••••"
              :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
              :minlength="mode === 'register' ? 8 : undefined"
              required
            />
            <p v-if="mode === 'register'" class="mt-1 text-xs text-gray-400">{{ t('auth.passwordHint') }}</p>
          </div>

          <div v-if="mode === 'register'">
            <label for="auth-confirm" class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('auth.passwordConfirmation') }}</label>
            <input id="auth-confirm" v-model="form.confirmPassword" type="password" autocomplete="new-password" class="input" minlength="8" required />
          </div>

          <div v-if="mode === 'login'" class="text-right">
            <button type="button" class="text-sm font-medium text-brand-600 transition-colors hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300" @click="switchMode('forgot')">
              {{ t('auth.forgotPassword') }}
            </button>
          </div>

          <button
            type="submit"
            class="btn-primary w-full justify-center rounded-xl py-3 text-base font-semibold shadow-[0_14px_35px_rgba(79,70,229,0.28)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
            :disabled="busy"
          >
            <span v-if="busy">{{ t('common.loading') }}</span>
            <span v-else-if="mode === 'login'">{{ t('auth.login') }}</span>
            <span v-else-if="mode === 'register'">{{ t('auth.register') }}</span>
            <span v-else>{{ t('auth.sendResetLink') }}</span>
          </button>

          <div v-if="mode === 'forgot'" class="pt-1 text-center">
            <button type="button" class="text-sm font-medium text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" @click="switchMode('login')">
              ← {{ t('auth.backToLogin') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
