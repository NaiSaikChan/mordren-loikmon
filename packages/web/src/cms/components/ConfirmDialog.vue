<script setup lang="ts">
import { useConfirm } from '@/cms/composables/useCmsUi'
import ModalDialog from './ModalDialog.vue'

/** Renders whatever `useConfirm().confirm()` is waiting on. Mounted once. */
const { pending, answer } = useConfirm()
</script>

<template>
  <ModalDialog
    :open="Boolean(pending)"
    size="sm"
    :title="pending?.title ?? ''"
    @close="answer(false)"
    @submit="answer(true)"
  >
    <p class="text-sm text-gray-600 dark:text-gray-300">{{ pending?.message }}</p>

    <template #footer>
      <button type="button" class="btn-secondary" @click="answer(false)">Cancel</button>
      <button type="submit" :class="pending?.danger ? 'btn-danger' : 'btn-primary'">
        {{ pending?.confirmLabel ?? 'Confirm' }}
      </button>
    </template>
  </ModalDialog>
</template>
