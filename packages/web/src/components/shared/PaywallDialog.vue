<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { usePaywallStore } from '@/stores/paywall'
import Paywall from './Paywall.vue'

const { t } = useI18n()
const paywall = usePaywallStore()
</script>

<template>
  <Transition name="fade">
    <div
      v-if="paywall.reason"
      class="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      @click.self="paywall.close()"
      @keydown.esc="paywall.close()"
    >
      <div class="relative w-full max-w-md rounded-3xl bg-white p-2 shadow-2xl dark:bg-surface-900">
        <button
          type="button"
          class="absolute right-3 top-3 z-10 h-8 w-8 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-surface-800"
          :aria-label="t('common.close')"
          @click="paywall.close()"
        >✕</button>
        <Paywall :reason="paywall.reason" @navigate="paywall.close()" @unlocked="paywall.close()" />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
