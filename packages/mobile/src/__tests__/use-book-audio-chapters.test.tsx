/**
 * @jest-environment jsdom
 */
import { useBookAudioChapters } from '@/hooks/useBookAudioChapters'
import { renderHook, waitFor } from '@/test-utils/renderHook'

const mockGetChapters = jest.fn()
let mockAuth = { user: { id: 'u1' } as { id: string } | null, entitlement: { active: false } }

// The real client pulls in axios, which needs Node globals jsdom lacks.
jest.mock('@loikmon/api', () => ({
  books: { getChapters: (...a: unknown[]) => mockGetChapters(...a) },
  errorMessage: (err: unknown, fallback: string) => (err instanceof Error && err.message) || fallback,
  ApiError: class ApiError extends Error {},
}))

jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }))

const chapter = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  book_id: 72,
  chapter_number: id,
  title: `Chapter ${id}`,
  chapter_title: `Chapter ${id}`,
  duration_seconds: 600,
  duration: 600,
  is_preview: false,
  locked: false,
  audio_url: `https://s3.test/audio/${id}.mp3?X-Amz-Signature=a`,
  ...extra,
})

const BOOK = {
  id: 72,
  title: 'The Game of Life',
  authorname: 'Florence',
  thumbnail: 'https://s3.test/covers/72.jpg',
  cover_image: { src: 'https://s3.test/covers/72.jpg', variants: { sm: 'https://s3.test/covers/72-sm.webp' } },
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAuth = { user: { id: 'u1' }, entitlement: { active: false } }
})

describe('useBookAudioChapters', () => {
  it('keeps its result shape and builds playable tracks', async () => {
    mockGetChapters.mockResolvedValue({
      data: {
        chapters: [chapter(2), chapter(1), chapter(3, { locked: true, audio_url: null })],
        access: { has_access: false },
      },
    })
    const { result } = await renderHook(() => useBookAudioChapters(72, BOOK))

    await waitFor(() => expect(result.current.chapters).toHaveLength(3))
    expect(result.current).toMatchObject({
      lockedCount: 1,
      loading: false,
      error: null,
      hasAudio: true,
      access: { has_access: false },
    })
    expect(result.current.tracks.map((t) => t.id)).toEqual([1, 2])
    // The responsive cover travels with the track, for right-sized artwork.
    expect(result.current.tracks[0].coverImage).toEqual(BOOK.cover_image)
    expect(typeof result.current.refetch).toBe('function')
  })

  it('does not fetch without a book id', async () => {
    const { result } = await renderHook(() => useBookAudioChapters(undefined))
    expect(mockGetChapters).not.toHaveBeenCalled()
    expect(result.current).toMatchObject({ chapters: [], tracks: [], loading: false, error: null, hasAudio: false })
  })

  it('reports a failed load as an error message', async () => {
    mockGetChapters.mockRejectedValue(new Error('Network down'))
    const { result } = await renderHook(() => useBookAudioChapters(72))
    await waitFor(() => expect(result.current.error).toBe('Network down'))
    expect(result.current.chapters).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('refetches when the entitlement changes, so locks and URLs are current', async () => {
    mockGetChapters.mockResolvedValue({ data: { chapters: [chapter(1)], access: null } })
    const { result, rerender } = await renderHook((props: { active: boolean }) => {
      mockAuth = { user: { id: 'u1' }, entitlement: { active: props.active } }
      return useBookAudioChapters(72)
    }, { initialProps: { active: false } })
    await waitFor(() => expect(result.current.chapters).toHaveLength(1))
    expect(mockGetChapters).toHaveBeenCalledTimes(1)

    await rerender({ active: true })
    await waitFor(() => expect(mockGetChapters).toHaveBeenCalledTimes(2))
  })
})
