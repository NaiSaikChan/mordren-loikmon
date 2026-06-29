<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { usePurchasesStore } from '@/stores/purchases'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const { t } = useI18n()
const authStore = useAuthStore()
const store = usePurchasesStore()

const couponCode = ref('')
const couponMsg  = ref('')
const couponBookId = ref('')

async function redeemCoupon() {
  if (!couponCode.value) return
  try {
    const res = await store.redeemCoupon(couponCode.value, couponBookId.value || '0')
    couponMsg.value = res.message ?? (res.status === 'ok' ? 'Redeemed successfully!' : 'Failed')
  } catch {
    couponMsg.value = 'Error redeeming coupon'
  }
}

onMounted(async () => {
  if (authStore.isLoggedIn) {
    await store.fetchAll()
    await store.fetchCoinPackages()
  }
})
</script>

<template>
  <div class="page-wrapper max-w-3xl">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ t('purchases.title') }}</h1>

    <!-- Not logged in -->
    <div v-if="!authStore.isLoggedIn" class="card p-12 text-center text-gray-400">
      <div class="text-6xl mb-4">🪙</div>
      <p class="mb-4">Login to view your purchases and coins</p>
      <RouterLink to="/auth" class="btn-primary inline-flex">Login</RouterLink>
    </div>

    <div v-else>
      <LoadingSpinner v-if="store.loading" />

      <div v-else class="space-y-6">
        <!-- Coin balance -->
        <div class="card p-6 flex items-center gap-5">
          <div class="w-16 h-16 rounded-2xl bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center text-3xl">🪙</div>
          <div>
            <p class="text-sm text-gray-400">{{ t('purchases.coins') }}</p>
            <p class="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{{ store.coinBalance }}</p>
          </div>
        </div>

        <!-- Coin packages -->
        <div v-if="store.coinPackages.length">
          <h2 class="font-semibold text-gray-800 dark:text-gray-200 mb-3">{{ t('purchases.buyCoins') }}</h2>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div v-for="pkg in store.coinPackages" :key="pkg.id"
              class="card p-4 text-center hover:border-brand-400 cursor-pointer transition-colors">
              <div class="text-2xl font-bold text-brand-600 dark:text-brand-400">{{ pkg.coins }}</div>
              <div class="text-sm text-gray-400 mt-0.5">coins</div>
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">{{ pkg.price ?? pkg.amount }}</div>
            </div>
          </div>
        </div>

        <!-- Redeem coupon -->
        <div class="card p-6">
          <h2 class="font-semibold text-gray-800 dark:text-gray-200 mb-4">{{ t('purchases.redeemCoupon') }}</h2>
          <div class="flex gap-2">
            <input v-model="couponCode" class="input flex-1" placeholder="Enter coupon code" />
            <button class="btn-primary" @click="redeemCoupon">Redeem</button>
          </div>
          <p v-if="couponMsg" :class="['text-sm mt-2', couponMsg.includes('success') ? 'text-green-500' : 'text-red-400']">
            {{ couponMsg }}
          </p>
        </div>

        <!-- Purchased books list -->
        <div v-if="store.books.length">
          <h2 class="font-semibold text-gray-800 dark:text-gray-200 mb-3">Purchased Books ({{ store.books.length }})</h2>
          <div class="space-y-2">
            <RouterLink v-for="b in store.books" :key="b.id" :to="`/books/${b.id}`"
              class="card p-3 flex items-center gap-3 hover:border-brand-400 transition-colors">
              <div class="text-xl">📚</div>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ b.title ?? b.name ?? b }}</span>
            </RouterLink>
          </div>
        </div>

        <!-- Purchased articles list -->
        <div v-if="store.articles.length">
          <h2 class="font-semibold text-gray-800 dark:text-gray-200 mb-3">Purchased Articles ({{ store.articles.length }})</h2>
          <div class="space-y-2">
            <RouterLink v-for="a in store.articles" :key="a.id" :to="`/articles/${a.id}`"
              class="card p-3 flex items-center gap-3 hover:border-brand-400 transition-colors">
              <div class="text-xl">📰</div>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ a.title ?? a.name ?? a }}</span>
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
