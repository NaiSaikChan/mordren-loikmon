<script setup lang="ts">
import type { Article } from '@loikmon/api'
import { computed, ref } from 'vue'

const props = defineProps<{ article: Article }>()

// Format views for readability (e.g., 1000 -> 1K, 1500000 -> 1.5M)
const formattedViews = computed(() => {
  const views = Number(props.article.views ?? 0)
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`
  return String(views)
})

// Format rating with star icon
const formattedRating = computed(() => {
  const rating = Number(props.article.rating ?? 0)
  return rating > 0 ? rating.toFixed(1) : null
})

// Format articledate as "dd MMM yyyy"
const formattedDate = computed(() => {
  const raw = props.article.articledate as string | undefined
  if (!raw) return null
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
})

// Social share
const copied = ref(false)
async function shareArticle(e: MouseEvent) {
  e.preventDefault()
  const url = `${window.location.origin}/articles/${props.article.id}`
  if (navigator.share) {
    try { await navigator.share({ title: String(props.article.title ?? ''), url }) } catch { /* cancelled */ }
  } else {
    await navigator.clipboard.writeText(url)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}
</script>

<template>
  <RouterLink :to="`/articles/${article.id}`" class="group block h-full">
    <div class="overflow-hidden h-full flex gap-4 bg-white dark:bg-surface-900 hover:shadow-lg transition-all duration-300 rounded-xl border border-gray-200 dark:border-surface-700 p-4">
      
      <!-- Left Column: Thumbnail -->
      <div v-if="article.thumbnail_url || article.thumbnail" class="relative shrink-0 w-32 h-32 rounded-lg overflow-hidden bg-linear-to-br from-gray-100 to-gray-200 dark:from-surface-800 dark:to-surface-700">
        <img
          :src="article.thumbnail_url ?? article.thumbnail"
          :alt="article.title"
          class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          loading="lazy"
        />
      </div>

      <!-- Right Column: Content -->
      <div class="flex-1 flex flex-col min-w-0">
        <!-- Category & Price Row -->
        <div class="flex items-center justify-between gap-2 mb-2">
          <div v-if="article.categoryname" class="shrink">
            <span class="inline-block px-2.5 py-0.5 bg-brand-600 text-white text-xs font-semibold rounded-full">
              {{ article.categoryname }}
            </span>
          </div>
          <div class="shrink">
            <span v-if="article.is_free" class="inline-block px-2.5 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded-full">Free</span>
            <span v-else-if="article.price" class="inline-block px-2.5 py-0.5 bg-yellow-500 text-white text-xs font-bold rounded-full">
              {{ article.price }} coins
            </span>
          </div>
        </div>

        <!-- Title -->
        <h3 class="text-sm font-bold text-gray-900 dark:text-white line-clamp-2 leading-snug group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors mb-2">
          {{ article.title }}
        </h3>

        <!-- Article Date -->
        <div v-if="formattedDate" class="text-xs text-gray-500 dark:text-gray-400 mb-2">
          📅 {{ formattedDate }}
        </div>

        <!-- Author Info -->
        <div v-if="article.authorname" class="flex items-center gap-1.5 mb-2 text-xs text-gray-600 dark:text-gray-400">
          <span>✍️</span>
          <span class="truncate">{{ article.authorname }}</span>
        </div>

        <!-- Stats Footer -->
        <div class="mt-auto flex items-center gap-4 pt-2 border-t border-gray-100 dark:border-surface-700">
          <!-- Views -->
          <div class="flex items-center gap-1">
            <span class="text-sm">👁️</span>
            <span class="text-xs font-semibold text-gray-700 dark:text-gray-300">{{ formattedViews }}</span>
          </div>

          <!-- Rating -->
          <div v-if="formattedRating" class="flex items-center gap-1">
            <span class="text-sm">⭐</span>
            <span class="text-xs font-semibold text-yellow-500">{{ formattedRating }}</span>
          </div>

          <!-- Share button -->
          <button
            class="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors focus-visible:outline-none"
            :title="copied ? 'Link copied!' : 'Share'"
            @click="shareArticle"
          >
            <span class="text-sm">{{ copied ? '✅' : '🔗' }}</span>
            <span>{{ copied ? 'Copied!' : 'Share' }}</span>
          </button>
        </div>
      </div>
    </div>
  </RouterLink>
</template>

