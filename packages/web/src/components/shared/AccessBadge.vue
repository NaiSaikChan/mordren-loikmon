<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { isLocked } from '@loikmon/api'
import { useAuthStore } from '@/stores/auth'

/**
 * Free / Premium badge for list items. Only a hint for the viewer: the server
 * still decides access when the item is opened.
 */
const props = withDefaults(defineProps<{ item: { is_free?: boolean }; size?: 'xs' | 'sm' }>(), { size: 'xs' })
const { t } = useI18n()
const auth = useAuthStore()

const free = computed(() => Boolean(props.item.is_free))
const locked = computed(() => isLocked(props.item, auth.entitlement))
const sizeClass = computed(() => (props.size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-xs'))
</script>

<template>
  <span
    v-if="free"
    :class="['inline-flex items-center rounded-full bg-emerald-500 font-bold text-white', sizeClass]"
    data-testid="badge-free"
  >{{ t('access.free') }}</span>
  <span
    v-else
    :class="[
      'inline-flex items-center gap-1 rounded-full font-bold',
      sizeClass,
      locked ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    ]"
    :title="locked ? t('access.locked') : undefined"
    data-testid="badge-premium"
    :data-locked="locked ? 'true' : 'false'"
  >
    <span aria-hidden="true">👑</span>
    <span>{{ t('access.premium') }}</span>
    <span v-if="locked" aria-hidden="true">🔒</span>
    <span v-if="locked" class="sr-only">{{ t('access.locked') }}</span>
  </span>
</template>
