import { useCallback, useEffect, useState } from 'react'
import { books as booksApi } from '@loikmon/api'
import type { BookAudioChapter } from '@loikmon/api'
import { chaptersToTracks, type AudioTrack } from '@/lib/audio'

interface UseBookAudioChaptersResult {
  chapters: BookAudioChapter[]
  tracks: AudioTrack[]
  loading: boolean
  error: string | null
  hasAudio: boolean
  refetch: () => void
}

/**
 * Fetch the audiobook chapters for a book via `getBookChapters`.
 *
 * The endpoint returns a success response when audio chapters exist and an
 * empty/error response otherwise. We treat any non-empty chapter list as
 * "has audio" and expose pre-built AudioTracks for the media player.
 */
export function useBookAudioChapters(
  bookId: string | number | undefined,
  bookTitle?: string,
): UseBookAudioChaptersResult {
  const [chapters, setChapters] = useState<BookAudioChapter[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!bookId) {
      setChapters([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await booksApi.getAudioChapters(bookId)
      const payload = res.data as Record<string, unknown>
      const data = payload.data as unknown
      const list: BookAudioChapter[] =
        Array.isArray(data) ? data :
        (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).chapters))
          ? (data as Record<string, unknown>).chapters as BookAudioChapter[] :
        Array.isArray(payload.chapters) ? payload.chapters as BookAudioChapter[] :
        []
      setChapters(list)
    } catch (err) {
      setChapters([])
      setError(err instanceof Error ? err.message : 'Failed to load audiobook chapters')
    } finally {
      setLoading(false)
    }
  }, [bookId])

  useEffect(() => {
    load()
  }, [load])

  const tracks = chaptersToTracks(chapters, bookTitle).map((track, _index, all) => ({
    ...track,
    sourceBookId: track.sourceBookId ?? bookId,
    queueLength: all.length,
  }))
  const hasAudio = tracks.length > 0

  return { chapters, tracks, loading, error, hasAudio, refetch: load }
}
