<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import DOMPurify from 'dompurify'
import { useI18n } from 'vue-i18n'
import { isApiError, site } from '@loikmon/api'
import type { PublicPolicy } from '@loikmon/api'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

/**
 * Public reader for a published policy (terms, privacy, refund, …), linked
 * from the CMS "View live" action and from the About page's policy cards.
 * Only the currently published version is ever served here — draft text
 * stays inside the CMS until an editor publishes it.
 */
const props = defineProps<{ slug: string }>()
const { t } = useI18n()

const policy = ref<PublicPolicy | null>(null)
const loading = ref(true)
const notFound = ref(false)
const failed = ref(false)

const publishedAt = computed(() => {
  const raw = policy.value?.effective_at ?? policy.value?.published_at
  if (!raw) return ''
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString()
})

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
      'a', 'img', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel', 'width', 'height'],
    ALLOW_DATA_ATTR: false,
  })
}

async function load() {
  loading.value = true
  notFound.value = false
  failed.value = false
  policy.value = null
  try {
    const { data } = await site.policy(props.slug)
    policy.value = data.policy
  } catch (err: unknown) {
    if (isApiError(err) && err.status === 404) notFound.value = true
    else failed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.slug, load)
</script>

<template>
  <div class="page-wrapper max-w-3xl">
    <RouterLink to="/" class="mb-6 inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-500">
      ← {{ t('nav.home') }}
    </RouterLink>

    <LoadingSpinner v-if="loading" />

    <div v-else-if="policy" class="card p-6">
      <h1 class="mb-2 text-2xl font-bold text-gray-900 dark:text-white">{{ policy.title }}</h1>
      <div class="mb-6 flex flex-wrap items-center gap-3 text-sm text-gray-400">
        <span v-if="publishedAt">📅 {{ publishedAt }}</span>
        <span>v{{ policy.version }}</span>
      </div>
      <p v-if="policy.summary" class="mb-6 text-sm leading-7 text-gray-500 dark:text-gray-400">{{ policy.summary }}</p>
      <div
        class="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed"
        v-html="sanitizeHtml(policy.body)"
      />
    </div>

    <div v-else class="py-20 text-center text-gray-400">
      <div class="mb-3 text-5xl">📜</div>
      <p>{{ notFound ? t('common.notFound') : t('common.error') }}</p>
      <button v-if="failed" type="button" class="btn-secondary mt-4" @click="load">{{ t('common.retry') }}</button>
    </div>
  </div>
</template>
