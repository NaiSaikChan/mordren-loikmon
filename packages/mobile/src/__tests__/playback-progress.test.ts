import type { AudioTrack } from '@/lib/audio'

const mockGetProgress = jest.fn()
const mockGetJSON = jest.fn()
const mockSetJSON = jest.fn()

jest.mock('@loikmon/api', () => {
  const actual = jest.requireActual('@loikmon/api')
  return { ...actual, books: { ...actual.books, getProgress: (...a: unknown[]) => mockGetProgress(...a) } }
})

jest.mock('@/services/storage', () => ({
  storage: {
    getJSON: (...a: unknown[]) => mockGetJSON(...a),
    setJSON: (...a: unknown[]) => mockSetJSON(...a),
  },
}))

import {
  SAVE_INTERVAL_MS,
  bookIdOf,
  chapterIdOf,
  createProgressReporter,
  loadAudioPosition,
} from '@/lib/playbackProgress'

const chapterTrack = (chapterId: number | string = 101): AudioTrack => ({
  id: chapterId,
  title: 'Mon Chronicles – Chapter 1',
  url: 'https://storage.loikmon.org/audio/42/1.mp3?sig=x',
  sourceType: 'book',
  sourceBookId: 42,
  chapterId,
})

const articleTrack: AudioTrack = {
  id: 'article-11',
  title: 'Mon New Year',
  url: 'https://storage.loikmon.org/audio/articles/11.mp3?sig=x',
  sourceType: 'article',
  sourceBookId: 11,
}

const ok = (data: unknown) => Promise.resolve({ data })
/** The first report flushes without being awaited, so let it settle before asserting. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
const audioRow = (overrides: Record<string, unknown> = {}) =>
  ok({ progress: [{ format: 'audio', location: '101', progress: 42, updated_at: '', ...overrides }] })

beforeEach(() => {
  jest.clearAllMocks()
  mockGetJSON.mockResolvedValue(null)
  mockSetJSON.mockResolvedValue(undefined)
})

describe('track identity', () => {
  it('reads book and chapter ids from a chapter track', () => {
    expect(bookIdOf(chapterTrack())).toBe('42')
    expect(chapterIdOf(chapterTrack())).toBe('101')
  })

  it('has no position to restore for article narration', () => {
    expect(bookIdOf(articleTrack)).toBeNull()
    expect(chapterIdOf(articleTrack)).toBeNull()
  })
})

describe('loadAudioPosition', () => {
  it('prefers the server copy when signed in', async () => {
    mockGetProgress.mockReturnValue(audioRow({ location: '105', progress: 30 }))
    mockGetJSON.mockResolvedValue({ chapterId: '101', percent: 10 })

    await expect(loadAudioPosition(42, true)).resolves.toEqual({ chapterId: '105', percent: 30 })
  })

  it('uses the device copy while signed out, without calling the API', async () => {
    mockGetJSON.mockResolvedValue({ chapterId: '101', percent: 10 })

    await expect(loadAudioPosition(42, false)).resolves.toEqual({ chapterId: '101', percent: 10 })
    expect(mockGetProgress).not.toHaveBeenCalled()
  })

  it('falls back to the device copy when the server is unreachable', async () => {
    mockGetProgress.mockRejectedValue(new Error('offline'))
    mockGetJSON.mockResolvedValue({ chapterId: '101', percent: 10 })

    await expect(loadAudioPosition(42, true)).resolves.toEqual({ chapterId: '101', percent: 10 })
  })

  it('ignores reader rows and restores only audio', async () => {
    mockGetProgress.mockReturnValue(
      ok({
        progress: [
          { format: 'epub', location: 'epubcfi(/6/4)', progress: 80, updated_at: '' },
          { format: 'audio', location: '105', progress: 12, updated_at: '' },
        ],
      }),
    )

    await expect(loadAudioPosition(42, true)).resolves.toEqual({ chapterId: '105', percent: 12 })
  })

  it('does not resume a chapter that had barely started', async () => {
    mockGetProgress.mockReturnValue(audioRow({ progress: 0.4 }))
    await expect(loadAudioPosition(42, true)).resolves.toBeNull()
  })

  it('does not resume a chapter that already finished', async () => {
    mockGetProgress.mockReturnValue(audioRow({ progress: 99.5 }))
    await expect(loadAudioPosition(42, true)).resolves.toBeNull()
  })
})

describe('createProgressReporter', () => {
  const save = jest.fn()
  let now = 1_000_000

  beforeEach(() => {
    now = 1_000_000
    save.mockReset()
    save.mockResolvedValue({ data: { status: 'ok' } })
  })

  it('sends the first position immediately, then throttles', async () => {
    const reporter = createProgressReporter(() => true, save as never, () => now)

    reporter.report(chapterTrack(), 10)
    await tick()
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('42', { format: 'audio', location: '101', progress: 10 })

    now += 1_000
    reporter.report(chapterTrack(), 11)
    reporter.report(chapterTrack(), 12)
    expect(save).toHaveBeenCalledTimes(1)

    now += SAVE_INTERVAL_MS
    reporter.report(chapterTrack(), 20)
    await tick()
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('writes the device copy even while signed out, and skips the server', async () => {
    const reporter = createProgressReporter(() => false, save as never, () => now)

    reporter.report(chapterTrack(), 40)
    await tick()

    expect(mockSetJSON).toHaveBeenCalledWith('audio_position:42', { chapterId: '101', percent: 40 })
    expect(save).not.toHaveBeenCalled()
  })

  it('does not report article narration, which has no book row', async () => {
    const reporter = createProgressReporter(() => true, save as never, () => now)
    reporter.report(articleTrack, 30)
    await reporter.flush()
    expect(save).not.toHaveBeenCalled()
    expect(mockSetJSON).not.toHaveBeenCalled()
  })

  it('clamps out-of-range percentages the server would reject', async () => {
    const reporter = createProgressReporter(() => true, save as never, () => now)
    reporter.report(chapterTrack(), 140)
    await tick()
    expect(save).toHaveBeenCalledWith('42', { format: 'audio', location: '101', progress: 100 })
  })

  it('swallows a failed save so playback is never interrupted', async () => {
    save.mockRejectedValue(new Error('500'))
    const reporter = createProgressReporter(() => true, save as never, () => now)
    reporter.report(chapterTrack(), 10)
    await expect(reporter.flush()).resolves.toBeUndefined()
  })

  it('reset drops an unsent position', async () => {
    const reporter = createProgressReporter(() => true, save as never, () => now)
    reporter.report(chapterTrack(), 10)
    now += 100
    reporter.report(chapterTrack(), 20)
    reporter.reset()
    await reporter.flush()
    await tick()
    expect(save).toHaveBeenCalledTimes(1)
  })
})
