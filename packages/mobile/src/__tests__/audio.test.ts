import type { BookChapter } from '@loikmon/api'
import { articleToTrack, chapterToTrack, chaptersToTracks, isPlayableChapter } from '@/lib/audio'

const SIGNED = 'https://s3.loikmon.org/private/audio/ch.mp3?X-Amz-Credential=a%2Fb&X-Amz-Signature=abc'

function chapter(overrides: Partial<BookChapter>): BookChapter {
  return {
    id: 1,
    book_id: 72,
    chapter_number: 1,
    title: 'The Game',
    chapter_title: 'The Game',
    duration_seconds: 963,
    duration: 963,
    is_preview: false,
    locked: false,
    audio_url: SIGNED,
    ...overrides,
  }
}

const BOOK = { id: 72, title: 'The Game of Life', authorname: 'Florence Scovel Shinn', thumbnail: 'https://s3.loikmon.org/public/covers/72.jpg' }

describe('isPlayableChapter', () => {
  it('requires an unlocked chapter with an audio URL', () => {
    expect(isPlayableChapter(chapter({}))).toBe(true)
    expect(isPlayableChapter(chapter({ locked: true, audio_url: null }))).toBe(false)
    expect(isPlayableChapter(chapter({ locked: false, audio_url: null }))).toBe(false)
    // Defensive: a locked chapter must never play even if a URL slipped through.
    expect(isPlayableChapter(chapter({ locked: true }))).toBe(false)
  })
})

describe('chapterToTrack', () => {
  it('builds a track and keeps the signed URL intact', () => {
    const track = chapterToTrack(chapter({}), BOOK)
    expect(track).toMatchObject({
      id: 1,
      title: 'The Game of Life – The Game',
      chapterTitle: 'The Game',
      artist: 'Florence Scovel Shinn',
      url: SIGNED,
      cover: BOOK.thumbnail,
      sourceBookId: 72,
      sourceType: 'book',
    })
  })

  it('returns null for locked chapters', () => {
    expect(chapterToTrack(chapter({ locked: true, audio_url: null }), BOOK)).toBeNull()
  })
})

describe('chaptersToTracks', () => {
  it('skips locked chapters, orders by chapter number and sets queue length', () => {
    const tracks = chaptersToTracks(
      [
        chapter({ id: 3, chapter_number: 3, chapter_title: 'Three' }),
        chapter({ id: 2, chapter_number: 2, chapter_title: 'Two', locked: true, audio_url: null }),
        chapter({ id: 1, chapter_number: 1, chapter_title: 'One', is_preview: true }),
      ],
      BOOK,
    )
    expect(tracks.map((t) => t.id)).toEqual([1, 3])
    expect(tracks.every((t) => t.queueLength === 2)).toBe(true)
  })
})

describe('articleToTrack', () => {
  const article = { id: 9, title: 'News', authorname: 'Nai', thumbnail: null, thumbnail_url: null, audio_url: SIGNED, locked: false }

  it('builds an article track routed back to the article', () => {
    expect(articleToTrack(article)).toMatchObject({ url: SIGNED, sourceBookId: 9, sourceType: 'article' })
  })

  it('returns null when locked or without audio', () => {
    expect(articleToTrack({ ...article, locked: true })).toBeNull()
    expect(articleToTrack({ ...article, audio_url: null })).toBeNull()
  })
})
