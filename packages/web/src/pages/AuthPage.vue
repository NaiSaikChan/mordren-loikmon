<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import logoUrl from '@/assets/logo.png'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

type Mode = 'login' | 'register' | 'forgot'
const mode = ref<Mode>('login')

const form = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
})
const errorMsg = ref('')
const successMsg = ref('')

function switchMode(nextMode: Mode) {
  mode.value = nextMode
  errorMsg.value = ''
  successMsg.value = ''
}

async function handleSubmit() {
  errorMsg.value = ''
  successMsg.value = ''
  try {
    if (mode.value === 'login') {
      await authStore.login({ email: form.email, password: form.password })
      const redirect = (route.query.redirect as string) ?? '/'
      router.push(redirect)
    } else if (mode.value === 'register') {
      if (form.password !== form.confirmPassword) {
        errorMsg.value = 'Passwords do not match'; return
      }
      await authStore.register({
        name: form.name, email: form.email,
        password: form.password, password_confirmation: form.confirmPassword,
      })
      router.push('/')
    } else {
      successMsg.value = 'Password reset link sent to your email.'
    }
  } catch (err: unknown) {
    errorMsg.value = (typeof err === 'string' ? err : (err as Error)?.message) ?? 'Unknown error'
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
        <h1 class="text-3xl font-black tracking-tight text-gray-900 dark:text-white">Loikmon</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Mon Digital Library</p>
      </div>

      <div class="overflow-hidden rounded-[28px] border border-white/60 bg-white/85 p-5 shadow-[0_25px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl dark:border-surface-700 dark:bg-surface-900/85 sm:p-7">
        <button
          type="button"
          class="mb-5 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:border-brand-200 hover:text-brand-700 dark:border-surface-700 dark:bg-surface-800 dark:text-gray-300 dark:hover:border-brand-800 dark:hover:text-brand-300"
          @click="router.push('/')"
        >
          <span>←</span>
          <span>Back to Home</span>
        </button>

        <div class="mb-6 flex rounded-2xl bg-gray-100 p-1 dark:bg-surface-800">
          <button
            v-for="m in (['login', 'register'] as const)"
            :key="m"
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

        <div v-if="errorMsg" class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {{ errorMsg }}
        </div>
        <div v-if="successMsg" class="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
          {{ successMsg }}
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div v-if="mode === 'register'">
            <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('auth.name') }}</label>
            <input v-model="form.name" type="text" class="input" placeholder="Your full name" required />
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('auth.email') }}</label>
            <input v-model="form.email" type="email" class="input" placeholder="you@example.com" required />
          </div>

          <div v-if="mode !== 'forgot'">
            <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('auth.password') }}</label>
            <input v-model="form.password" type="password" class="input" placeholder="••••••••" required />
          </div>

          <div v-if="mode === 'register'">
            <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('auth.confirmPassword') }}</label>
            <input v-model="form.confirmPassword" type="password" class="input" placeholder="Confirm your password" required />
          </div>

          <div v-if="mode === 'login'" class="text-right">
            <button type="button" class="text-sm font-medium text-brand-600 transition-colors hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300" @click="switchMode('forgot')">
              {{ t('auth.forgotPassword') }}
            </button>
          </div>

          <button
            type="submit"
            class="btn-primary w-full justify-center rounded-xl py-3 text-base font-semibold shadow-[0_14px_35px_rgba(79,70,229,0.28)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
            :disabled="authStore.loading"
          >
            <span v-if="authStore.loading">{{ t('common.loading') }}</span>
            <span v-else-if="mode === 'login'">{{ t('auth.login') }}</span>
            <span v-else-if="mode === 'register'">{{ t('auth.register') }}</span>
            <span v-else>{{ t('auth.resetPassword') }}</span>
          </button>

          <div v-if="mode === 'forgot'" class="pt-1 text-center">
            <button type="button" class="text-sm font-medium text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" @click="switchMode('login')">
              ← {{ t('auth.hasAccount') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
