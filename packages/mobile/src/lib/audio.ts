import type { MediaItem, BookAudioChapter } from '@loikmon/api'
import { fixUrl, pickCover } from './url'

export interface AudioTrack {
  id: string | number
  title: string
  chapterTitle?: string
  artist?: string
  url: string
  cover?: string
  sourceBookId?: string | number
  queueLength?: number
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

function pickAudioUrl(rec: Record<string, unknown>): string {
  // Prefer the full-hosted URL if present; otherwise accept an absolute/relative audio_file path.
  const candidates = [
    rec.audio_url,
    rec.audio,
    rec.audio_file,
    rec.stream_url,
    rec.file,
  ]
  const http = candidates.find(isHttpUrl)
  if (http) return http
  const anyString = candidates.find((c): c is string => typeof c === 'string' && c.length > 0)
  return anyString ?? ''
}

function pickAudioTitle(rec: Record<string, unknown>): string {
  return (rec.title as string) ?? (rec.chapter_title as string) ?? 'Chapter'
}

/** Build an AudioTrack from a raw Loikmon media/book record, or null if it has no audio URL. */
export function toTrack(item: MediaItem | Record<string, unknown>): AudioTrack | null {
  const rec = item as Record<string, unknown>
  const url = fixUrl(pickAudioUrl(rec))
  if (!url) return null
  return {
    id: (rec.id as string | number) ?? url,
    title: (rec.title as string) ?? 'Untitled',
    chapterTitle: (rec.title as string) ?? undefined,
    artist: (rec.artist as string) ?? (rec.authorname as string) ?? (rec.author as string) ?? '',
    url,
    cover: pickCover(rec),
    sourceBookId:
      (rec.book_id as string | number) ??
      (rec.bookid as string | number) ??
      (rec.id as string | number) ??
      undefined,
    queueLength: 1,
  }
}

/**
 * Build an AudioTrack from a Loikmon book audio chapter.
 *
 * The server often returns chapter titles in either `title` or `chapter_title`
 * and the audio file in `audio`, `audio_file`, or `stream_url`.
 */
export function toChapterTrack(
  chapter: BookAudioChapter | Record<string, unknown>,
  bookTitle?: string,
): AudioTrack | null {
  const rec = chapter as Record<string, unknown>
  const url = fixUrl(pickAudioUrl(rec))
  if (!url) return null
  const chapterTitle = pickAudioTitle(rec)
  const title = [bookTitle, chapterTitle].filter(Boolean).join(' – ')
  return {
    id: (rec.id as string | number) ?? url,
    title: title || 'Untitled Chapter',
    chapterTitle,
    artist: '',
    url,
    cover: '',
    sourceBookId:
      (rec.book_id as string | number) ??
      (rec.bookid as string | number) ??
      (rec.book as string | number) ??
      undefined,
    queueLength: 1,
  }
}

/**
 * Extract playable audio tracks from a `getBookChapters` response.
 * The endpoint may wrap chapters in `data` or `data.chapters`.
 */
export function chaptersToTracks(
  payload: unknown,
  bookTitle?: string,
): AudioTrack[] {
  if (!payload) return []

  let list: unknown = payload
  if (Array.isArray(list)) {
    // already an array
  } else if (typeof list === 'object') {
    const obj = list as Record<string, unknown>
    if (Array.isArray(obj.data)) list = obj.data
    else if (Array.isArray((obj.data as Record<string, unknown>)?.chapters)) {
      list = (obj.data as Record<string, unknown>).chapters
    } else if (Array.isArray(obj.chapters)) list = obj.chapters
    else list = Object.values(obj)
  }

  if (!Array.isArray(list)) return []

  const tracks: AudioTrack[] = []
  for (const item of list) {
    const track = toChapterTrack(item as Record<string, unknown>, bookTitle)
    if (track) tracks.push(track)
  }
  return tracks
}
