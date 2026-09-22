import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AudioTrack } from '@/stores/bookAudio'
import { response } from './helpers'

const mockGetProgress = vi.fn()

vi.mock('@loikmon/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@loikmon/api')>()
  return { ...actual, books: { ...actual.books, getProgress: (...a: unknown[]) => mockGetProgress(...a) } }
})

import {
  SAVE_INTERVAL_MS,
  bookIdOf,
  chapterIdOf,
  createProgressReporter,
  loadAudioPosition,
} from '@/composables/playbackProgress'

const chapterTrack = (chapterId: number | string = 101): AudioTrack => ({
  id: chapterId,
  title: 'Mon Chronicles – Chapter 1',
  url: 'https://storage.loikmon.org/audio/42/1.mp3?sig=x',
  source: { kind: 'book', bookId: 42, chapterId },
})

const articleTrack = (): AudioTrack => ({
  id: 'article-11',
  title: 'Mon New Year',
  url: 'https://storage.loikmon.org/audio/articles/11.mp3?sig=x',
  source: { kind: 'article', articleId: 11 },
})

const progressRow = (overrides: Record<string, unknown> = {}) => ({
  status: 'ok' as const,
  progress: [{ format: 'audio', location: '101', progress: 42, updated_at: '2026-09-01T00:00:00.000Z', ...overrides }],
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('track identity', () => {
  it('reads book and chapter ids from a chapter track', () => {
    const track = chapterTrack(101)
    expect(bookIdOf(track)).toBe('42')
    expect(chapterIdOf(track)).toBe('101')
  })

  it('has no position to restore for article narration', () => {
    expect(bookIdOf(articleTrack())).toBeNull()
    expect(chapterIdOf(articleTrack())).toBeNull()
  })
})

describe('loadAudioPosition', () => {
  it('returns the stored audio chapter and percent', async () => {
    mockGetProgress.mockReturnValue(response(progressRow()))
    await expect(loadAudioPosition(42)).resolves.toEqual({ chapterId: '101', percent: 42 })
  })

  it('ignores the reader rows and only restores audio', async () => {
    mockGetProgress.mockReturnValue(
      response({
        status: 'ok',
        progress: [
          { format: 'epub', location: 'epubcfi(/6/4)', progress: 80, updated_at: '' },
          { format: 'audio', location: '105', progress: 10, updated_at: '' },
        ],
      }),
    )
    await expect(loadAudioPosition(42)).resolves.toEqual({ chapterId: '105', percent: 10 })
  })

  it('does not resume a chapter that had barely started', async () => {
    mockGetProgress.mockReturnValue(response(progressRow({ progress: 0.4 })))
    await expect(loadAudioPosition(42)).resolves.toBeNull()
  })

  it('does not resume a chapter that already finished', async () => {
    mockGetProgress.mockReturnValue(response(progressRow({ progress: 99.5 })))
    await expect(loadAudioPosition(42)).resolves.toBeNull()
  })

  it('never blocks playback when the request fails', async () => {
    mockGetProgress.mockRejectedValue(new Error('offline'))
    await expect(loadAudioPosition(42)).resolves.toBeNull()
  })
})

describe('createProgressReporter', () => {
  it('sends the first position immediately, then throttles', () => {
    const save = vi.fn().mockResolvedValue({ data: { status: 'ok' } })
    let now = 1_000_000
    const reporter = createProgressReporter(save as never, () => now)

    reporter.report(chapterTrack(), 10)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('42', { format: 'audio', location: '101', progress: 10 })

    now += 1_000
    reporter.report(chapterTrack(), 11)
    reporter.report(chapterTrack(), 12)
    expect(save).toHaveBeenCalledTimes(1)

    now += SAVE_INTERVAL_MS
    reporter.report(chapterTrack(), 20)
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith('42', { format: 'audio', location: '101', progress: 20 })
  })

  it('flush sends the newest buffered position, ignoring the interval', async () => {
    const save = vi.fn().mockResolvedValue({ data: { status: 'ok' } })
    let now = 1_000_000
    const reporter = createProgressReporter(save as never, () => now)

    reporter.report(chapterTrack(), 10)
    now += 500
    reporter.report(chapterTrack(), 15)
    await reporter.flush()

    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith('42', { format: 'audio', location: '101', progress: 15 })
  })

  it('flush is a no-op when nothing new was recorded', async () => {
    const save = vi.fn().mockResolvedValue({ data: { status: 'ok' } })
    const reporter = createProgressReporter(save as never, () => 0)
    await reporter.flush()
    expect(save).not.toHaveBeenCalled()
  })

  it('does not report article narration, which has no book row', () => {
    const save = vi.fn().mockResolvedValue({ data: { status: 'ok' } })
    const reporter = createProgressReporter(save as never, () => 0)
    reporter.report(articleTrack(), 30)
    expect(save).not.toHaveBeenCalled()
  })

  it('clamps out-of-range percentages the server would reject', async () => {
    const save = vi.fn().mockResolvedValue({ data: { status: 'ok' } })
    const reporter = createProgressReporter(save as never, () => 0)
    reporter.report(chapterTrack(), 140)
    await reporter.flush()
    expect(save).toHaveBeenCalledWith('42', { format: 'audio', location: '101', progress: 100 })
  })

  it('swallows a failed save so playback is never interrupted', async () => {
    const save = vi.fn().mockRejectedValue(new Error('500'))
    const reporter = createProgressReporter(save as never, () => 0)
    reporter.report(chapterTrack(), 10)
    await expect(reporter.flush()).resolves.toBeUndefined()
  })

  it('reset drops an unsent position', async () => {
    const save = vi.fn().mockResolvedValue({ data: { status: 'ok' } })
    let now = 1_000_000
    const reporter = createProgressReporter(save as never, () => now)
    reporter.report(chapterTrack(), 10)
    now += 100
    reporter.report(chapterTrack(), 20)
    reporter.reset()
    await reporter.flush()
    expect(save).toHaveBeenCalledTimes(1)
  })
})
