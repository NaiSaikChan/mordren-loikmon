import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import { articles as articlesApi } from '@loikmon/api'
import type { Article, ArticleDetail } from '@loikmon/api'
import type { AudioTrack } from '@/stores/bookAudio'
import { usePaywallStore } from '@/stores/paywall'
import { playAudio } from '@/composables/audioPlayback'
import { lockReasonFromAccess, lockReasonFromError } from '@/utils/access'

function toTrack(article: Article | ArticleDetail, url: string): AudioTrack {
  return {
    id: `article-${article.id}`,
    title: article.title || 'Untitled',
    artist: article.authorname ?? '',
    url,
    cover: article.thumbnail_url ?? article.thumbnail ?? '',
    source: { kind: 'article', articleId: article.id },
  }
}

/**
 * Plays an article's audio through the global AudioPlayer.
 *
 * List items carry no `audio_url`, so the article is fetched first: the server
 * returns a signed `audio_url` when the viewer has access, otherwise `locked`
 * and the paywall opens.
 */
export function useArticleAudio(article: MaybeRefOrGetter<Article | ArticleDetail | null | undefined>) {
  const loading = ref(false)
  const paywall = usePaywallStore()

  const hasAudio = computed(() => Boolean(toValue(article)?.has_audio))

  /** Track for an article detail that already includes a signed `audio_url`. */
  const track = computed<AudioTrack | null>(() => {
    const a = toValue(article)
    if (!a || !('audio_url' in a) || !a.audio_url) return null
    return toTrack(a, a.audio_url)
  })

  async function play() {
    const a = toValue(article)
    if (!a || loading.value) return
    if (track.value) {
      playAudio(track.value)
      return
    }
    loading.value = true
    try {
      const { data } = await articlesApi.getArticle(a.id)
      const detail = data.article
      if (detail.audio_url) {
        playAudio(toTrack(detail, detail.audio_url))
      } else if (detail.locked) {
        paywall.open(lockReasonFromAccess(detail.access) ?? 'subscription_required')
      }
    } catch (err) {
      const reason = lockReasonFromError(err)
      if (reason) paywall.open(reason)
    } finally {
      loading.value = false
    }
  }

  return { track, hasAudio, loading, play }
}
