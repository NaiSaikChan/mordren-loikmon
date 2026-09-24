import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { books as booksApi, errorMessage } from '@loikmon/api'
import type { AccessInfo, BookChapter } from '@loikmon/api'
import { useAuth } from '@/context/AuthContext'
import { chaptersToTracks, type AudioTrack, type TrackSource } from '@/lib/audio'
import { queryKeys } from '@/lib/queryClient'

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

const EMPTY: BookChapter[] = []

/**
 * Audiobook chapters via `books.getChapters`. Locked chapters come without
 * `audio_url`; preview chapters stay open. The cache key includes the viewer's
 * entitlement, so subscribing (or signing in/out) fetches fresh locks and URLs.
 */
export function useBookAudioChapters(bookId: string | number | undefined, book?: TrackSource): UseBookAudioChaptersResult {
  const { user, entitlement } = useAuth()
  const accessKey = `${user?.id ?? ''}:${entitlement?.active ? 1 : 0}`
  const enabled = bookId != null && String(bookId) !== ''

  const query = useQuery({
    queryKey: queryKeys.bookChapters(enabled ? bookId : '', accessKey),
    queryFn: async () => {
      const { data } = await booksApi.getChapters(bookId as string | number)
      return { chapters: data.chapters ?? [], access: data.access ?? null }
    },
    enabled,
  })

  const chapters = (enabled && query.data?.chapters) || EMPTY
  const access = enabled ? (query.data?.access ?? null) : null
  const error = enabled && query.error ? errorMessage(query.error, 'Failed to load audiobook chapters') : null

  const { refetch: refetchQuery } = query
  const refetch = useCallback(async () => {
    if (!enabled) return
    await refetchQuery()
  }, [enabled, refetchQuery])

  const title = book?.title
  const author = book?.authorname
  const cover = book?.thumbnail ?? book?.cover_url ?? book?.coverphoto
  const coverImage = book?.cover_image ?? book?.thumbnail_image ?? null
  const tracks = useMemo(
    () => chaptersToTracks(chapters, { id: bookId, title, authorname: author, thumbnail: cover, cover_image: coverImage }),
    [chapters, bookId, title, author, cover, coverImage],
  )
  const lockedCount = useMemo(() => chapters.filter((c) => c.locked).length, [chapters])

  return {
    chapters,
    tracks,
    access,
    lockedCount,
    loading: enabled && query.isFetching && !query.data,
    error,
    hasAudio: chapters.length > 0,
    refetch,
  }
}
