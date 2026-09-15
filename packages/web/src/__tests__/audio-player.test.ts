import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AudioPlayer from '@/components/media/AudioPlayer.vue'
import { usePaywallStore } from '@/stores/paywall'
import type { AudioTrack } from '@/stores/bookAudio'

function mockAudio() {
  const listeners: Record<string, () => void> = {}
  const audioEl = {
    src: '',
    preload: '',
    duration: 120,
    currentTime: 0,
    pause: vi.fn(),
    load: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn((name: string, fn: () => void) => { listeners[name] = fn }),
    removeEventListener: vi.fn(),
    removeAttribute: vi.fn(),
  }
  Object.defineProperty(globalThis, 'Audio', {
    writable: true,
    configurable: true,
    value: vi.fn(function () { return audioEl }),
  })
  return { audioEl, listeners }
}

const tick = () => new Promise((r) => setTimeout(r, 20))

describe('AudioPlayer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts playback when loikmon:playAudioTrack event fires', async () => {
    const { audioEl } = mockAudio()
    const wrapper = mount(AudioPlayer)
    const track: AudioTrack = { id: '1', title: 'Chapter 1', url: 'https://storage.loikmon.org/audio/1.mp3?sig=abc' }

    window.dispatchEvent(new CustomEvent('loikmon:playAudioTrack', { detail: { track, queue: [track] } }))
    await tick()

    expect(audioEl.play).toHaveBeenCalled()
    expect(audioEl.src).toBe(track.url)
    expect(wrapper.text()).toContain('Chapter 1')
    wrapper.unmount()
  })

  it('never plays a locked chapter: opens the paywall instead', async () => {
    const { audioEl } = mockAudio()
    const wrapper = mount(AudioPlayer)
    const locked: AudioTrack = { id: '2', title: 'Chapter 2', url: '', locked: true, lockReason: 'subscription_required' }

    window.dispatchEvent(new CustomEvent('loikmon:playAudioTrack', { detail: { track: locked } }))
    await tick()

    expect(audioEl.play).not.toHaveBeenCalled()
    expect(usePaywallStore().reason).toBe('subscription_required')
    wrapper.unmount()
  })

  it('stops at the end of the free preview and opens the paywall for the next locked chapter', async () => {
    const { audioEl, listeners } = mockAudio()
    const wrapper = mount(AudioPlayer)
    const preview: AudioTrack = { id: 'p1', title: 'Preview', url: 'https://storage.loikmon.org/audio/p1.mp3' }
    const locked: AudioTrack = { id: 'c2', title: 'Chapter 2', url: '', locked: true, lockReason: 'login_required' }

    window.dispatchEvent(new CustomEvent('loikmon:playAudioTrack', { detail: { track: preview, queue: [preview, locked] } }))
    await tick()
    expect(audioEl.play).toHaveBeenCalledTimes(1)

    listeners.ended()
    await tick()

    expect(audioEl.play).toHaveBeenCalledTimes(1)
    expect(usePaywallStore().reason).toBe('login_required')
    wrapper.unmount()
  })
})
