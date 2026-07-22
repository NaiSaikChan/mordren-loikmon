import type { MediaItem } from '@loikmon/api'
import { fixUrl, pickCover } from './url'

export interface AudioTrack {
  id: string | number
  title: string
  artist?: string
  url: string
  cover?: string
}

/** Build an AudioTrack from a raw Loikmon media/book record, or null if it has no audio URL. */
export function toTrack(item: MediaItem | Record<string, unknown>): AudioTrack | null {
  const rec = item as Record<string, unknown>
  const url = fixUrl(
    (rec.audio_url as string) ?? (rec.audio as string) ?? (rec.file as string) ?? '',
  )
  if (!url) return null
  return {
    id: (rec.id as string | number) ?? url,
    title: (rec.title as string) ?? 'Untitled',
    artist: (rec.artist as string) ?? (rec.authorname as string) ?? (rec.author as string) ?? '',
    url,
    cover: pickCover(rec),
  }
}
