import { EXPIRY_MARGIN_SECONDS, isExpired, refreshTrackUrl } from '@/lib/refreshTrack'
import type { AudioTrack } from '@/lib/audio'

const mockGetChapters = jest.fn()
const mockGetArticle = jest.fn()

jest.mock('@loikmon/api', () => {
  const actual = jest.requireActual('@loikmon/api')
  return {
    ...actual,
    books: { ...actual.books, getChapters: (...a: unknown[]) => mockGetChapters(...a) },
    articles: { ...actual.articles, getArticle: (...a: unknown[]) => mockGetArticle(...a) },
  }
})

const chapterTrack = (overrides: Partial<AudioTrack> = {}): AudioTrack => ({
  id: 101,
  title: 'Mon Chronicles – Chapter 1',
  url: 'https://storage.loikmon.org/audio/42/1.mp3?X-Amz-Signature=old',
  sourceType: 'book',
  sourceBookId: 42,
  chapterId: 101,
  expiresAt: null,
  ...overrides,
})

const chapter = (overrides: Record<string, unknown> = {}) => ({
  id: 101,
  book_id: 42,
  chapter_number: 1,
  title: 'Chapter 1',
  chapter_title: 'Chapter 1',
  duration_seconds: 600,
  duration: 600,
  is_preview: false,
  locked: false,
  audio_url: 'https://storage.loikmon.org/audio/42/1.mp3?X-Amz-Signature=fresh',
  audio_expires_at: '2026-09-22T12:00:00.000Z',
  ...overrides,
})

const ok = (data: unknown) => Promise.resolve({ data })

beforeEach(() => {
  jest.clearAllMocks()
})

describe('isExpired', () => {
  const now = Date.parse('2026-09-22T12:00:00.000Z')

  it('treats a missing expiry as still valid', () => {
    expect(isExpired(null, now)).toBe(false)
    expect(isExpired(undefined, now)).toBe(false)
  })

  it('treats an unparsable expiry as still valid, leaving it to the error path', () => {
    expect(isExpired('not-a-date', now)).toBe(false)
  })

  it('is valid comfortably before the expiry', () => {
    expect(isExpired(new Date(now + 10 * 60_000).toISOString(), now)).toBe(false)
  })

  it('re-signs early, inside the safety margin', () => {
    const justInsideMargin = new Date(now + (EXPIRY_MARGIN_SECONDS - 5) * 1000).toISOString()
    expect(isExpired(justInsideMargin, now)).toBe(true)
  })

  it('is expired once the timestamp has passed', () => {
    expect(isExpired(new Date(now - 1000).toISOString(), now)).toBe(true)
  })
})

describe('refreshTrackUrl for a book chapter', () => {
  it('returns a freshly signed URL and its new expiry', async () => {
    mockGetChapters.mockReturnValue(ok({ chapters: [chapter()], access: { granted: true, reason: 'subscription' } }))

    await expect(refreshTrackUrl(chapterTrack())).resolves.toEqual({
      kind: 'url',
      url: 'https://storage.loikmon.org/audio/42/1.mp3?X-Amz-Signature=fresh',
      expiresAt: '2026-09-22T12:00:00.000Z',
    })
  })

  it('reports a lapsed subscription rather than failing silently', async () => {
    mockGetChapters.mockReturnValue(
      ok({
        chapters: [chapter({ locked: true, audio_url: null })],
        access: { granted: false, reason: 'subscription_required' },
      }),
    )

    await expect(refreshTrackUrl(chapterTrack(), true)).resolves.toEqual({ kind: 'locked', action: 'subscribe' })
  })

  it('sends a signed-out listener to sign in', async () => {
    mockGetChapters.mockReturnValue(
      ok({
        chapters: [chapter({ locked: true, audio_url: null })],
        access: { granted: false, reason: 'login_required' },
      }),
    )

    await expect(refreshTrackUrl(chapterTrack(), false)).resolves.toEqual({ kind: 'locked', action: 'login' })
  })

  it('returns null when the chapter is gone', async () => {
    mockGetChapters.mockReturnValue(ok({ chapters: [], access: { granted: true, reason: 'subscription' } }))
    await expect(refreshTrackUrl(chapterTrack())).resolves.toBeNull()
  })

  it('returns null without calling the API when the track has no chapter to re-sign', async () => {
    await expect(refreshTrackUrl(chapterTrack({ chapterId: undefined }))).resolves.toBeNull()
    expect(mockGetChapters).not.toHaveBeenCalled()
  })

  it('returns null on a network failure so the caller can surface a retry', async () => {
    mockGetChapters.mockRejectedValue(new Error('offline'))
    await expect(refreshTrackUrl(chapterTrack())).resolves.toBeNull()
  })
})

describe('refreshTrackUrl for article narration', () => {
  const articleTrack: AudioTrack = {
    id: 'article-11',
    title: 'Mon New Year',
    url: 'https://storage.loikmon.org/audio/articles/11.mp3?X-Amz-Signature=old',
    sourceType: 'article',
    sourceBookId: 11,
  }

  it('returns a freshly signed URL', async () => {
    mockGetArticle.mockReturnValue(
      ok({
        article: {
          id: 11,
          audio_url: 'https://storage.loikmon.org/audio/articles/11.mp3?X-Amz-Signature=fresh',
          audio_expires_at: '2026-09-22T12:00:00.000Z',
          locked: false,
          access: { granted: true, reason: 'subscription' },
        },
      }),
    )

    await expect(refreshTrackUrl(articleTrack)).resolves.toEqual({
      kind: 'url',
      url: 'https://storage.loikmon.org/audio/articles/11.mp3?X-Amz-Signature=fresh',
      expiresAt: '2026-09-22T12:00:00.000Z',
    })
    expect(mockGetArticle).toHaveBeenCalledWith(11)
  })

  it('reports a locked article', async () => {
    mockGetArticle.mockReturnValue(
      ok({
        article: {
          id: 11,
          audio_url: null,
          locked: true,
          access: { granted: false, reason: 'subscription_required' },
        },
      }),
    )

    await expect(refreshTrackUrl(articleTrack, true)).resolves.toEqual({ kind: 'locked', action: 'subscribe' })
  })
})
