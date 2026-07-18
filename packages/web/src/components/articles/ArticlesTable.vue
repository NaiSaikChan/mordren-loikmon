<script setup lang="ts">
import type { Article } from '@loikmon/api'
import { shallowRef } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps<{
  articles: Article[]
  sortOrder: 'asc' | 'desc'
}>()

const emit = defineEmits<{
  'toggle-sort': []
}>()

// Local bookmark state — replaced entirely on each toggle so shallowRef tracks it
const bookmarked = shallowRef(new Set<string | number>())
const copied     = shallowRef<string | number | null>(null)

function toggleBookmark(id: string | number) {
  const next = new Set(bookmarked.value)
  next.has(id) ? next.delete(id) : next.add(id)
  bookmarked.value = next
}

async function shareArticle(e: MouseEvent, article: Article) {
  e.preventDefault()
  const url = `${window.location.origin}/articles/${article.id}`
  if (navigator.share) {
    try { await navigator.share({ title: String(article.title ?? ''), url }) } catch { /* cancelled */ }
  } else {
    await navigator.clipboard.writeText(url)
    copied.value = article.id
    setTimeout(() => { copied.value = null }, 2000)
  }
}

function fmtViews(v: unknown) {
  const n = Number(v ?? 0)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function fmtDate(raw: unknown) {
  if (!raw) return '—'
  const d = new Date(raw as string)
  if (isNaN(d.getTime())) return String(raw)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtRating(r: unknown) {
  const n = Number(r ?? 0)
  return n > 0 ? n.toFixed(1) : null
}

function getArticlePrice(article: Article): { isFree: boolean; amount: number | null } {
  const price = Number(article.price ?? article.amount ?? 0)
  const isFree = article.is_free || price === 0
  return { isFree, amount: isFree ? null : price }
}
</script>

<template>
  <div>
    <!-- Mobile layout -->
    <div class="space-y-3 md:hidden">
      <div
        v-for="article in articles"
        :key="`mobile-${article.id}`"
        class="group overflow-hidden h-full flex gap-4 bg-white dark:bg-surface-900 hover:shadow-lg transition-all duration-300 rounded-xl border border-gray-200 dark:border-surface-700 p-4"
      >
        <!-- Thumbnail -->
        <RouterLink :to="`/articles/${article.id}`" tabindex="-1" class="shrink-0">
          <div class="w-28 h-28 object-cover shadow-sm rounded-lg overflow-hidden bg-gray-100 dark:bg-surface-700 flex items-center justify-center bg-linear-to-br">
            <img
              v-if="article.thumbnail_url || article.thumbnail"
              :src="(article.thumbnail_url ?? article.thumbnail) as string"
              :alt="article.title"
              class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              loading="lazy"
            />
            <span v-else class="text-2xl">📰</span>
          </div>
        </RouterLink>

        <!-- Content -->
        <div class="flex-1 flex flex-col min-w-0">
          <!-- title -->
          <RouterLink :to="`/articles/${article.id}`" class="block group">
            <p class="text-xs font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors leading-snug">
              {{ article.title }}
            </p>
          </RouterLink>

          <!-- category, coin -->
          <div class="mt-1 flex flex-wrap gap-1">
            <span
              v-if="article.categoryname || article.category"
              class="px-2 py-0.5 bg-brand-600 text-white text-xs font-semibold rounded-full"
            >
              {{ (article.categoryname ?? article.category) as string }}
            </span>
            <span
              v-if="getArticlePrice(article).isFree"
              class="px-2 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded-full"
            >
              Free
            </span>
            <span
              v-else-if="getArticlePrice(article).amount"
              class="px-2 py-0.5 bg-yellow-500 text-white text-xs font-bold rounded-full"
            >
              🪙 {{ getArticlePrice(article).amount }} coins
            </span>
          </div>

          <!-- author, date -->
          <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
            <span v-if="article.authorname || article.author" class="truncate">✍️ {{ (article.authorname ?? article.author) as string }}</span>
            <span>📅 {{ fmtDate(article.articledate ?? article.created_at ?? article.date) }}</span>
          </div>

          <!-- view, rating -->
          <div class="mt-1 flex items-center gap-3 text-xs">
            <span class="text-gray-700 dark:text-gray-300">👁️ {{ fmtViews(article.views ?? article.total_views) }}</span>
            <span v-if="fmtRating(article.rating)" class="text-yellow-500 font-semibold">⭐ {{ fmtRating(article.rating) }}</span>
          </div>

          <!-- action -->
          <div class="mt-2 pt-2 border-t border-gray-100 dark:border-surface-700 flex items-center justify-end gap-1">
            <button
              class="p-1.5 rounded-lg text-gray-400 hover:text-brand-500 hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors text-base leading-none"
              :title="copied === article.id ? 'Link copied!' : 'Share'"
              @click="shareArticle($event, article)"
            >
              {{ copied === article.id ? '✅' : '🔗' }}
            </button>
            <button
              class="p-1.5 rounded-lg transition-colors text-base leading-none"
              :class="bookmarked.has(article.id)
                ? 'text-brand-500 hover:bg-brand-50 dark:hover:bg-surface-700'
                : 'text-gray-400 hover:text-brand-500 hover:bg-gray-100 dark:hover:bg-surface-700'"
              :title="bookmarked.has(article.id) ? 'Saved' : 'Save'"
              @click="toggleBookmark(article.id)"
            >
              {{ bookmarked.has(article.id) ? '🔖' : '☆' }}
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="!articles.length"
        class="rounded-xl border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-16 text-center"
      >
        <span class="text-4xl block mb-3">📰</span>
        <p class="text-sm text-gray-400 dark:text-gray-500">No articles found.</p>
      </div>
    </div>

    <!-- Desktop table layout -->
    <div class="hidden md:block overflow-x-auto rounded-xl border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-900">
      <table class="w-full text-sm text-left">

      <!-- Header -->
      <thead class="bg-gray-50 dark:bg-surface-800 border-b border-gray-200 dark:border-surface-700">
        <tr>
          <th class="px-4 py-3 w-14 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Thumb
          </th>
          <th class="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Title / Category
          </th>
          <th class="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
            Author
          </th>
          <th
            class="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
            @click="emit('toggle-sort')"
          >
            Date
            <span class="ml-1 font-bold">{{ sortOrder === 'desc' ? '↓' : '↑' }}</span>
          </th>
          <th class="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
            Views / Rating
          </th>
          <th class="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center">
            Actions
          </th>
        </tr>
      </thead>

      <!-- Rows -->
      <tbody class="divide-y divide-gray-100 dark:divide-surface-700">
        <tr
          v-for="article in articles"
          :key="article.id"
          class="group hover:bg-gray-50 dark:hover:bg-surface-800 transition-colors"
        >
          <!-- Thumbnail -->
          <td class="px-4 py-3">
            <RouterLink :to="`/articles/${article.id}`" tabindex="-1">
              <div class="w-56 md:w-48 h-auto object-cover shadow-sm rounded-lg overflow-hidden bg-gray-100 dark:bg-surface-700 shrink-0 flex items-center justify-center bg-linear-to-br">
                <img
                  v-if="article.thumbnail_url || article.thumbnail"
                  :src="(article.thumbnail_url ?? article.thumbnail) as string"
                  :alt="article.title"
                  class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  loading="lazy"
                />
                <span v-else class="text-2xl">📰</span>
              </div>
            </RouterLink>
          </td>

          <!-- Title + Category -->
          <td class="px-4 py-3 max-w-xs">
            <RouterLink :to="`/articles/${article.id}`" class="block group">
              <p class="font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-brand-600 w-70 dark:group-hover:text-brand-400 transition-colors leading-snug">
                {{ article.title }}
              </p>
            </RouterLink>
            <div class="mt-1 flex flex-wrap gap-1 py-3.5">
              <span
                v-if="article.categoryname || article.category"
                class="px-2 py-0.5 bg-brand-600 text-white text-xs font-semibold rounded-full"
              >
                {{ (article.categoryname ?? article.category) as string }}
              </span>
              <span
                v-if="getArticlePrice(article).isFree"
                class="px-2 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded-full"
              >
                Free
              </span>
              <span
                v-else-if="getArticlePrice(article).amount"
                class="px-2 py-0.5 bg-yellow-500 text-white text-xs font-bold rounded-full"
              >
                🪙 {{ getArticlePrice(article).amount }} coins
              </span>
            </div>
          </td>

          <!-- Author -->
          <td class="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
            <span v-if="article.authorname || article.author">
              ✍️ {{ (article.authorname ?? article.author) as string }}
            </span>
            <span v-else class="text-gray-400">—</span>
          </td>

          <!-- Date (sortable) -->
          <td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            📅 {{ fmtDate(article.articledate ?? article.created_at ?? article.date) }}
          </td>

          <!-- Views + Rating -->
          <td class="px-4 py-3">
            <div class="flex flex-col gap-0.5 text-xs">
              <span class="text-gray-700 dark:text-gray-300">
                👁️ {{ fmtViews(article.views ?? article.total_views) }}
              </span>
              <span v-if="fmtRating(article.rating)" class="text-yellow-500 font-semibold">
                ⭐ {{ fmtRating(article.rating) }}
              </span>
            </div>
          </td>

          <!-- Actions -->
          <td class="px-4 py-3">
            <div class="flex items-center justify-center gap-1">
              <!-- Share -->
              <button
                class="p-1.5 rounded-lg text-gray-400 hover:text-brand-500 hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors text-base leading-none"
                :title="copied === article.id ? 'Link copied!' : 'Share'"
                @click="shareArticle($event, article)"
              >
                {{ copied === article.id ? '✅' : '🔗' }}
              </button>
              <!-- Bookmark -->
              <button
                class="p-1.5 rounded-lg transition-colors text-base leading-none"
                :class="bookmarked.has(article.id)
                  ? 'text-brand-500 hover:bg-brand-50 dark:hover:bg-surface-700'
                  : 'text-gray-400 hover:text-brand-500 hover:bg-gray-100 dark:hover:bg-surface-700'"
                :title="bookmarked.has(article.id) ? 'Saved' : 'Save'"
                @click="toggleBookmark(article.id)"
              >
                {{ bookmarked.has(article.id) ? '🔖' : '☆' }}
              </button>
            </div>
          </td>
        </tr>

        <!-- Empty state -->
        <tr v-if="!articles.length">
          <td colspan="6" class="px-4 py-16 text-center">
            <span class="text-4xl block mb-3">📰</span>
            <p class="text-sm text-gray-400 dark:text-gray-500">No articles found.</p>
          </td>
        </tr>
      </tbody>
      </table>
    </div>
  </div>
</template>
