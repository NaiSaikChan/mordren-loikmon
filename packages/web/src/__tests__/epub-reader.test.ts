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
const mockRenderTo   = vi.fn().mockReturnValue({
  display: mockDisplay,
  destroy: mockDestroy,
  next:    mockNext,
  prev:    mockPrev,
})
const mockBookDestroy = vi.fn()
const mockReady       = Promise.resolve()
const mockLocations   = { generate: vi.fn().mockResolvedValue(undefined) }

const mockEpubFactory = vi.fn(() => ({
  renderTo:  mockRenderTo,
  destroy:   mockBookDestroy,
  ready:     mockReady,
  locations: mockLocations,
}))

// Mock fetch so buffer-based loading does not fail in jsdom
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  statusText: 'OK',
  arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
}))

describe('EpubReader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(window as any).ePub = mockEpubFactory
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

  // ── Signed URLs ───────────────────────────────────────────────────────────
  it('stores the reading position per book id, not per (changing) signed URL', async () => {
    localStorage.setItem('epub-cfi-book-42', 'epubcfi(/6/4)')
    mount(EpubReader, {
      props: { url: 'https://storage.loikmon.org/books/42.epub?sig=new', bookId: 42 },
      attachTo: document.body,
    })
    await new Promise(r => setTimeout(r, 0))
    await new Promise(r => setTimeout(r, 0))

    expect(mockDisplay).toHaveBeenCalledWith('epubcfi(/6/4)')
    localStorage.removeItem('epub-cfi-book-42')
  })

  it('asks for a fresh signed URL once when storage rejects the expired one', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 403, statusText: 'Forbidden', arrayBuffer: vi.fn() })
      .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK', arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)) })
    vi.stubGlobal('fetch', fetchMock)
    const refreshUrl = vi.fn().mockResolvedValue('https://storage.loikmon.org/books/42.epub?sig=fresh')

    mount(EpubReader, {
      props: { url: 'https://storage.loikmon.org/books/42.epub?sig=expired', bookId: 42, refreshUrl },
      attachTo: document.body,
    })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    expect(refreshUrl).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[1][0]).toBe('https://storage.loikmon.org/books/42.epub?sig=fresh')
    await vi.waitFor(() => expect(mockRenderTo).toHaveBeenCalled())
  })
})
