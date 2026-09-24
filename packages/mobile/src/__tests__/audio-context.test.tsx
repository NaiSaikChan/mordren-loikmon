/**
 * @jest-environment jsdom
 */
import { AudioProvider, RESUME_WAIT_MS, useAudio, useAudioControls } from '@/context/AudioContext'
import { renderHook } from '@/test-utils/renderHook'
import React, { act } from 'react'
import type { AudioTrack } from '@/lib/audio'

/* ── fake expo-audio: one player whose status the test drives ─────────────── */

jest.mock('expo-audio', () => {
  const { useSyncExternalStore } = jest.requireActual('react')
  const listeners = new Set<() => void>()
  const base = {
    id: 'p',
    currentTime: 0,
    duration: 0,
    playing: false,
    isLoaded: false,
    isBuffering: false,
    didJustFinish: false,
    error: null as string | null,
  }
  let status = { ...base }
  const player = {
    isLoaded: false,
    duration: 0,
    currentTime: 0,
    playing: false,
    isBuffering: false,
    replace: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(async () => undefined),
    setPlaybackRate: jest.fn(),
    setActiveForLockScreen: jest.fn(),
    clearLockScreenControls: jest.fn(),
  }
  const setStatus = (patch: Partial<typeof base>) => {
    status = { ...status, ...patch }
    Object.assign(player, {
      isLoaded: status.isLoaded,
      duration: status.duration,
      currentTime: status.currentTime,
      playing: status.playing,
      isBuffering: status.isBuffering,
    })
    listeners.forEach((listener) => listener())
  }
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  return {
    useAudioPlayer: () => player,
    useAudioPlayerStatus: () => useSyncExternalStore(subscribe, () => status),
    setAudioModeAsync: jest.fn(async () => undefined),
    __player: player,
    __setStatus: setStatus,
    __reset: () => {
      status = { ...base }
      setStatus({})
    },
  }
})

// The real client pulls in axios, which needs Node globals jsdom lacks; nothing here calls it.
jest.mock('@loikmon/api', () => ({ books: {}, articles: {} }))

jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isLoggedIn: true }) }))

jest.mock('@/services/storage', () => ({
  storage: { get: jest.fn(async () => null), set: jest.fn(async () => undefined) },
}))

const mockRefresh = jest.fn()
const mockIsExpired = jest.fn((_expiresAt?: string | null) => false)
jest.mock('@/lib/refreshTrack', () => ({
  refreshTrackUrl: (...a: unknown[]) => mockRefresh(...a),
  isExpired: (expiresAt?: string | null) => mockIsExpired(expiresAt),
}))

const mockLoadPosition = jest.fn()
const mockReporter = { report: jest.fn(), flush: jest.fn(async () => undefined), reset: jest.fn() }
jest.mock('@/lib/playbackProgress', () => {
  const actual = jest.requireActual('@/lib/playbackProgress')
  return {
    ...actual,
    loadAudioPosition: (...a: unknown[]) => mockLoadPosition(...a),
    createProgressReporter: () => mockReporter,
  }
})

const audio = jest.requireMock('expo-audio') as {
  __player: Record<string, jest.Mock> & { isLoaded: boolean }
  __setStatus: (patch: Record<string, unknown>) => void
  __reset: () => void
}
const player = audio.__player

const chapter = (id: number, extra: Partial<AudioTrack> = {}): AudioTrack => ({
  id,
  title: `Book – ${id}`,
  url: `https://s3.test/audio/${id}.mp3?X-Amz-Signature=a`,
  sourceType: 'book',
  sourceBookId: 42,
  chapterId: id,
  durationSeconds: 100,
  ...extra,
})

const article = (id: number, extra: Partial<AudioTrack> = {}): AudioTrack => ({
  id: `article-${id}`,
  title: `Article ${id}`,
  url: `https://s3.test/articles/${id}.mp3?X-Amz-Signature=a`,
  sourceType: 'article',
  sourceBookId: id,
  ...extra,
})

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

async function advance(ms = 0) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })
}

async function status(patch: Record<string, unknown>) {
  await act(async () => {
    audio.__setStatus(patch)
    await jest.advanceTimersByTimeAsync(0)
  })
}

const wrapper = ({ children }: { children: React.ReactNode }) => <AudioProvider>{children}</AudioProvider>

const mounted: (() => void)[] = []

async function mount() {
  const view = await renderHook(() => useAudio(), { wrapper })
  mounted.push(view.unmount)
  return view
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  audio.__reset()
  mockIsExpired.mockImplementation(() => false)
  mockLoadPosition.mockResolvedValue(null)
})

afterEach(() => {
  // Every provider shares the fake player, so none may outlive its test.
  mounted.splice(0).forEach((unmount) => unmount())
  jest.useRealTimers()
})

describe('resume', () => {
  it('looks the position up before loading, then seeks once the track is ready', async () => {
    mockLoadPosition.mockResolvedValue({ chapterId: '2', percent: 40 })
    const { result } = await mount()
    const queue = [chapter(1), chapter(2), chapter(3)]

    await act(async () => {
      void result.current.play(queue[1], queue)
      await jest.advanceTimersByTimeAsync(0)
    })
    expect(player.replace).toHaveBeenCalledWith(queue[1].url)
    expect(player.seekTo).not.toHaveBeenCalled()

    await status({ isLoaded: true, duration: 100, playing: true, currentTime: 0 })
    expect(player.seekTo).toHaveBeenCalledWith(40)
    // Nothing was reported at 0% while the resume was owed.
    expect(mockReporter.report).not.toHaveBeenCalledWith(expect.anything(), 0)
  })

  it('lands the seek even when the new track reports the same duration as the old one', async () => {
    const { result } = await mount()
    // First book: plays and loads with duration 100.
    await act(async () => {
      void result.current.play(article(1))
      await jest.advanceTimersByTimeAsync(0)
    })
    await status({ isLoaded: true, duration: 100, playing: true, currentTime: 5 })

    mockLoadPosition.mockResolvedValue({ chapterId: '7', percent: 50 })
    await act(async () => {
      void result.current.play(chapter(7))
      await jest.advanceTimersByTimeAsync(0)
    })
    // isLoaded/duration never change, but the status keeps ticking.
    await status({ currentTime: 0.5 })
    expect(player.seekTo).toHaveBeenCalledWith(50)
  })

  it('never holds playback longer than the bound, and applies a late position immediately', async () => {
    const lookup = deferred<{ chapterId: string; percent: number } | null>()
    mockLoadPosition.mockReturnValue(lookup.promise)
    const { result } = await mount()
    const track = chapter(5)

    await act(async () => {
      void result.current.play(track, [track])
      await jest.advanceTimersByTimeAsync(0)
    })
    expect(player.replace).not.toHaveBeenCalled()

    await advance(RESUME_WAIT_MS)
    expect(player.replace).toHaveBeenCalledWith(track.url)
    expect(player.play).toHaveBeenCalled()

    // Playing, but the resume is still in flight: reporting stays held back.
    await status({ isLoaded: true, duration: 100, playing: true, currentTime: 2 })
    expect(mockReporter.report).not.toHaveBeenCalled()

    await act(async () => {
      lookup.resolve({ chapterId: '5', percent: 30 })
      await jest.advanceTimersByTimeAsync(0)
    })
    expect(player.seekTo).toHaveBeenCalledWith(30)

    await status({ currentTime: 31 })
    expect(mockReporter.report).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }), 31)
  })

  it('drops a late resume once the listener has moved to another chapter', async () => {
    const lookup = deferred<{ chapterId: string; percent: number } | null>()
    mockLoadPosition.mockReturnValue(lookup.promise)
    const { result } = await mount()
    const queue = [chapter(1), chapter(2)]

    await act(async () => {
      void result.current.play(queue[0], queue)
      await jest.advanceTimersByTimeAsync(RESUME_WAIT_MS)
    })
    await status({ isLoaded: true, duration: 100, playing: true, currentTime: 2 })
    await act(async () => {
      void result.current.next()
      await jest.advanceTimersByTimeAsync(0)
    })
    await act(async () => {
      lookup.resolve({ chapterId: '1', percent: 30 })
      await jest.advanceTimersByTimeAsync(0)
    })
    await status({ currentTime: 3 })
    expect(player.seekTo).not.toHaveBeenCalled()
    expect(result.current.current?.id).toBe(2)
  })
})

describe('load race', () => {
  it('ignores an older load that finishes re-signing after a newer one started', async () => {
    const slowRefresh = deferred<{ kind: 'url'; url: string; expiresAt: null }>()
    mockIsExpired.mockImplementation((expiresAt) => expiresAt === 'expired')
    mockRefresh.mockReturnValueOnce(slowRefresh.promise)
    const { result } = await mount()
    const first = article(1, { expiresAt: 'expired' })
    const second = article(2)

    await act(async () => {
      void result.current.play(first)
      await jest.advanceTimersByTimeAsync(0)
    })
    await act(async () => {
      void result.current.play(second)
      await jest.advanceTimersByTimeAsync(0)
    })
    expect(player.replace).toHaveBeenLastCalledWith(second.url)

    await act(async () => {
      slowRefresh.resolve({ kind: 'url', url: 'https://s3.test/articles/1-fresh.mp3', expiresAt: null })
      await jest.advanceTimersByTimeAsync(0)
    })
    expect(player.replace).not.toHaveBeenCalledWith('https://s3.test/articles/1-fresh.mp3')
    expect(result.current.current?.id).toBe('article-2')
  })
})

describe('mid-stream recovery', () => {
  it('re-signs an expired URL on a player error and seeks back to where it was', async () => {
    const { result } = await mount()
    await act(async () => {
      void result.current.play(article(3))
      await jest.advanceTimersByTimeAsync(0)
    })
    await status({ isLoaded: true, duration: 600, playing: true, currentTime: 120 })

    mockRefresh.mockResolvedValue({ kind: 'url', url: 'https://s3.test/articles/3-fresh.mp3', expiresAt: null })
    await status({ error: 'HTTP 403', playing: false, isLoaded: false })
    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(player.replace).toHaveBeenLastCalledWith('https://s3.test/articles/3-fresh.mp3')

    await status({ error: null, isLoaded: true, duration: 600, currentTime: 0 })
    expect(player.seekTo).toHaveBeenCalledWith(120)
    expect(result.current.error).toBeNull()
  })

  it('gives up with an error after a bounded number of attempts', async () => {
    const { result } = await mount()
    await act(async () => {
      void result.current.play(article(4))
      await jest.advanceTimersByTimeAsync(0)
    })
    mockRefresh.mockResolvedValue({ kind: 'url', url: 'https://s3.test/articles/4-fresh.mp3', expiresAt: null })
    for (let i = 0; i < 3; i += 1) {
      await status({ error: `fail ${i}` })
      await status({ error: null })
    }
    await status({ error: 'fail again' })
    expect(mockRefresh).toHaveBeenCalledTimes(2)
    expect(result.current.error).toBe('playback_failed')
  })
})

describe('context split', () => {
  it('does not re-render controls consumers as the position ticks', async () => {
    let renders = 0
    const view = await renderHook(
      () => {
        renders += 1
        return useAudioControls()
      },
      { wrapper },
    )
    mounted.push(view.unmount)
    const { result } = view
    await act(async () => {
      void result.current.play(article(9))
      await jest.advanceTimersByTimeAsync(0)
    })
    await status({ isLoaded: true, duration: 600, playing: true, currentTime: 1 })
    const before = renders
    await status({ currentTime: 2 })
    await status({ currentTime: 3 })
    expect(renders).toBe(before)
  })

  it('keeps useAudio as the merged, backward-compatible view', async () => {
    const { result } = await mount()
    await act(async () => {
      void result.current.play(article(9))
      await jest.advanceTimersByTimeAsync(0)
    })
    await status({ isLoaded: true, duration: 600, playing: true, currentTime: 12.5 })
    expect(result.current.positionMillis).toBe(12_500)
    expect(result.current.durationMillis).toBe(600_000)
    expect(result.current.isPlaying).toBe(true)
    expect(typeof result.current.toggle).toBe('function')
  })
})
