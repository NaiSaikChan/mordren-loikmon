import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { LockReason } from '@/utils/access'

/** Global paywall dialog, opened from places that have no room for an inline paywall (cards, audio player). */
export const usePaywallStore = defineStore('paywall', () => {
  const reason = ref<LockReason | null>(null)

  function open(next: LockReason) {
    reason.value = next
  }

  function close() {
    reason.value = null
  }

  return { reason, open, close }
})
