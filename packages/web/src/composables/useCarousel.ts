import {
  ref,
  computed,
  watch,
  toValue,
  onMounted,
  onUnmounted,
  nextTick,
  type Ref,
  type MaybeRefOrGetter,
} from 'vue'

export interface UseCarouselOptions {
  /**
   * Scroll ratio relative to container client width (e.g. 0.8 = 80% width per scroll step).
   * Default: 0.8
   */
  scrollRatio?: MaybeRefOrGetter<number>
  /**
   * Fixed scroll amount in pixels (if provided, overrides scrollRatio).
   */
  scrollAmount?: MaybeRefOrGetter<number | undefined>
  /**
   * Whether to use smooth scrolling.
   * Default: true
   */
  smooth?: MaybeRefOrGetter<boolean>
  /**
   * Loop around when reaching the start or end during navigation.
   * Default: false
   */
  loop?: MaybeRefOrGetter<boolean>
  /**
   * Whether auto-play is enabled.
   * Default: false
   */
  autoPlay?: MaybeRefOrGetter<boolean>
  /**
   * Auto-play interval in ms.
   * Default: 5000
   */
  autoPlayInterval?: MaybeRefOrGetter<number>
  /**
   * Whether to pause auto-play when hovering over the container.
   * Default: true
   */
  pauseOnHover?: MaybeRefOrGetter<boolean>
}

export interface UseCarouselReturn {
  /**
   * Template ref to attach to the scrollable container if target is omitted.
   */
  containerRef: Ref<HTMLElement | null>
  /**
   * Whether the container can scroll further left.
   */
  canScrollLeft: Ref<boolean>
  /**
   * Whether the container can scroll further right.
   */
  canScrollRight: Ref<boolean>
  /**
   * Scroll progress from 0 (start) to 1 (end).
   */
  scrollProgress: Ref<number>
  /**
   * Whether a programmatic or user scroll is active.
   */
  isScrolling: Ref<boolean>
  /**
   * Whether the user is currently hovering over the carousel container.
   */
  isHovered: Ref<boolean>
  /**
   * Scroll left / previous item or page.
   */
  scrollPrev: () => void
  /**
   * Scroll right / next item or page.
   */
  scrollNext: () => void
  /**
   * Scroll by a relative pixel delta.
   */
  scrollBy: (delta: number) => void
  /**
   * Scroll to an absolute pixel offset.
   */
  scrollTo: (position: number) => void
  /**
   * Recalculate scroll boundaries and capabilities.
   */
  updateScrollState: () => void
  /**
   * Manually pause auto-play.
   */
  pauseAutoPlay: () => void
  /**
   * Manually resume auto-play.
   */
  resumeAutoPlay: () => void
}

/**
 * Adaptable composable for horizontal carousels and smooth scroll containers.
 * Accepts both reactive and non-reactive targets and configuration options.
 */
export function useCarousel(
  target?: MaybeRefOrGetter<HTMLElement | null | undefined>,
  options: UseCarouselOptions = {},
): UseCarouselReturn {
  const containerRef = ref<HTMLElement | null>(null)
  const canScrollLeft = ref(false)
  const canScrollRight = ref(false)
  const scrollProgress = ref(0)
  const isScrolling = ref(false)
  const isHovered = ref(false)

  let autoPlayTimer: ReturnType<typeof setInterval> | null = null
  let scrollTimeout: ReturnType<typeof setTimeout> | null = null
  let resizeObserver: ResizeObserver | null = null
  let mutationObserver: MutationObserver | null = null

  // Resolve target element (either passed or internal containerRef)
  const element = computed<HTMLElement | null>(() => {
    const val = toValue(target)
    return (val !== undefined ? val : containerRef.value) ?? null
  })

  function updateScrollState() {
    const el = element.value
    if (!el) {
      canScrollLeft.value = false
      canScrollRight.value = false
      scrollProgress.value = 0
      return
    }

    const { scrollLeft, scrollWidth, clientWidth } = el
    const maxScroll = Math.max(0, scrollWidth - clientWidth)

    // Sub-pixel tolerant threshold
    canScrollLeft.value = scrollLeft > 2
    canScrollRight.value = maxScroll > 2 && scrollLeft < maxScroll - 2
    scrollProgress.value = maxScroll > 0 ? Math.min(1, Math.max(0, scrollLeft / maxScroll)) : 0
  }

  function scrollBy(delta: number) {
    const el = element.value
    if (!el) return

    const isSmooth = toValue(options.smooth) ?? true
    isScrolling.value = true

    el.scrollBy({
      left: delta,
      behavior: isSmooth ? 'smooth' : 'auto',
    })

    if (scrollTimeout) clearTimeout(scrollTimeout)
    scrollTimeout = setTimeout(() => {
      isScrolling.value = false
      updateScrollState()
    }, 350)
  }

  function scrollTo(position: number) {
    const el = element.value
    if (!el) return

    const isSmooth = toValue(options.smooth) ?? true
    isScrolling.value = true

    el.scrollTo({
      left: position,
      behavior: isSmooth ? 'smooth' : 'auto',
    })

    if (scrollTimeout) clearTimeout(scrollTimeout)
    scrollTimeout = setTimeout(() => {
      isScrolling.value = false
      updateScrollState()
    }, 350)
  }

  function scrollPrev() {
    const el = element.value
    if (!el) return

    const fixedAmount = toValue(options.scrollAmount)
    const ratio = toValue(options.scrollRatio) ?? 0.8
    const isLoop = toValue(options.loop) ?? false

    if (canScrollLeft.value) {
      const amount = fixedAmount ?? el.clientWidth * ratio
      scrollBy(-amount)
    } else if (isLoop) {
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth)
      scrollTo(maxScroll)
    }
  }

  function scrollNext() {
    const el = element.value
    if (!el) return

    const fixedAmount = toValue(options.scrollAmount)
    const ratio = toValue(options.scrollRatio) ?? 0.8
    const isLoop = toValue(options.loop) ?? false

    if (canScrollRight.value) {
      const amount = fixedAmount ?? el.clientWidth * ratio
      scrollBy(amount)
    } else if (isLoop) {
      scrollTo(0)
    }
  }

  function startAutoPlay() {
    stopAutoPlay()
    const autoPlayEnabled = toValue(options.autoPlay) ?? false
    if (!autoPlayEnabled) return

    const interval = toValue(options.autoPlayInterval) ?? 5000
    autoPlayTimer = setInterval(() => {
      const shouldPauseOnHover = toValue(options.pauseOnHover) ?? true
      if (shouldPauseOnHover && isHovered.value) return

      if (canScrollRight.value) {
        scrollNext()
      } else {
        const isLoop = toValue(options.loop) ?? true
        if (isLoop) {
          scrollTo(0)
        }
      }
    }, interval)
  }

  function stopAutoPlay() {
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer)
      autoPlayTimer = null
    }
  }

  function pauseAutoPlay() {
    stopAutoPlay()
  }

  function resumeAutoPlay() {
    startAutoPlay()
  }

  function onMouseEnter() {
    isHovered.value = true
  }

  function onMouseLeave() {
    isHovered.value = false
  }

  function onScroll() {
    updateScrollState()
  }

  function attachListeners(el: HTMLElement) {
    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('mouseenter', onMouseEnter)
    el.addEventListener('mouseleave', onMouseLeave)

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateScrollState()
      })
      resizeObserver.observe(el)
    }

    if (typeof MutationObserver !== 'undefined') {
      mutationObserver = new MutationObserver(() => {
        nextTick(updateScrollState)
      })
      mutationObserver.observe(el, { childList: true, subtree: true })
    }

    nextTick(updateScrollState)
  }

  function detachListeners(el: HTMLElement | null) {
    if (!el) return
    el.removeEventListener('scroll', onScroll)
    el.removeEventListener('mouseenter', onMouseEnter)
    el.removeEventListener('mouseleave', onMouseLeave)

    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    if (mutationObserver) {
      mutationObserver.disconnect()
      mutationObserver = null
    }
  }

  watch(
    element,
    (newEl, oldEl) => {
      if (oldEl) detachListeners(oldEl)
      if (newEl) {
        attachListeners(newEl)
        startAutoPlay()
      }
    },
    { immediate: true, flush: 'post' },
  )

  // Watch autoPlay reactive settings
  watch(
    [() => toValue(options.autoPlay), () => toValue(options.autoPlayInterval)],
    () => {
      if (element.value) startAutoPlay()
    },
  )

  onMounted(() => {
    nextTick(updateScrollState)
    startAutoPlay()
  })

  onUnmounted(() => {
    detachListeners(element.value)
    stopAutoPlay()
    if (scrollTimeout) clearTimeout(scrollTimeout)
  })

  return {
    containerRef,
    canScrollLeft,
    canScrollRight,
    scrollProgress,
    isScrolling,
    isHovered,
    scrollPrev,
    scrollNext,
    scrollBy,
    scrollTo,
    updateScrollState,
    pauseAutoPlay,
    resumeAutoPlay,
  }
}
