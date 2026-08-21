import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { books as booksApi } from '@loikmon/api'
import type { BookAudioChapter } from '@loikmon/api'

export interface AudioTrack {
  id: string | number
  title: string
  artist?: string
  url: string
  cover?: string
}

function pickChapterUrl(chapter: BookAudioChapter): string {
  const rec = chapter as Record<string, unknown>
  const raw =
    (rec.audio_url as string) ??
    (rec.audio as string) ??
    (rec.audio_file as string) ??
    (rec.stream_url as string) ??
    ''
  return normalizeAudioUrl(raw)
}

export function normalizeAudioUrl(url: string): string {
  if (!url) return ''
  let u = url
  try {
    const decoded = JSON.parse(`"${u}"`)
    if (typeof decoded === 'string' && decoded.startsWith('http')) u = decoded
  } catch { /* ignore */ }
  u = u.replace(/\\/g, '/')
  u = u.replace(/\u202f/gi, '%E2%80%AF').replace(/ /g, '%20')
  if (u.startsWith('http://') || u.startsWith('https://')) return u
  return `https://loikmon.org${u.startsWith('/') ? '' : '/'}${u}`
}

function toChapterTrack(
  chapter: BookAudioChapter,
  bookTitle?: string,
): AudioTrack | null {
  const rec = chapter as Record<string, unknown>
  const url = pickChapterUrl(chapter)
  if (!url) return null
  const title = (rec.chapter_title as string) ?? (rec.title as string) ?? 'Chapter'
  return {
    id: (rec.id as string | number) ?? url,
    title: bookTitle ? `${bookTitle} – ${title}` : title,
    artist: '',
    url,
    cover: '',
  }
}

export const useBookAudioStore = defineStore('bookAudio', () => {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const chapters = ref<BookAudioChapter[]>([])

  const bookTitle = ref<string | undefined>(undefined)

  const tracks = computed<AudioTrack[]>(() =>
    Array.from(chapters.value ?? [])
      .map((c) => toChapterTrack(c, bookTitle.value))
      .filter((t): t is AudioTrack => t !== null),
  )

  async function fetchChapters(bookId: string | number, title?: string) {
    loading.value = true
    error.value = null
    bookTitle.value = title
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
      chapters.value = list
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load audiobook'
      chapters.value = []
    } finally {
      loading.value = false
    }
  }

  return { loading, error, chapters, tracks, fetchChapters }
})
