import { articles as articlesApi, books as booksApi } from '@loikmon/api'
import type { AudioTrack } from '@/stores/bookAudio'
import { lockReasonFromAccess, lockReasonFromError, type LockReason } from '@/utils/access'

export interface PlayAudioDetail {
  track: AudioTrack
  queue?: AudioTrack[]
}

declare global {
  interface WindowEventMap {
    'loikmon:playAudioTrack': CustomEvent<PlayAudioDetail>
  }
}

/** Hands a track (and optional queue) to the global AudioPlayer. */
export function playAudio(track: AudioTrack, queue?: AudioTrack[]) {
  window.dispatchEvent(new CustomEvent<PlayAudioDetail>('loikmon:playAudioTrack', { detail: { track, queue } }))
}

export type RefreshedTrackUrl = { url: string } | { locked: LockReason } | null

/**
 * Signed audio URLs are short-lived. Asks the server for a fresh URL for the
 * track (or learns that it is now locked). Returns null when it cannot be resolved.
 */
export async function refreshTrackUrl(track: AudioTrack): Promise<RefreshedTrackUrl> {
  const source = track.source
  if (!source) return null
  try {
    if (source.kind === 'book') {
      const { data } = await booksApi.getChapters(source.bookId)
      const chapter = data.chapters.find((c) => String(c.id) === String(source.chapterId))
      if (!chapter) return null
      if (chapter.locked || !chapter.audio_url) return { locked: lockReasonFromAccess(data.access) ?? 'subscription_required' }
      return { url: chapter.audio_url }
    }
    const { data } = await articlesApi.getArticle(source.articleId)
    if (data.article.audio_url) return { url: data.article.audio_url }
    if (data.article.locked) return { locked: lockReasonFromAccess(data.article.access) ?? 'subscription_required' }
    return null
  } catch (err) {
    const reason = lockReasonFromError(err)
    return reason ? { locked: reason } : null
  }
}
