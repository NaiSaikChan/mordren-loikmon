import type { ArticleDetail, BookChapter } from '@loikmon/api'
import { fixUrl, pickCover, pickImage, type ImageVariants } from './url'

export interface AudioTrack {
  id: string | number
  title: string
  chapterTitle?: string
  artist?: string
  /** Playable URL (signed, short-lived for premium content). */
  url: string
  cover?: string
  /** Responsive renditions of `cover`, so each surface can download a right-sized WebP. */
  coverImage?: ImageVariants | null
  /** Book or article the track belongs to (used to reopen the player / article). */
  sourceBookId?: string | number
  sourceType?: 'book' | 'article'
  queueLength?: number
  /** Chapter this track came from; the listening position is stored against it. */
  chapterId?: string | number
  /** Chapter length as the API reports it, so a duration can be shown before the file loads. */
  durationSeconds?: number | null
  /** When `url` stops working. A signed URL outlives few listening sessions, so it is re-requested. */
  expiresAt?: string | null
}

export interface TrackSource {
  id?: string | number
  title?: string | null
  authorname?: string | null
  thumbnail?: string | null
  cover_url?: string | null
  coverphoto?: string | null
  cover_image?: ImageVariants | null
  thumbnail_image?: ImageVariants | null
}

/** Rendered width of the lock screen / notification artwork, in points. */
export const LOCK_SCREEN_ART_WIDTH = 300

/**
 * Best URL for a track's cover shown `displayWidth` points wide: the smallest
 * responsive rendition that stays sharp, else the legacy full-size cover.
 */
export function trackImage(track: Pick<AudioTrack, 'cover' | 'coverImage'> | null | undefined, displayWidth: number): string {
  if (!track) return ''
  return pickImage({ cover_image: track.coverImage ?? null, thumbnail: track.cover ?? null }, displayWidth)
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
    coverImage: book?.cover_image ?? book?.thumbnail_image ?? null,
    sourceBookId: chapter.book_id ?? book?.id,
    sourceType: 'book',
    queueLength: 1,
    chapterId: chapter.id,
    durationSeconds: chapter.duration_seconds ?? chapter.duration ?? null,
    expiresAt: chapter.audio_expires_at ?? null,
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
export function articleToTrack(
  article: Pick<ArticleDetail, 'id' | 'title' | 'authorname' | 'thumbnail' | 'thumbnail_url' | 'audio_url' | 'locked'> & {
    audio_expires_at?: string | null
    thumbnail_image?: ImageVariants | null
  },
): AudioTrack | null {
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
    coverImage: article.thumbnail_image ?? null,
    sourceBookId: article.id,
    sourceType: 'article',
    queueLength: 1,
    expiresAt: article.audio_expires_at ?? null,
  }
}
