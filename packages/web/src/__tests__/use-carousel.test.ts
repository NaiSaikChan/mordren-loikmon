import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useCarousel } from '@/composables/useCarousel'

describe('useCarousel composable', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('initializes with default values when element is not attached', () => {
    const {
      containerRef,
      canScrollLeft,
      canScrollRight,
      scrollProgress,
      isScrolling,
      isHovered,
    } = useCarousel()

    expect(containerRef.value).toBeNull()
    expect(canScrollLeft.value).toBe(false)
    expect(canScrollRight.value).toBe(false)
    expect(scrollProgress.value).toBe(0)
    expect(isScrolling.value).toBe(false)
    expect(isHovered.value).toBe(false)
  })

  it('updates scroll capabilities when attached to a scrollable element', async () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'clientWidth', { value: 300, configurable: true })
    Object.defineProperty(el, 'scrollWidth', { value: 1000, configurable: true })
    Object.defineProperty(el, 'scrollLeft', { value: 0, writable: true, configurable: true })

    const target = ref<HTMLElement | null>(el)
    const { canScrollLeft, canScrollRight, updateScrollState } = useCarousel(target)

    updateScrollState()
    expect(canScrollLeft.value).toBe(false)
    expect(canScrollRight.value).toBe(true)

    // Simulate scrolled in the middle
    el.scrollLeft = 350
    updateScrollState()
    expect(canScrollLeft.value).toBe(true)
    expect(canScrollRight.value).toBe(true)

    // Simulate scrolled to the end (maxScroll = 700)
    el.scrollLeft = 700
    updateScrollState()
    expect(canScrollLeft.value).toBe(true)
    expect(canScrollRight.value).toBe(false)
  })

  it('scrollNext and scrollPrev call scrollBy with default ratio 0.8', () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'clientWidth', { value: 400, configurable: true })
    Object.defineProperty(el, 'scrollWidth', { value: 1200, configurable: true })
    Object.defineProperty(el, 'scrollLeft', { value: 200, writable: true, configurable: true })
    el.scrollBy = vi.fn()
    el.scrollTo = vi.fn()

    const { scrollNext, scrollPrev, updateScrollState } = useCarousel(el)
    updateScrollState()

    scrollNext()
    expect(el.scrollBy).toHaveBeenCalledWith({
      left: 320, // 400 * 0.8
      behavior: 'smooth',
    })

    scrollPrev()
    expect(el.scrollBy).toHaveBeenCalledWith({
      left: -320,
      behavior: 'smooth',
    })
  })

  it('accepts reactive MaybeRefOrGetter options', () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'clientWidth', { value: 500, configurable: true })
    Object.defineProperty(el, 'scrollWidth', { value: 1500, configurable: true })
    Object.defineProperty(el, 'scrollLeft', { value: 200, writable: true, configurable: true })
    el.scrollBy = vi.fn()

    const ratio = ref(0.5)
    const smooth = ref(false)

    const { scrollNext, updateScrollState } = useCarousel(el, {
      scrollRatio: ratio,
      smooth: () => smooth.value,
    })

    updateScrollState()
    scrollNext()
    expect(el.scrollBy).toHaveBeenCalledWith({
      left: 250, // 500 * 0.5
      behavior: 'auto',
    })

    ratio.value = 0.9
    scrollNext()
    expect(el.scrollBy).toHaveBeenCalledWith({
      left: 450, // 500 * 0.9
      behavior: 'auto',
    })
  })

  it('supports fixed scrollAmount override', () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'clientWidth', { value: 500, configurable: true })
    Object.defineProperty(el, 'scrollWidth', { value: 1500, configurable: true })
    Object.defineProperty(el, 'scrollLeft', { value: 200, writable: true, configurable: true })
    el.scrollBy = vi.fn()

    const { scrollNext, updateScrollState } = useCarousel(el, {
      scrollAmount: 180,
    })

    updateScrollState()
    scrollNext()
    expect(el.scrollBy).toHaveBeenCalledWith({
      left: 180,
      behavior: 'smooth',
    })
  })

  it('loops to beginning or end when loop is true', () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'clientWidth', { value: 500, configurable: true })
    Object.defineProperty(el, 'scrollWidth', { value: 1500, configurable: true })
    Object.defineProperty(el, 'scrollLeft', { value: 0, writable: true, configurable: true })
    el.scrollBy = vi.fn()
    el.scrollTo = vi.fn()

    const { scrollPrev, scrollNext, updateScrollState } = useCarousel(el, {
      loop: true,
    })

    updateScrollState()
    // At start, scrollPrev should loop to max scroll (1500 - 500 = 1000)
    scrollPrev()
    expect(el.scrollTo).toHaveBeenCalledWith({
      left: 1000,
      behavior: 'smooth',
    })

    // At end, scrollNext should loop to 0
    el.scrollLeft = 1000
    updateScrollState()
    scrollNext()
    expect(el.scrollTo).toHaveBeenCalledWith({
      left: 0,
      behavior: 'smooth',
    })
  })

  it('handles autoPlay timer and pauseOnHover', () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'clientWidth', { value: 500, configurable: true })
    Object.defineProperty(el, 'scrollWidth', { value: 1500, configurable: true })
    Object.defineProperty(el, 'scrollLeft', { value: 0, writable: true, configurable: true })
    el.scrollBy = vi.fn()

    const { isHovered, updateScrollState } = useCarousel(el, {
      autoPlay: true,
      autoPlayInterval: 3000,
    })

    updateScrollState()

    vi.advanceTimersByTime(3000)
    expect(el.scrollBy).toHaveBeenCalledTimes(1)

    // Simulate mouseenter
    el.dispatchEvent(new MouseEvent('mouseenter'))
    expect(isHovered.value).toBe(true)

    // Timer advances, but autoPlay is paused while hovering
    vi.advanceTimersByTime(3000)
    expect(el.scrollBy).toHaveBeenCalledTimes(1)

    // Simulate mouseleave
    el.dispatchEvent(new MouseEvent('mouseleave'))
    expect(isHovered.value).toBe(false)

    vi.advanceTimersByTime(3000)
    expect(el.scrollBy).toHaveBeenCalledTimes(2)
  })
})
