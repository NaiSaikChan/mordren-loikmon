<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { errorMessage } from '@loikmon/api'
import { useAuthStore } from '@/stores/auth'
import { STORE_MANAGE_URLS } from '@/config'
import SettingsSection from './SettingsSection.vue'

type Store = keyof typeof STORE_MANAGE_URLS

const { t } = useI18n()
const route = useRoute()
const auth = useAuthStore()

// ── Profile ──────────────────────────────────────────────────────────────────
const profile = reactive({ name: '', phone: '' })
const profileBusy = ref(false)
const profileMsg = ref<{ ok: boolean; text: string } | null>(null)

watch(
  () => auth.user,
  (user) => {
    profile.name = user?.name ?? ''
    profile.phone = user?.phone ?? ''
  },
  { immediate: true },
)

async function saveProfile() {
  profileBusy.value = true
  profileMsg.value = null
  try {
    await auth.updateProfile({ name: profile.name.trim(), phone: profile.phone.trim() || null })
    profileMsg.value = { ok: true, text: t('settings.profileSaved') }
  } catch (err) {
    profileMsg.value = { ok: false, text: errorMessage(err, t('common.error')) }
  } finally {
    profileBusy.value = false
  }
}

// ── Password ─────────────────────────────────────────────────────────────────
const password = reactive({ current: '', next: '', confirm: '' })
const passwordBusy = ref(false)
const passwordMsg = ref<{ ok: boolean; text: string } | null>(null)

async function changePassword() {
  passwordMsg.value = null
  if (password.next !== password.confirm) {
    passwordMsg.value = { ok: false, text: t('auth.passwordMismatch') }
    return
  }
  passwordBusy.value = true
  try {
    await auth.changePassword(password.current, password.next)
    password.current = ''
    password.next = ''
    password.confirm = ''
    passwordMsg.value = { ok: true, text: t('settings.passwordChanged') }
  } catch (err) {
    passwordMsg.value = { ok: false, text: errorMessage(err, t('common.error')) }
  } finally {
    passwordBusy.value = false
  }
}

// ── Delete account ───────────────────────────────────────────────────────────
const deletePassword = ref('')
const deleteBusy = ref(false)
const deleteError = ref('')
const deleted = ref(false)
/** Store whose subscription keeps renewing after deletion (the user must cancel it there). */
const renewingStore = ref<Store | null>(null)
const renewingStoreName = computed(() => (renewingStore.value ? t(`subscription.platforms.${renewingStore.value}`) : ''))

async function deleteAccount() {
  if (!deletePassword.value) return
  if (!window.confirm(t('settings.deleteAccountDescription'))) return
  deleteBusy.value = true
  deleteError.value = ''
  try {
    renewingStore.value = await auth.deleteAccount(deletePassword.value)
    deleted.value = true
    deletePassword.value = ''
  } catch (err) {
    deleteError.value = errorMessage(err, t('common.error'))
  } finally {
    deleteBusy.value = false
  }
}
</script>

<template>
  <SettingsSection icon="👤" :title="t('settings.account')" :description="t('settings.accountDescription')">
    <!-- Shown after deletion (the session is gone by then) -->
    <div v-if="deleted" class="space-y-3" data-testid="account-deleted">
      <p class="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
        {{ t('settings.accountDeleted') }}
      </p>
      <div
        v-if="renewingStore"
        class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
        role="alert"
        data-testid="store-subscription-notice"
      >
        <p>{{ t('settings.storeSubscriptionNotice', { store: renewingStoreName }) }}</p>
        <a :href="STORE_MANAGE_URLS[renewingStore]" target="_blank" rel="noopener" class="mt-2 inline-block font-semibold underline">
          {{ t('subscription.manageIn', { store: renewingStoreName }) }}
        </a>
      </div>
    </div>

    <div v-else-if="!auth.isLoggedIn" class="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400">
      <span>{{ t('settings.signInToManage') }}</span>
      <RouterLink :to="{ name: 'auth', query: { redirect: route.fullPath } }" class="btn-primary">{{ t('auth.login') }}</RouterLink>
    </div>

    <div v-else class="space-y-8">
      <!-- Profile -->
      <form class="space-y-3" @submit.prevent="saveProfile">
        <h3 class="text-sm font-bold text-gray-800 dark:text-gray-100">{{ t('settings.profile') }}</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('auth.email') }}: {{ auth.user?.email }}</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block text-sm">
            <span class="mb-1 block text-gray-600 dark:text-gray-300">{{ t('auth.name') }}</span>
            <input v-model="profile.name" class="input" autocomplete="name" maxlength="120" required />
          </label>
          <label class="block text-sm">
            <span class="mb-1 block text-gray-600 dark:text-gray-300">{{ t('auth.phone') }}</span>
            <input v-model="profile.phone" class="input" type="tel" autocomplete="tel" maxlength="32" />
          </label>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <button type="submit" class="btn-primary" :disabled="profileBusy">
            {{ profileBusy ? t('common.saving') : t('settings.saveProfile') }}
          </button>
          <RouterLink to="/subscription" class="btn-ghost">👑 {{ t('settings.subscriptionLink') }}</RouterLink>
          <p v-if="profileMsg" :class="['text-sm', profileMsg.ok ? 'text-emerald-600' : 'text-red-500']" role="status">{{ profileMsg.text }}</p>
        </div>
      </form>

      <!-- Password -->
      <form class="space-y-3 border-t border-gray-100 pt-6 dark:border-gray-800" @submit.prevent="changePassword">
        <h3 class="text-sm font-bold text-gray-800 dark:text-gray-100">{{ t('settings.changePassword') }}</h3>
        <div class="grid gap-3 sm:grid-cols-3">
          <label class="block text-sm">
            <span class="mb-1 block text-gray-600 dark:text-gray-300">{{ t('settings.currentPassword') }}</span>
            <input v-model="password.current" class="input" type="password" autocomplete="current-password" required />
          </label>
          <label class="block text-sm">
            <span class="mb-1 block text-gray-600 dark:text-gray-300">{{ t('settings.newPassword') }}</span>
            <input v-model="password.next" class="input" type="password" autocomplete="new-password" minlength="8" required />
          </label>
          <label class="block text-sm">
            <span class="mb-1 block text-gray-600 dark:text-gray-300">{{ t('settings.confirmNewPassword') }}</span>
            <input v-model="password.confirm" class="input" type="password" autocomplete="new-password" minlength="8" required />
          </label>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <button type="submit" class="btn-secondary" :disabled="passwordBusy">
            {{ passwordBusy ? t('common.saving') : t('settings.updatePassword') }}
          </button>
          <p v-if="passwordMsg" :class="['text-sm', passwordMsg.ok ? 'text-emerald-600' : 'text-red-500']" role="status">{{ passwordMsg.text }}</p>
        </div>
      </form>

      <!-- Delete account -->
      <form class="space-y-3 border-t border-gray-100 pt-6 dark:border-gray-800" @submit.prevent="deleteAccount">
        <h3 class="text-sm font-bold text-red-600 dark:text-red-400">{{ t('settings.deleteAccount') }}</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.deleteAccountDescription') }}</p>
        <label class="block max-w-sm text-sm">
          <span class="mb-1 block text-gray-600 dark:text-gray-300">{{ t('settings.deleteAccountPassword') }}</span>
          <input v-model="deletePassword" class="input" type="password" autocomplete="current-password" required />
        </label>
        <div class="flex flex-wrap items-center gap-3">
          <button type="submit" class="btn-danger" :disabled="deleteBusy || !deletePassword">
            {{ deleteBusy ? t('common.loading') : t('settings.deleteAccountAction') }}
          </button>
          <p v-if="deleteError" class="text-sm text-red-500" role="alert">{{ deleteError }}</p>
        </div>
      </form>
    </div>
  </SettingsSection>
</template>
