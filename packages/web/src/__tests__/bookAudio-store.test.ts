import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { BookChapter } from '@loikmon/api'
import { apiError, response } from './helpers'

const mockGetChapters = vi.fn()

vi.mock('@loikmon/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@loikmon/api')>()
  return { ...actual, books: { ...actual.books, getChapters: (...a: unknown[]) => mockGetChapters(...a) } }
})

import { useBookAudioStore } from '@/stores/bookAudio'

const chapter = (n: number, overrides: Partial<BookChapter> = {}): BookChapter => ({
  id: 100 + n,
  book_id: 42,
  chapter_number: n,
  title: `Chapter ${n}`,
  chapter_title: `Chapter ${n}`,
  duration_seconds: 60,
  duration: 60,
  is_preview: false,
  locked: false,
  audio_url: `https://storage.loikmon.org/audio/42/${n}.mp3?sig=x`,
  ...overrides,
})

describe('useBookAudioStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('maps chapters to tracks using the signed audio_url', async () => {
    mockGetChapters.mockReturnValueOnce(response({ status: 'ok', book_id: 42, access: { granted: true, reason: 'subscription' }, chapters: [chapter(1), chapter(2)] }))
    const store = useBookAudioStore()

    await store.fetchChapters(42, { title: 'Book', author: 'Author' })

    expect(mockGetChapters).toHaveBeenCalledWith(42)
    expect(store.tracks).toHaveLength(2)
    expect(store.tracks[0]).toMatchObject({
      id: 101,
      title: 'Book – Chapter 1',
      artist: 'Author',
      url: 'https://storage.loikmon.org/audio/42/1.mp3?sig=x',
      locked: false,
      source: { kind: 'book', bookId: 42, chapterId: 101 },
    })
    expect(store.playableTracks).toHaveLength(2)
    expect(store.lockedCount).toBe(0)
  })

  it('keeps locked chapters (no audio_url) as locked tracks; previews stay playable', async () => {
    mockGetChapters.mockReturnValueOnce(response({
      status: 'ok',
      book_id: 42,
      access: { granted: false, reason: 'subscription_required' },
      chapters: [chapter(1, { is_preview: true }), chapter(2, { locked: true, audio_url: null }), chapter(3, { locked: true, audio_url: null })],
    }))
    const store = useBookAudioStore()

    await store.fetchChapters(42)

    expect(store.tracks.map((t) => t.locked)).toEqual([false, true, true])
    expect(store.tracks[1].url).toBe('')
    expect(store.tracks[1].lockReason).toBe('subscription_required')
    expect(store.playableTracks.map((t) => t.id)).toEqual([101])
    expect(store.lockedCount).toBe(2)
  })

  it('uses login_required as the lock reason for anonymous listeners', async () => {
    mockGetChapters.mockReturnValueOnce(response({
      status: 'ok', book_id: 42, access: { granted: false, reason: 'login_required' }, chapters: [chapter(1, { locked: true, audio_url: null })],
    }))
    const store = useBookAudioStore()
    await store.fetchChapters(42)
    expect(store.lockReason).toBe('login_required')
    expect(store.tracks[0].lockReason).toBe('login_required')
  })

  it('clears tracks on error', async () => {
    mockGetChapters.mockRejectedValueOnce(apiError(0, 'NETWORK_ERROR', 'network'))
    const store = useBookAudioStore()
    await store.fetchChapters('1')
    expect(store.tracks).toHaveLength(0)
    expect(store.error).toBe('network')
  })
})
