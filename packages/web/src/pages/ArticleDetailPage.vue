<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useArticlesStore } from '@/stores/articles'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const props = defineProps<{ id: string }>()
const { t } = useI18n()
const store = useArticlesStore()
const article = computed(() => store.detail)

function fixUrl(url: string): string {
  if (!url) return ''
  let u = url.replace(/\\/g, '/')
  u = u.replace(/\u202f/gi, '%E2%80%AF').replace(/ /g, '%20')
  return u
}

const thumbnail = computed(() =>
  fixUrl(article.value?.thumbnail ?? article.value?.thumbnail_url ?? '')
)

onMounted(async () => {
  await store.fetchDetail(props.id)
})
</script>

<template>
  <div class="page-wrapper max-w-3xl mx-auto">
    <RouterLink to="/articles" class="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-500 mb-6">
      ← {{ t('common.back') }}
    </RouterLink>

    <LoadingSpinner v-if="store.loading && !article" />

    <article v-else-if="article" class="card overflow-hidden">
      <div v-if="thumbnail" class="w-full aspect-video overflow-hidden bg-gray-100 dark:bg-surface-800">
        <img :src="thumbnail" :alt="article.title" class="w-full h-full object-cover"
          @error="($event.target as HTMLImageElement).style.display='none'" />
      </div>
      <div class="p-6 sm:p-8">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">{{ article.title }}</h1>
        <div class="flex flex-wrap gap-2 mb-6 text-xs text-gray-500 dark:text-gray-400">
          <span v-if="article.authorname ?? article.author">✍️ {{ article.authorname ?? article.author }}</span>
          <span v-if="article.categoryname">📂 {{ article.categoryname }}</span>
          <span v-if="article.articledate ?? article.date">📅 {{ article.articledate ?? article.date }}</span>
        </div>
        <div v-if="article.content"
          class="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed"
          v-html="article.content" />
        <p v-else-if="article.description" class="text-gray-600 dark:text-gray-300 leading-relaxed">
          {{ article.description }}
        </p>
        <p v-else class="text-gray-400 italic">No content available.</p>
      </div>
    </article>

    <div v-else class="text-center py-20 text-gray-400">
      <div class="text-5xl mb-3">📰</div>
      <p>{{ t('common.notFound') }}</p>
    </div>
  </div>
</template>
