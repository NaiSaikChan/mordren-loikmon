import type { ArticleDetail, BookChapter } from '@loikmon/api'
import { fixUrl, pickCover } from './url'

export interface AudioTrack {
  id: string | number
  title: string
  chapterTitle?: string
  artist?: string
  /** Playable URL (signed, short-lived for premium content). */
  url: string
  cover?: string
  /** Book or article the track belongs to (used to reopen the player / article). */
  sourceBookId?: string | number
  sourceType?: 'book' | 'article'
  queueLength?: number
}

export interface TrackSource {
  id?: string | number
  title?: string | null
  authorname?: string | null
  thumbnail?: string | null
  cover_url?: string | null
  coverphoto?: string | null
}

/** Chapters the viewer may play: not locked and with an audio URL. */
export function isPlayableChapter(chapter: Pick<BookChapter, 'locked' | 'audio_url'>): boolean {
  return !chapter.locked && typeof chapter.audio_url === 'string' && chapter.audio_url.length > 0
}

/**
 * Track for a book chapter, or null when the chapter is locked / has no audio.
 * Locked chapters must never reach the player.
 */
export function chapterToTrack(chapter: BookChapter, book?: TrackSource): AudioTrack | null {
  if (!isPlayableChapter(chapter)) return null
  const url = fixUrl(chapter.audio_url)
  if (!url) return null
  const chapterTitle = (chapter.chapter_title || chapter.title || `#${chapter.chapter_number}`).trim()
  const bookTitle = book?.title?.trim()
  return {
    id: chapter.id,
    title: [bookTitle, chapterTitle].filter(Boolean).join(' – ') || 'Untitled chapter',
    chapterTitle,
    artist: book?.authorname ?? '',
    url,
    cover: book ? pickCover(book) : '',
    sourceBookId: chapter.book_id ?? book?.id,
    sourceType: 'book',
    queueLength: 1,
  }
}

/** Playable tracks (locked chapters skipped), in chapter order, with queue metadata. */
export function chaptersToTracks(chapters: BookChapter[], book?: TrackSource): AudioTrack[] {
  const tracks = [...chapters]
    .sort((a, b) => a.chapter_number - b.chapter_number)
    .map((chapter) => chapterToTrack(chapter, book))
    .filter((track): track is AudioTrack => track !== null)
  return tracks.map((track) => ({ ...track, queueLength: tracks.length }))
}

/** Track for an article's narration, or null when locked / no audio. */
export function articleToTrack(article: Pick<ArticleDetail, 'id' | 'title' | 'authorname' | 'thumbnail' | 'thumbnail_url' | 'audio_url' | 'locked'>): AudioTrack | null {
  if (article.locked || !article.audio_url) return null
  const url = fixUrl(article.audio_url)
  if (!url) return null
  return {
    id: `article-${article.id}`,
    title: article.title,
    chapterTitle: article.title,
    artist: article.authorname ?? '',
    url,
    cover: fixUrl(article.thumbnail_url || article.thumbnail),
    sourceBookId: article.id,
    sourceType: 'article',
    queueLength: 1,
  }
}
