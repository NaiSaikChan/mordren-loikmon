<script setup lang="ts">
/**
 * Storefront image renderer for `ResponsiveImage` descriptors.
 *
 * - `srcset` + `sizes` when the backend returned variants; plain `src` for
 *   legacy keys (`srcset: null`) or when only a flat `fallback` URL exists.
 * - `assetType` sizes the frame from `IMAGE_STANDARDS` (CSS `aspect-ratio`)
 *   and makes it round when the standard displays as a circle. `fill` keeps
 *   the shape but lets the parent decide the frame size instead.
 * - Neutral placeholder background while loading; the `empty` slot (over the
 *   parent's background) when there is no image or it fails to load.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { IMAGE_STANDARDS, type ImageAssetType, type ResponsiveImage } from '@loikmon/media-standards'

const props = withDefaults(
  defineProps<{
    image?: ResponsiveImage | null
    fallback?: string | null
    alt: string
    assetType?: ImageAssetType
    sizes?: string
    eager?: boolean
    imgClass?: string
    /** Fill the parent box instead of sizing the frame from the asset's aspect ratio. */
    fill?: boolean
  }>(),
  { image: null, fallback: null, assetType: undefined, sizes: '100vw', eager: false, imgClass: '', fill: false },
)

const standard = computed(() => (props.assetType ? IMAGE_STANDARDS[props.assetType] : null))

const src = computed(() => props.image?.src || props.fallback || '')
// A srcset only makes sense for the descriptor it came from.
const srcset = computed(() => (props.image?.src && props.image.srcset) || null)

const boxStyle = computed(() => {
  const ratio = standard.value?.aspectRatio
  return ratio && !props.fill ? { aspectRatio: `${ratio.width} / ${ratio.height}` } : undefined
})
const isCircle = computed(() => standard.value?.display === 'circle')
const objectFit = computed(() => (standard.value?.fit === 'contain' ? 'object-contain' : 'object-cover'))

const imgEl = ref<HTMLImageElement | null>(null)
const loaded = ref(false)
const failed = ref(false)

watch(src, () => {
  loaded.value = false
  failed.value = false
})

onMounted(() => {
  // Cached images can finish before the load listener sees them.
  if (imgEl.value?.complete && imgEl.value.naturalWidth > 0) loaded.value = true
})

const showImage = computed(() => !!src.value && !failed.value)
</script>

<template>
  <div
    class="relative overflow-hidden"
    :class="[
      fill ? 'w-full h-full' : boxStyle ? 'w-full' : '',
      isCircle ? 'rounded-full' : '',
      showImage && !loaded ? 'bg-gray-100 dark:bg-surface-800' : '',
    ]"
    :style="boxStyle"
    data-testid="responsive-img"
  >
    <img
      v-if="showImage"
      ref="imgEl"
      :key="src"
      :src="src"
      :srcset="srcset ?? undefined"
      :sizes="srcset ? sizes : undefined"
      :alt="alt"
      :loading="eager ? 'eager' : 'lazy'"
      :decoding="eager ? undefined : 'async'"
      :fetchpriority="eager ? 'high' : undefined"
      class="w-full h-full"
      :class="[objectFit, isCircle ? 'rounded-full' : '', imgClass]"
      @load="loaded = true"
      @error="failed = true"
    />
    <div v-else class="absolute inset-0 flex items-center justify-center" data-testid="responsive-img-empty">
      <slot name="empty" />
    </div>
  </div>
</template>
