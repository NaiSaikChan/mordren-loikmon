import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AudioPlayer from '@/components/media/AudioPlayer.vue'

describe('AudioPlayer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts playback when loikmon:playAudioTrack event fires', async () => {
    const playMock = vi.fn().mockResolvedValue(undefined)
    const pauseMock = vi.fn()
    const loadMock = vi.fn()
    const addEventListenerMock = vi.fn()
    const removeEventListenerMock = vi.fn()

    // Minimal Audio mock that supports what's used
    const audioEl = {
      src: '',
      preload: '',
      duration: 120,
      currentTime: 0,
      pause: pauseMock,
      load: loadMock,
      play: playMock,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
      removeAttribute: vi.fn(),
    }

    Object.defineProperty(globalThis, 'Audio', {
      writable: true,
      configurable: true,
      value: vi.fn(() => audioEl),
    })

    const wrapper = mount(AudioPlayer)
    // Simulate the mounted audio element being used
    const track = {
      id: '1',
      title: 'Chapter 1',
      url: 'https://loikmon.org/webapis/uploads/books/audios/ch1.mp3',
    }

    window.dispatchEvent(new CustomEvent('loikmon:playAudioTrack', { detail: { track, queue: [track] } }))
    await new Promise((r) => setTimeout(r, 50))

    expect(playMock).toHaveBeenCalled()
    expect(audioEl.src).toBe(track.url)
    expect(wrapper.text()).toContain('Chapter 1')
  })
})
