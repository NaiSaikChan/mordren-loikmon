<script setup lang="ts">
import { useToastStore } from '@/cms/stores/toast'

/** Live region for CMS notifications. Mounted once by CmsLayout. */
const toasts = useToastStore()

const tone: Record<string, string> = {
  success: 'border-green-500/40 bg-green-50 text-green-900 dark:bg-green-900/25 dark:text-green-100',
  error: 'border-red-500/40 bg-red-50 text-red-900 dark:bg-red-900/25 dark:text-red-100',
  info: 'border-brand-500/40 bg-brand-50 text-brand-900 dark:bg-brand-900/25 dark:text-brand-100',
}
const icon: Record<string, string> = { success: '✓', error: '!', info: 'i' }
</script>

<template>
  <div
    class="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 print:hidden"
    role="status"
    aria-live="polite"
  >
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts.toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg"
        :class="tone[toast.kind]"
      >
        <span
          class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-current/15 text-xs font-bold"
          aria-hidden="true"
        >{{ icon[toast.kind] }}</span>
        <div class="min-w-0 flex-1 leading-snug">
          <p class="text-sm font-medium break-words">{{ toast.message }}</p>
          <p v-if="toast.detail" class="mt-0.5 text-xs opacity-75 break-words">{{ toast.detail }}</p>
        </div>
        <button
          type="button"
          class="-mr-1 -mt-1 rounded p-1 text-lg leading-none opacity-60 hover:opacity-100"
          aria-label="Dismiss notification"
          @click="toasts.dismiss(toast.id)"
        >
          ×
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>
