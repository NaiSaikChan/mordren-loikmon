import { useCallback, useEffect, useMemo, useState } from 'react'
import { books as booksApi, errorMessage } from '@loikmon/api'
import type { AccessInfo, BookChapter } from '@loikmon/api'
import { useAuth } from '@/context/AuthContext'
import { chaptersToTracks, type AudioTrack, type TrackSource } from '@/lib/audio'

interface UseBookAudioChaptersResult {
  /** All chapters, including locked ones (shown with a lock, never played). */
  chapters: BookChapter[]
  /** Playable tracks only (unlocked chapters with a signed audio URL). */
  tracks: AudioTrack[]
  access: AccessInfo | null
  lockedCount: number
  loading: boolean
  error: string | null
  hasAudio: boolean
  refetch: () => Promise<void>
}

/**
 * Audiobook chapters via `books.getChapters`. Locked chapters come without
 * `audio_url`; preview chapters stay open. Re-fetches when the entitlement
 * changes (e.g. right after subscribing) so locks and URLs are current.
 */
export function useBookAudioChapters(bookId: string | number | undefined, book?: TrackSource): UseBookAudioChaptersResult {
  const { user, entitlement } = useAuth()
  const [chapters, setChapters] = useState<BookChapter[]>([])
  const [access, setAccess] = useState<AccessInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const accessKey = `${user?.id ?? ''}:${entitlement?.active ? 1 : 0}`

  const load = useCallback(async () => {
    if (bookId == null || String(bookId) === '') {
      setChapters([])
      setAccess(null)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data } = await booksApi.getChapters(bookId)
      setChapters(data.chapters ?? [])
      setAccess(data.access ?? null)
    } catch (err) {
      setChapters([])
      setError(errorMessage(err, 'Failed to load audiobook chapters'))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, accessKey])

  useEffect(() => {
    void load()
  }, [load])

  const title = book?.title
  const author = book?.authorname
  const cover = book?.thumbnail ?? book?.cover_url ?? book?.coverphoto
  const tracks = useMemo(
    () => chaptersToTracks(chapters, { id: bookId, title, authorname: author, thumbnail: cover }),
    [chapters, bookId, title, author, cover],
  )
  const lockedCount = useMemo(() => chapters.filter((c) => c.locked).length, [chapters])

  return { chapters, tracks, access, lockedCount, loading, error, hasAudio: chapters.length > 0, refetch: load }
}
