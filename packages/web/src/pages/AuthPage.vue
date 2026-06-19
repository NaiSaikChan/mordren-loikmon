<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

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
  <div class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-brand-50 to-indigo-100 dark:from-surface-950 dark:to-surface-900">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 text-white text-3xl mb-4 shadow-lg">📚</div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Loikmon</h1>
        <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">Mon Digital Library</p>
      </div>

      <div class="card p-8">
        <!-- Tabs -->
        <div class="flex gap-1 mb-6 p-1 bg-gray-100 dark:bg-surface-800 rounded-xl">
          <button
            v-for="m in (['login', 'register'] as const)"
            :key="m"
            :class="['flex-1 py-1.5 text-sm font-medium rounded-lg transition-all',
              mode === m
                ? 'bg-white dark:bg-surface-700 text-brand-700 dark:text-brand-300 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300']"
            @click="mode = m; errorMsg = ''"
          >
            {{ m === 'login' ? t('auth.login') : t('auth.register') }}
          </button>
        </div>

        <!-- Error / success -->
        <div v-if="errorMsg" class="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-sm">
          {{ errorMsg }}
        </div>
        <div v-if="successMsg" class="mb-4 px-4 py-3 rounded-lg bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-sm">
          {{ successMsg }}
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <!-- Name (register only) -->
          <div v-if="mode === 'register'">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('auth.name') }}</label>
            <input v-model="form.name" type="text" class="input" required />
          </div>

          <!-- Email -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('auth.email') }}</label>
            <input v-model="form.email" type="email" class="input" required />
          </div>

          <!-- Password -->
          <div v-if="mode !== 'forgot'">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('auth.password') }}</label>
            <input v-model="form.password" type="password" class="input" required />
          </div>

          <!-- Confirm password (register only) -->
          <div v-if="mode === 'register'">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('auth.confirmPassword') }}</label>
            <input v-model="form.confirmPassword" type="password" class="input" required />
          </div>

          <!-- Forgot password link -->
          <div v-if="mode === 'login'" class="text-right">
            <button type="button" class="text-sm text-brand-600 hover:text-brand-500 dark:text-brand-400" @click="mode = 'forgot'">
              {{ t('auth.forgotPassword') }}
            </button>
          </div>

          <button
            type="submit"
            class="btn-primary w-full justify-center py-2.5"
            :disabled="authStore.loading"
          >
            <span v-if="authStore.loading">{{ t('common.loading') }}</span>
            <span v-else-if="mode === 'login'">{{ t('auth.login') }}</span>
            <span v-else-if="mode === 'register'">{{ t('auth.register') }}</span>
            <span v-else>{{ t('auth.resetPassword') }}</span>
          </button>

          <button v-if="mode === 'forgot'" type="button" class="w-full text-center text-sm text-gray-500 hover:text-gray-700" @click="mode = 'login'">
            ← {{ t('auth.hasAccount') }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
