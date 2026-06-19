<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>
<template>
  <div class="page-wrapper">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ t('purchases.title') }}</h1>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      <div class="card p-5 text-center">
        <div class="text-3xl mb-2">🪙</div>
        <div class="font-bold text-xl text-brand-600 dark:text-brand-400">0</div>
        <div class="text-sm text-gray-400">{{ t('purchases.coins') }}</div>
        <button class="btn-primary mt-3 w-full justify-center text-sm">{{ t('purchases.buyCoins') }}</button>
      </div>
      <div class="card p-5">
        <h3 class="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">{{ t('purchases.pending') }}</h3>
        <p class="text-sm text-gray-400 text-center py-4">No pending purchases</p>
      </div>
      <div class="card p-5">
        <h3 class="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">{{ t('purchases.redeemCoupon') }}</h3>
        <input class="input mb-2" placeholder="Enter coupon code" />
        <button class="btn-primary w-full justify-center text-sm">{{ t('purchases.redeemCoupon') }}</button>
      </div>
    </div>
  </div>
</template>
