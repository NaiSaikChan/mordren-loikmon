<script setup lang="ts">
import { computed } from 'vue'
import type { MediaAsset } from '@loikmon/api'
import { formatBytes } from '@loikmon/media-standards'
import MediaThumb from '@/cms/components/MediaThumb.vue'

/** One tile in the media library grid and the "choose from library" dialog. */
const props = withDefaults(
  defineProps<{
    asset: MediaAsset
    selected?: boolean
    selectable?: boolean
    /** Shown instead of the usage badge when the asset cannot be picked here. */
    disabledReason?: string | null
  }>(),
  { selected: false, selectable: false, disabledReason: null },
)

const emit = defineEmits<{ open: [asset: MediaAsset]; toggle: [asset: MediaAsset] }>()

const icon = computed(() => (props.asset.category === 'audio' ? '🎧' : props.asset.format === 'epub' ? '📘' : '📄'))
const dimensions = computed(() => (props.asset.width && props.asset.height ? `${props.asset.width}×${props.asset.height}` : props.asset.format.toUpperCase()))
</script>

<template>
  <div
    class="group relative overflow-hidden rounded-xl border bg-white transition dark:bg-surface-900"
    :class="[
      selected ? 'border-brand-500 ring-2 ring-brand-500/40' : 'border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700',
      disabledReason ? 'opacity-60' : '',
    ]"
  >
    <button
      type="button"
      class="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      :aria-label="`Open ${asset.original_name}`"
      :title="disabledReason ?? asset.original_name"
      @click="emit('open', asset)"
    >
      <div class="grid aspect-square place-items-center bg-gray-50 p-2 dark:bg-gray-800/60">
        <MediaThumb
          v-if="asset.category === 'image'"
          :image="asset.image"
          :alt="asset.alt_text ?? ''"
          :width="150"
          :shape="asset.display === 'circle' ? 'circle' : 'rounded'"
          :placeholder-color="asset.dominant_color"
          fit="contain"
          class="max-h-full"
        />
        <span v-else class="text-4xl" aria-hidden="true">{{ icon }}</span>
      </div>
      <div class="space-y-0.5 px-2.5 py-2">
        <p class="truncate text-xs font-medium text-gray-800 dark:text-gray-100">{{ asset.title || asset.original_name }}</p>
        <p class="truncate text-[11px] text-gray-500 dark:text-gray-400">
          {{ dimensions }} · {{ formatBytes(asset.size_bytes) }}
        </p>
        <p class="truncate text-[11px]">
          <span v-if="disabledReason" class="text-amber-600 dark:text-amber-400">{{ disabledReason }}</span>
          <span v-else-if="asset.usage_count" class="text-emerald-600 dark:text-emerald-400">Used {{ asset.usage_count }}×</span>
          <span v-else-if="asset.usage_count === 0" class="text-gray-400">Unused</span>
          <span v-else class="text-gray-400">{{ asset.asset_type_label }}</span>
        </p>
      </div>
    </button>

    <label
      v-if="selectable"
      class="absolute left-2 top-2 grid h-6 w-6 cursor-pointer place-items-center rounded-md bg-white/90 shadow-sm transition dark:bg-gray-900/90"
      :class="selected ? 'opacity-100' : 'opacity-0 focus-within:opacity-100 group-hover:opacity-100'"
    >
      <input type="checkbox" class="rounded text-brand-600" :checked="selected" :aria-label="`Select ${asset.original_name}`" @change="emit('toggle', asset)" />
    </label>
  </div>
</template>
