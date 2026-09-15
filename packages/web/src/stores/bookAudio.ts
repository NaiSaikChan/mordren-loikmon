import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { books as booksApi, errorMessage } from '@loikmon/api'
import type { AccessInfo, BookChapter, Id } from '@loikmon/api'
import { lockReasonFromAccess, lockReasonFromError, type LockReason } from '@/utils/access'

/** Where a track's (short-lived, signed) URL comes from, so the player can request a fresh one. */
export type AudioSource =
  | { kind: 'book'; bookId: Id | string; chapterId: Id | string }
  | { kind: 'article'; articleId: Id | string }

export interface AudioTrack {
  id: string | number
  title: string
  artist?: string
  /** Signed audio URL; empty when the track is locked. */
  url: string
  cover?: string
  /** Locked chapters cannot be played without a subscription (or signing in). */
  locked?: boolean
  lockReason?: LockReason
  source?: AudioSource
}

export interface BookAudioMeta {
  title?: string
  author?: string
  cover?: string | null
}

export function chapterToTrack(
  chapter: BookChapter,
  meta: BookAudioMeta = {},
  lockReason: LockReason = 'subscription_required',
): AudioTrack {
  const chapterTitle = chapter.title || chapter.chapter_title || `Chapter ${chapter.chapter_number}`
  const locked = chapter.locked || !chapter.audio_url
  return {
    id: chapter.id,
    title: meta.title ? `${meta.title} – ${chapterTitle}` : chapterTitle,
    artist: meta.author ?? '',
    url: locked ? '' : (chapter.audio_url ?? ''),
    cover: meta.cover ?? '',
    locked,
    lockReason: locked ? lockReason : undefined,
    source: { kind: 'book', bookId: chapter.book_id, chapterId: chapter.id },
  }
}

export const useBookAudioStore = defineStore('bookAudio', () => {
  const loading  = ref(false)
  const error    = ref<string | null>(null)
  const bookId   = ref<string | null>(null)
  const chapters = ref<BookChapter[]>([])
  const access   = shallowRef<AccessInfo | null>(null)
  const meta     = shallowRef<BookAudioMeta>({})

  /** Why locked chapters are locked (defaults to subscription). */
  const lockReason = computed<LockReason>(() => lockReasonFromAccess(access.value) ?? 'subscription_required')

  /** Every chapter in order, locked ones included (they render with a lock and open the paywall). */
  const tracks = computed<AudioTrack[]>(() => chapters.value.map((c) => chapterToTrack(c, meta.value, lockReason.value)))
  const playableTracks = computed(() => tracks.value.filter((t) => !t.locked && t.url))
  const lockedCount = computed(() => tracks.value.filter((t) => t.locked).length)

  async function fetchChapters(id: Id | string, info: BookAudioMeta = {}) {
    loading.value = true
    error.value = null
    bookId.value = String(id)
    meta.value = info
    try {
      const { data } = await booksApi.getChapters(id)
      chapters.value = data.chapters ?? []
      access.value = data.access ?? null
    } catch (err) {
      chapters.value = []
      const reason = lockReasonFromError(err)
      access.value = reason ? { granted: false, reason } : null
      error.value = errorMessage(err, 'Failed to load audiobook')
    } finally {
      loading.value = false
    }
  }

  function clear() {
    bookId.value = null
    chapters.value = []
    access.value = null
    error.value = null
  }

  return { loading, error, bookId, chapters, access, tracks, playableTracks, lockedCount, lockReason, fetchChapters, clear }
})
