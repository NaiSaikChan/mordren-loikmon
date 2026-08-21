import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import type { Article } from '@loikmon/api'
import { normalizeAudioUrl, type AudioTrack } from '@/stores/bookAudio'

/**
 * Derives an audiobook track from an article and hands it to the global AudioPlayer.
 */
export function useArticleAudio(article: MaybeRefOrGetter<Article | null | undefined>) {
  const track = computed<AudioTrack | null>(() => {
    const a = toValue(article)
    if (!a) return null
    const raw = (a.audio_url as string | undefined) ?? (a.audio as string | undefined) ?? ''
    const url = normalizeAudioUrl(raw)
    if (!url) return null
    return {
      id: a.id,
      title: String(a.title ?? 'Untitled'),
      artist: String(a.authorname ?? a.author ?? ''),
      url,
      cover: normalizeAudioUrl(String(a.thumbnail_url ?? a.thumbnail ?? '')),
    }
  })

  const hasAudio = computed(() => track.value !== null)

  function play() {
    if (!track.value) return
    window.dispatchEvent(
      new CustomEvent('loikmon:playAudioTrack', { detail: { track: track.value } }),
    )
  }

  return { track, hasAudio, play }
}
