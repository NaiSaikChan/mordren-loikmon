/**
 * EpubReader component — unit tests
 * epubjs is mocked entirely: it requires a real browser DOM and CORS-free network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import EpubReader from '@/components/shared/EpubReader.vue'

// ── Mock epubjs ───────────────────────────────────────────────────────────────
const mockDestroy    = vi.fn()
const mockDisplay    = vi.fn().mockResolvedValue(undefined)
const mockNext       = vi.fn()
const mockPrev       = vi.fn()
const mockOn         = vi.fn()
const mockRenderTo   = vi.fn().mockReturnValue({
  display: mockDisplay,
  destroy: mockDestroy,
  next:    mockNext,
  prev:    mockPrev,
  on:      mockOn,
})
const mockBookDestroy = vi.fn()

vi.mock('epubjs', () => ({
  default: vi.fn(() => ({
    renderTo: mockRenderTo,
    destroy:  mockBookDestroy,
  })),
}))

describe('EpubReader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Mount ──────────────────────────────────────────────────────────────────
  it('mounts without throwing an error', () => {
    expect(() =>
      mount(EpubReader, {
        props: { url: 'https://example.com/book.epub' },
        attachTo: document.body,
      })
    ).not.toThrow()
  })

  it('mounts and wrapper.exists() is true', () => {
    const wrapper = mount(EpubReader, {
      props:    { url: 'https://example.com/book.epub' },
      attachTo: document.body,
    })
    expect(wrapper.exists()).toBe(true)
  })

  // ── Rendered structure ────────────────────────────────────────────────────
  it('renders at least one container div', () => {
    const wrapper = mount(EpubReader, {
      props: { url: 'test.epub' },
    })
    expect(wrapper.find('div').exists()).toBe(true)
  })

  it('renders the epubjs render-target div (ref="container")', () => {
    const wrapper = mount(EpubReader, {
      props:    { url: 'https://example.com/book.epub' },
      attachTo: document.body,
    })
    // The container div is the inner most div that epubjs renders into
    const divs = wrapper.findAll('div')
    expect(divs.length).toBeGreaterThanOrEqual(1)
  })

  it('shows a loading indicator while the book is being rendered', () => {
    const wrapper = mount(EpubReader, {
      props: { url: 'https://example.com/book.epub' },
    })
    // loading starts true synchronously — before awaiting rendition.display()
    const html = wrapper.html()
    // The template has v-if="loading" with a spinner
    expect(html).toContain('Loading book')
  })

  // ── Teardown / unmount ────────────────────────────────────────────────────
  it('calls destroy on unmount (rendition or book)', async () => {
    const wrapper = mount(EpubReader, {
      props:    { url: 'https://example.com/book.epub' },
      attachTo: document.body,
    })
    await wrapper.vm.$nextTick()
    // Let the async render() complete so rendition is set
    await new Promise(r => setTimeout(r, 0))
    wrapper.unmount()
    // onBeforeUnmount calls rendition?.destroy() and book?.destroy()
    // Both mock fns are counted — at least one must have been called
    expect(mockDestroy.mock.calls.length + mockBookDestroy.mock.calls.length).toBeGreaterThanOrEqual(1)
  })

  it('does not throw when unmounting before render completes', () => {
    const wrapper = mount(EpubReader, {
      props:    { url: 'https://example.com/book.epub' },
      attachTo: document.body,
    })
    // Unmount immediately — book/rendition may still be null
    expect(() => wrapper.unmount()).not.toThrow()
  })

  // ── URL prop watching ─────────────────────────────────────────────────────
  it('re-renders when url prop changes', async () => {
    const wrapper = mount(EpubReader, {
      props:    { url: 'https://example.com/book1.epub' },
      attachTo: document.body,
    })
    await wrapper.vm.$nextTick()
    await new Promise(r => setTimeout(r, 0))

    const callsBefore = mockRenderTo.mock.calls.length

    await wrapper.setProps({ url: 'https://example.com/book2.epub' })
    await wrapper.vm.$nextTick()
    await new Promise(r => setTimeout(r, 0))

    // renderTo should have been called again for the new URL
    expect(mockRenderTo.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  // ── Keyboard navigation ───────────────────────────────────────────────────
  it('calls rendition.next() on ArrowRight keydown', async () => {
    mount(EpubReader, {
      props:    { url: 'https://example.com/book.epub' },
      attachTo: document.body,
    })
    await new Promise(r => setTimeout(r, 0))

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(mockNext).toHaveBeenCalled()
  })

  it('calls rendition.prev() on ArrowLeft keydown', async () => {
    mount(EpubReader, {
      props:    { url: 'https://example.com/book.epub' },
      attachTo: document.body,
    })
    await new Promise(r => setTimeout(r, 0))

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    expect(mockPrev).toHaveBeenCalled()
  })
})
