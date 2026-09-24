<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import type { Id, ItemType } from '@loikmon/api'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'

/** Save / unsave a book or article in the user's (server-side) library. */
const props = withDefaults(defineProps<{
  itemType: ItemType
  itemId: Id | string
  /** `in_library` from a detail response, when known. */
  inLibrary?: boolean
  variant?: 'button' | 'icon'
}>(), { inLibrary: undefined, variant: 'button' })

const emit = defineEmits<{ change: [inLibrary: boolean] }>()

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const library = useLibraryStore()
const busy = ref(false)
const failed = ref(false)

watch(
  () => [props.itemId, props.inLibrary] as const,
  ([id, inLibrary]) => {
    if (inLibrary !== undefined) library.markSaved(props.itemType, id, inLibrary)
  },
  { immediate: true },
)

const saved = computed(() => library.isSaved(props.itemType, props.itemId))
const label = computed(() => (saved.value ? t('library.removeFromLibrary') : t('library.saveToLibrary')))

async function toggle(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  if (!auth.isLoggedIn) {
    void router.push({ name: 'auth', query: { redirect: route.fullPath } })
    return
  }
  busy.value = true
  failed.value = false
  try {
    emit('change', await library.toggle(props.itemType, props.itemId))
  } catch {
    failed.value = true
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button
    v-if="variant === 'icon'"
    type="button"
    class="p-1.5 rounded-lg transition-colors text-base leading-none"
    :class="saved
      ? 'text-brand-500 hover:bg-brand-50 dark:hover:bg-surface-700'
      : 'text-gray-400 hover:text-brand-500 hover:bg-gray-100 dark:hover:bg-surface-700'"
    :title="failed ? t('library.saveFailed') : label"
    :aria-label="label"
    :aria-pressed="saved"
    :disabled="busy"
    @click="toggle"
  >
    {{ saved ? '🔖' : '☆' }}
  </button>
  <button
    v-else
    type="button"
    :class="saved ? 'btn-secondary' : 'btn-ghost border border-gray-200 dark:border-surface-700'"
    :aria-pressed="saved"
    :disabled="busy"
    :title="failed ? t('library.saveFailed') : undefined"
    @click="toggle"
  >
    {{ saved ? '🔖' : '☆' }} {{ busy ? t('common.saving') : saved ? t('library.saved') : t('library.save') }}
  </button>
</template>
