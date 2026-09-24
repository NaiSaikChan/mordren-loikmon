import { articles as articlesApi, books as booksApi, errorCode } from '@loikmon/api'
import type { AudioTrack } from './audio'
import { actionForErrorCode, accessAction, type AccessAction } from './access'
import { fixUrl } from './url'

/**
 * Signed audio URLs are short-lived, and an audiobook sitting easily outlives
 * one. Rather than letting playback die silently, the URL is re-requested from
 * the endpoint that issued it.
 */
export type RefreshedTrack =
  | { kind: 'url'; url: string; expiresAt: string | null }
  /** Access was lost (signed out, subscription lapsed): the CTA to show instead. */
  | { kind: 'locked'; action: Exclude<AccessAction, 'open'> }
  | null

/** Re-sign this many seconds before the stated expiry, so a slow request still lands in time. */
export const EXPIRY_MARGIN_SECONDS = 30

/**
 * Whether a signed URL is at (or nearly at) its expiry. Missing or unparsable
 * timestamps count as still valid: the error path re-signs anyway.
 */
export function isExpired(expiresAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!expiresAt) return false
  const at = Date.parse(expiresAt)
  if (Number.isNaN(at)) return false
  return at - EXPIRY_MARGIN_SECONDS * 1000 <= now
}

/**
 * Asks the server for a fresh URL for a track, or reports that it is now locked.
 * Returns null when the track cannot be resolved at all (deleted, offline).
 */
export async function refreshTrackUrl(track: AudioTrack, isLoggedIn = true): Promise<RefreshedTrack> {
  try {
    if (track.sourceType === 'article') {
      const { data } = await articlesApi.getArticle(track.sourceBookId ?? track.id)
      const article = data.article
      const url = fixUrl(article.audio_url)
      if (url) return { kind: 'url', url, expiresAt: article.audio_expires_at ?? null }
      if (article.locked) {
        const action = accessAction(article.access, isLoggedIn)
        return action === 'open' ? null : { kind: 'locked', action }
      }
      return null
    }

    if (track.sourceBookId == null || track.chapterId == null) return null
    const { data } = await booksApi.getChapters(track.sourceBookId)
    const chapter = data.chapters.find((c) => String(c.id) === String(track.chapterId))
    if (!chapter) return null
    const url = fixUrl(chapter.audio_url)
    if (!chapter.locked && url) {
      return { kind: 'url', url, expiresAt: chapter.audio_expires_at ?? null }
    }
    const action = accessAction(data.access, isLoggedIn)
    return action === 'open' ? null : { kind: 'locked', action }
  } catch (err) {
    const action = actionForErrorCode(errorCode(err))
    return action && action !== 'open' ? { kind: 'locked', action } : null
  }
}
