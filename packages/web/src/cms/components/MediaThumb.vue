<script setup lang="ts">
import { computed } from 'vue'
import type { ResponsiveImage } from '@loikmon/api'
import { IMAGE_STANDARDS, isImageAssetType, variantForWidth, type DisplayShape, type MediaAssetType } from '@loikmon/media-standards'

/**
 * A lazy-loaded thumbnail framed like the asset is displayed: the aspect ratio
 * and shape (circle for avatars) come from the asset standard, the pixels from
 * the smallest generated variant that fits.
 */
const props = withDefaults(
  defineProps<{
    /** Responsive descriptor from the API; preferred over `src`. */
    image?: ResponsiveImage | null
    /** Plain URL (a local object URL during upload, or a legacy key's URL). */
    src?: string | null
    assetType?: MediaAssetType | null
    alt?: string
    /** Rendered CSS width, used for the `sizes` hint. */
    width?: number
    shape?: DisplayShape
    placeholderColor?: string | null
    /** `contain` shows the whole image (icons, logos); `cover` fills the frame. */
    fit?: 'cover' | 'contain'
  }>(),
  { alt: '', width: 96 },
)

const standard = computed(() => (props.assetType && isImageAssetType(props.assetType) ? IMAGE_STANDARDS[props.assetType] : null))
const aspect = computed(() => (standard.value?.aspectRatio ? `${standard.value.aspectRatio.width} / ${standard.value.aspectRatio.height}` : '1 / 1'))
const shape = computed(() => props.shape ?? standard.value?.display ?? 'rounded')
const fit = computed(() => props.fit ?? standard.value?.fit ?? 'cover')

const src = computed(() => {
  if (props.src) return props.src
  if (!props.image) return null
  return props.image.variants[variantForWidth(props.width)] ?? props.image.src
})
const srcset = computed(() => (props.src ? undefined : (props.image?.srcset ?? undefined)))
</script>

<template>
  <div
    class="relative shrink-0 overflow-hidden bg-gray-100 dark:bg-gray-800"
    :class="shape === 'circle' ? 'rounded-full' : shape === 'rounded' ? 'rounded-lg' : ''"
    :style="{ aspectRatio: aspect, width: `${width}px`, backgroundColor: placeholderColor ?? undefined }"
  >
    <img
      v-if="src"
      :src="src"
      :srcset="srcset"
      :sizes="srcset ? `${width}px` : undefined"
      :alt="alt"
      loading="lazy"
      decoding="async"
      class="h-full w-full"
      :class="fit === 'contain' ? 'object-contain' : 'object-cover'"
    />
    <span v-else class="absolute inset-0 grid place-items-center text-lg text-gray-400" aria-hidden="true">
      <slot name="empty">🖼</slot>
    </span>
    <slot />
  </div>
</template>
