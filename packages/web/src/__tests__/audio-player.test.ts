import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createTestI18n, makeUser, response } from './helpers'

const mockGetProgress = vi.fn()
const mockSaveProgress = vi.fn()

vi.mock('@loikmon/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@loikmon/api')>()
  return {
    ...actual,
    books: {
      ...actual.books,
      getProgress: (...a: unknown[]) => mockGetProgress(...a),
      saveProgress: (...a: unknown[]) => mockSaveProgress(...a),
    },
  }
})

import AudioPlayer from '@/components/media/AudioPlayer.vue'
import { usePaywallStore } from '@/stores/paywall'
import { useAuthStore } from '@/stores/auth'
import type { AudioTrack } from '@/stores/bookAudio'

function mockAudio() {
  const listeners: Record<string, () => void> = {}
  const audioEl = {
    src: '',
    preload: '',
    duration: 120,
    currentTime: 0,
    playbackRate: 1,
    preservesPitch: false,
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

/** A book chapter track, which (unlike a bare track) carries the source a position is stored against. */
const chapterTrack = (chapterId: number, overrides: Partial<AudioTrack> = {}): AudioTrack => ({
  id: chapterId,
  title: `Mon Chronicles – Chapter ${chapterId}`,
  url: `https://storage.loikmon.org/audio/42/${chapterId}.mp3?sig=x`,
  source: { kind: 'book', bookId: 42, chapterId },
  ...overrides,
})

function signIn() {
  const auth = useAuthStore()
  auth.token = 'test-token'
  auth.user = makeUser()
  return auth
}

describe('AudioPlayer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockGetProgress.mockReturnValue(response({ status: 'ok', progress: [] }))
    mockSaveProgress.mockResolvedValue({ data: { status: 'ok' } })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts playback when loikmon:playAudioTrack event fires', async () => {
    const { audioEl } = mockAudio()
    const wrapper = mount(AudioPlayer, { global: { plugins: [createTestI18n()] } })
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
    const wrapper = mount(AudioPlayer, { global: { plugins: [createTestI18n()] } })
    const locked: AudioTrack = { id: '2', title: 'Chapter 2', url: '', locked: true, lockReason: 'subscription_required' }

    window.dispatchEvent(new CustomEvent('loikmon:playAudioTrack', { detail: { track: locked } }))
    await tick()

    expect(audioEl.play).not.toHaveBeenCalled()
    expect(usePaywallStore().reason).toBe('subscription_required')
    wrapper.unmount()
  })

  it('stops at the end of the free preview and opens the paywall for the next locked chapter', async () => {
    const { audioEl, listeners } = mockAudio()
    const wrapper = mount(AudioPlayer, { global: { plugins: [createTestI18n()] } })
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

  it('resumes the stored position when the listener reopens the chapter they stopped in', async () => {
    const { audioEl, listeners } = mockAudio()
    signIn()
    mockGetProgress.mockReturnValue(
      response({ status: 'ok', progress: [{ format: 'audio', location: '3', progress: 50, updated_at: '' }] }),
    )
    const wrapper = mount(AudioPlayer, { global: { plugins: [createTestI18n()] } })
    const track = chapterTrack(3)

    window.dispatchEvent(new CustomEvent('loikmon:playAudioTrack', { detail: { track, queue: [track] } }))
    await tick()
    listeners.loadedmetadata()
    await tick()

    expect(mockGetProgress).toHaveBeenCalledWith('42')
    expect(audioEl.currentTime).toBe(60) // 50% of the mocked 120s duration
    wrapper.unmount()
  })

  it('carries on from the stored chapter when playback starts at the head of the book', async () => {
    const { audioEl } = mockAudio()
    signIn()
    mockGetProgress.mockReturnValue(
      response({ status: 'ok', progress: [{ format: 'audio', location: '3', progress: 25, updated_at: '' }] }),
    )
    const wrapper = mount(AudioPlayer, { global: { plugins: [createTestI18n()] } })
    const queue = [chapterTrack(1), chapterTrack(2), chapterTrack(3)]

    window.dispatchEvent(new CustomEvent('loikmon:playAudioTrack', { detail: { track: queue[0], queue } }))
    await tick()

    expect(audioEl.src).toBe(queue[2].url)
    expect(wrapper.text()).toContain('Chapter 3')
    wrapper.unmount()
  })

  it('stays on a chapter the listener picked deliberately', async () => {
    const { audioEl } = mockAudio()
    signIn()
    mockGetProgress.mockReturnValue(
      response({ status: 'ok', progress: [{ format: 'audio', location: '3', progress: 25, updated_at: '' }] }),
    )
    const wrapper = mount(AudioPlayer, { global: { plugins: [createTestI18n()] } })
    const queue = [chapterTrack(1), chapterTrack(2), chapterTrack(3)]

    window.dispatchEvent(new CustomEvent('loikmon:playAudioTrack', { detail: { track: queue[1], queue } }))
    await tick()

    expect(audioEl.src).toBe(queue[1].url)
    wrapper.unmount()
  })

  it('never asks for a position while signed out', async () => {
    mockAudio()
    const wrapper = mount(AudioPlayer, { global: { plugins: [createTestI18n()] } })
    const track = chapterTrack(3)

    window.dispatchEvent(new CustomEvent('loikmon:playAudioTrack', { detail: { track, queue: [track] } }))
    await tick()

    expect(mockGetProgress).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('stores the position as the chapter plays and when it finishes', async () => {
    const { audioEl, listeners } = mockAudio()
    signIn()
    const wrapper = mount(AudioPlayer, { global: { plugins: [createTestI18n()] } })
    const track = chapterTrack(3)

    window.dispatchEvent(new CustomEvent('loikmon:playAudioTrack', { detail: { track, queue: [track] } }))
    await tick()

    audioEl.currentTime = 30
    listeners.timeupdate()
    await tick()
    expect(mockSaveProgress).toHaveBeenCalledWith('42', { format: 'audio', location: '3', progress: 25 })

    listeners.ended()
    await tick()
    expect(mockSaveProgress).toHaveBeenLastCalledWith('42', { format: 'audio', location: '3', progress: 100 })
    wrapper.unmount()
  })

  it('does not overwrite a stored position with 0 before the resume lands', async () => {
    const { audioEl, listeners } = mockAudio()
    signIn()
    mockGetProgress.mockReturnValue(
      response({ status: 'ok', progress: [{ format: 'audio', location: '3', progress: 50, updated_at: '' }] }),
    )
    const wrapper = mount(AudioPlayer, { global: { plugins: [createTestI18n()] } })
    const track = chapterTrack(3)

    window.dispatchEvent(new CustomEvent('loikmon:playAudioTrack', { detail: { track, queue: [track] } }))
    // A timeupdate arrives while the stored position is still in flight.
    audioEl.currentTime = 0
    listeners.timeupdate()

    expect(mockSaveProgress).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})

describe('AudioPlayer — playback controls', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockGetProgress.mockReturnValue(response({ status: 'ok', progress: [] }))
    mockSaveProgress.mockResolvedValue({ data: { status: 'ok' } })
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function startPlaying() {
    const mocked = mockAudio()
    const wrapper = mount(AudioPlayer, { global: { plugins: [createTestI18n()] } })
    const track = chapterTrack(3)
    window.dispatchEvent(new CustomEvent('loikmon:playAudioTrack', { detail: { track, queue: [track] } }))
    await tick()
    mocked.listeners.loadedmetadata()
    await tick()
    return { ...mocked, wrapper, track }
  }

  it('skips forward and back by 15 seconds without running past the ends', async () => {
    const { audioEl, wrapper } = await startPlaying()

    audioEl.currentTime = 30
    await wrapper.find('[aria-label="Forward 15 seconds"]').trigger('click')
    expect(audioEl.currentTime).toBe(45)

    await wrapper.find('[aria-label="Back 15 seconds"]').trigger('click')
    expect(audioEl.currentTime).toBe(30)

    // Clamped at the start rather than going negative.
    audioEl.currentTime = 5
    await wrapper.find('[aria-label="Back 15 seconds"]').trigger('click')
    expect(audioEl.currentTime).toBe(0)
    wrapper.unmount()
  })

  it('applies playback speed with pitch correction and remembers it', async () => {
    const { audioEl, wrapper } = await startPlaying()
    await wrapper.find('[aria-label="Open full player"]').trigger('click')
    await tick()

    await wrapper.find('[aria-label="Playback speed"]').trigger('click')
    await tick()
    const option = wrapper.findAll('[role="menuitemradio"]').find((b) => b.text().includes('1.5'))
    await option!.trigger('click')
    await tick()

    expect(audioEl.playbackRate).toBe(1.5)
    // A sped-up narrator without pitch correction sounds comical.
    expect(audioEl.preservesPitch).toBe(true)
    expect(localStorage.getItem('audio-rate')).toBe('1.5')
    wrapper.unmount()
  })

  it('stops at the end of the chapter when the sleep timer says so', async () => {
    const { audioEl, listeners, wrapper } = await startPlaying()
    const queue = [chapterTrack(3), chapterTrack(4)]
    window.dispatchEvent(new CustomEvent('loikmon:playAudioTrack', { detail: { track: queue[0], queue } }))
    await tick()
    const callsBefore = audioEl.play.mock.calls.length

    await wrapper.find('[aria-label="Open full player"]').trigger('click')
    await tick()
    await wrapper.find('[aria-label="Sleep timer"]').trigger('click')
    await tick()
    const endOfChapter = wrapper.findAll('[role="menuitemradio"]').find((b) => b.text().includes('End of chapter'))
    await endOfChapter!.trigger('click')
    await tick()

    listeners.ended()
    await tick()

    // Without the timer this would have advanced to chapter 4.
    expect(audioEl.play.mock.calls.length).toBe(callsBefore)
    wrapper.unmount()
  })

  it('exposes the scrubber as a slider that reports position in speech', async () => {
    const { audioEl, listeners, wrapper } = await startPlaying()
    audioEl.currentTime = 30
    listeners.timeupdate()
    await tick()

    const slider = wrapper.find('[role="slider"]')
    expect(slider.exists()).toBe(true)
    expect(slider.attributes('aria-valuenow')).toBe('25')
    expect(slider.attributes('aria-valuetext')).toBe('30 seconds')
    expect(slider.attributes('tabindex')).toBe('0')
    wrapper.unmount()
  })

  it('seeks with the arrow keys, in seconds rather than a fraction of the bar', async () => {
    const { audioEl, listeners, wrapper } = await startPlaying()
    audioEl.currentTime = 30
    listeners.timeupdate()
    await tick()

    await wrapper.find('[role="slider"]').trigger('keydown', { key: 'ArrowRight' })
    expect(audioEl.currentTime).toBe(35)

    await wrapper.find('[role="slider"]').trigger('keydown', { key: 'Home' })
    expect(audioEl.currentTime).toBe(0)
    wrapper.unmount()
  })

  it('gives every transport control an accessible name instead of an emoji', async () => {
    const { wrapper } = await startPlaying()
    const labels = wrapper.findAll('button').map((b) => b.attributes('aria-label')).filter(Boolean)

    expect(labels).toEqual(expect.arrayContaining(['Pause', 'Next chapter', 'Previous chapter', 'Close player']))
    // The emoji controls this replaced.
    expect(wrapper.text()).not.toMatch(/[▶️⏸⏮⏭🔒🎵🎧]/u)
    wrapper.unmount()
  })

  it('opens the expanded player as a labelled modal dialog', async () => {
    const { wrapper } = await startPlaying()
    await wrapper.find('[aria-label="Open full player"]').trigger('click')
    await tick()

    const dialog = wrapper.find('[role="dialog"]')
    expect(dialog.exists()).toBe(true)
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(dialog.attributes('aria-label')).toBe('Now playing')
    wrapper.unmount()
  })
})
