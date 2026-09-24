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
  TIMED_OUT,
  bookIdOf,
  chapterIdOf,
  createProgressReporter,
  loadAudioPosition,
  planResume,
  withTimeout,
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

  it('still loads device values written before timestamps existed', async () => {
    mockGetJSON.mockResolvedValue({ chapterId: 101, percent: 25 })
    await expect(loadAudioPosition(42, false)).resolves.toEqual({ chapterId: '101', percent: 25 })
  })

  it('lets an old untimestamped device copy through when the server row is not worth resuming', async () => {
    mockGetProgress.mockReturnValue(audioRow({ progress: 0.2 }))
    mockGetJSON.mockResolvedValue({ chapterId: '101', percent: 25 })
    await expect(loadAudioPosition(42, true)).resolves.toEqual({ chapterId: '101', percent: 25 })
  })

  it('prefers an unsynced device position that is newer than the server row', async () => {
    mockGetProgress.mockReturnValue(audioRow({ location: '101', progress: 30, updated_at: '2026-09-22T10:00:00.000Z' }))
    mockGetJSON.mockResolvedValue({
      chapterId: '105',
      percent: 60,
      updatedAt: Date.parse('2026-09-22T11:00:00.000Z'),
      dirty: true,
    })
    await expect(loadAudioPosition(42, true)).resolves.toEqual({ chapterId: '105', percent: 60 })
  })

  it('prefers the server when it is newer than the unsynced device copy (another device listened since)', async () => {
    mockGetProgress.mockReturnValue(audioRow({ location: '101', progress: 30, updated_at: '2026-09-22T12:00:00.000Z' }))
    mockGetJSON.mockResolvedValue({
      chapterId: '105',
      percent: 60,
      updatedAt: Date.parse('2026-09-22T11:00:00.000Z'),
      dirty: true,
    })
    await expect(loadAudioPosition(42, true)).resolves.toEqual({ chapterId: '101', percent: 30 })
  })

  it('prefers the server over a synced device copy', async () => {
    mockGetProgress.mockReturnValue(audioRow({ location: '101', progress: 30, updated_at: '2026-09-22T10:00:00.000Z' }))
    mockGetJSON.mockResolvedValue({
      chapterId: '105',
      percent: 60,
      updatedAt: Date.parse('2026-09-22T11:00:00.000Z'),
      dirty: false,
    })
    await expect(loadAudioPosition(42, true)).resolves.toEqual({ chapterId: '101', percent: 30 })
  })

  it('reads MySQL-style server timestamps as UTC', async () => {
    mockGetProgress.mockReturnValue(audioRow({ location: '101', progress: 30, updated_at: '2026-09-22 10:00:00' }))
    mockGetJSON.mockResolvedValue({
      chapterId: '105',
      percent: 60,
      updatedAt: Date.parse('2026-09-22T10:30:00.000Z'),
      dirty: true,
    })
    await expect(loadAudioPosition(42, true)).resolves.toEqual({ chapterId: '105', percent: 60 })
  })
})

describe('planResume', () => {
  const queue = [chapterTrack(101), chapterTrack(102), chapterTrack(103)]

  it('seeks inside the chosen chapter when it is the stored one', () => {
    expect(planResume(queue[1], 1, queue, { chapterId: '102', percent: 40 })).toEqual({ kind: 'seek', percent: 40 })
  })

  it('jumps to the stored chapter only when starting at the head of a multi-chapter queue', () => {
    expect(planResume(queue[0], 0, queue, { chapterId: '103', percent: 40 })).toEqual({
      kind: 'jump',
      index: 2,
      percent: 40,
    })
    expect(planResume(queue[1], 1, queue, { chapterId: '103', percent: 40 })).toBeNull()
    expect(planResume(queue[0], 0, [queue[0]], { chapterId: '103', percent: 40 })).toBeNull()
  })

  it('does nothing without a stored position or when the stored chapter is gone', () => {
    expect(planResume(queue[0], 0, queue, null)).toBeNull()
    expect(planResume(queue[0], 0, queue, { chapterId: '999', percent: 40 })).toBeNull()
  })
})

describe('withTimeout', () => {
  it('returns the value when it arrives in time', async () => {
    await expect(withTimeout(Promise.resolve(5), 50)).resolves.toBe(5)
  })

  it('reports a timeout without cancelling the underlying promise', async () => {
    let resolve: (v: number) => void = () => undefined
    const slow = new Promise<number>((r) => {
      resolve = r
    })
    await expect(withTimeout(slow, 5)).resolves.toBe(TIMED_OUT)
    resolve(7)
    await expect(slow).resolves.toBe(7)
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

    expect(mockSetJSON).toHaveBeenCalledWith('audio_position:42', {
      chapterId: '101',
      percent: 40,
      updatedAt: now,
      dirty: true,
    })
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

  it('retries a failed save on the next flush and then marks the device copy synced', async () => {
    save.mockRejectedValueOnce(new Error('offline'))
    const reporter = createProgressReporter(() => true, save as never, () => now)

    reporter.report(chapterTrack(), 10)
    await tick()
    expect(save).toHaveBeenCalledTimes(1)
    expect(mockSetJSON).toHaveBeenLastCalledWith('audio_position:42', expect.objectContaining({ percent: 10, dirty: true }))

    // Nothing new was reported (e.g. back in the foreground): the failed save is retried.
    await reporter.flush()
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith('42', { format: 'audio', location: '101', progress: 10 })
    expect(mockSetJSON).toHaveBeenLastCalledWith('audio_position:42', expect.objectContaining({ percent: 10, dirty: false }))

    // Once synced there is nothing left to retry.
    await reporter.flush()
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('lets a newer position supersede an older failed one', async () => {
    save.mockRejectedValueOnce(new Error('offline'))
    const reporter = createProgressReporter(() => true, save as never, () => now)
    reporter.report(chapterTrack(), 10)
    await tick()
    now += 1_000
    reporter.report(chapterTrack(), 30)
    await reporter.flush()
    await reporter.flush()
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith('42', { format: 'audio', location: '101', progress: 30 })
  })

  it('stamps the device copy with when the listener was there', async () => {
    const reporter = createProgressReporter(() => true, save as never, () => now)
    reporter.report(chapterTrack(), 10)
    await reporter.flush()
    expect(mockSetJSON).toHaveBeenCalledWith('audio_position:42', {
      chapterId: '101',
      percent: 10,
      updatedAt: 1_000_000,
      dirty: true,
    })
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
