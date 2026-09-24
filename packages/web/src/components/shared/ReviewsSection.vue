<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { errorMessage } from '@loikmon/api'
import type { Id, ItemType } from '@loikmon/api'
import { useAuthStore } from '@/stores/auth'
import { useReviewsStore } from '@/stores/reviews'

const props = defineProps<{ itemType: ItemType; itemId: Id | string }>()

const { t } = useI18n()
const route = useRoute()
const auth = useAuthStore()
const reviews = useReviewsStore()

const content = ref('')
const rating = ref(5)
const submitting = ref(false)
const message = ref('')
const failed = ref(false)

// Prefill the form with the viewer's own review (the endpoint upserts).
watch(
  () => reviews.userReview,
  (own) => {
    if (own) {
      content.value = own.content ?? ''
      rating.value = own.rating || 5
    }
  },
  { immediate: true },
)

async function submit() {
  submitting.value = true
  message.value = ''
  failed.value = false
  try {
    await reviews.submitReview(props.itemType, props.itemId, rating.value, content.value)
    message.value = t('reviews.submitted')
  } catch (err) {
    failed.value = true
    message.value = errorMessage(err, t('reviews.failed'))
  } finally {
    submitting.value = false
  }
}

async function removeOwn() {
  if (!reviews.userReview) return
  submitting.value = true
  try {
    await reviews.deleteReview(reviews.userReview.id)
    content.value = ''
    rating.value = 5
    message.value = ''
  } catch (err) {
    failed.value = true
    message.value = errorMessage(err, t('reviews.failed'))
  } finally {
    submitting.value = false
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString()
}
</script>

<template>
  <div>
    <p v-if="reviews.summary.count" class="mb-4 text-sm text-gray-500 dark:text-gray-400">
      {{ t('reviews.summary', { average: Number(reviews.summary.average || 0).toFixed(1), count: reviews.summary.count }) }}
    </p>

    <div v-if="auth.isLoggedIn" class="card p-5 mb-6">
      <h3 class="font-semibold text-gray-800 dark:text-gray-200 mb-3">
        {{ reviews.userReview ? t('reviews.update') : t('reviews.write') }}
      </h3>
      <div class="flex gap-1 mb-3" role="group" :aria-label="t('reviews.rating')">
        <button
          v-for="s in 5"
          :key="s"
          type="button"
          :aria-label="`${s} / 5`"
          :aria-pressed="s <= rating"
          :class="['text-2xl transition-transform hover:scale-110 cursor-pointer', s <= rating ? 'text-yellow-400' : 'text-gray-300']"
          @click="rating = s"
        >★</button>
      </div>
      <textarea v-model="content" class="input w-full h-24 resize-none" maxlength="5000" :placeholder="t('reviews.placeholder')" />
      <div class="flex flex-wrap items-center gap-3 mt-3">
        <p v-if="message" :class="['text-sm', failed ? 'text-red-500' : 'text-green-500']" role="status">{{ message }}</p>
        <div class="ml-auto flex gap-2">
          <button v-if="reviews.userReview" type="button" class="btn-ghost text-red-500" :disabled="submitting" @click="removeOwn">
            {{ t('reviews.delete') }}
          </button>
          <button type="button" class="btn-primary" :disabled="submitting" @click="submit">
            {{ submitting ? t('common.saving') : t('reviews.submit') }}
          </button>
        </div>
      </div>
    </div>
    <div v-else class="card p-4 mb-6 text-sm text-gray-500 dark:text-gray-400 flex flex-wrap items-center justify-between gap-3">
      <span>{{ t('reviews.loginPrompt') }}</span>
      <RouterLink :to="{ name: 'auth', query: { redirect: route.fullPath } }" class="btn-primary">{{ t('auth.login') }}</RouterLink>
    </div>

    <div v-if="reviews.list.length" class="space-y-4">
      <div v-for="r in reviews.list" :key="r.id" class="card p-4">
        <div class="flex items-start gap-3">
          <img v-if="r.avatar" :src="r.avatar" :alt="r.username" class="w-9 h-9 rounded-full object-cover shrink-0" />
          <div v-else class="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center shrink-0 font-bold text-brand-600">
            {{ (r.username || r.author_name || '?').charAt(0).toUpperCase() }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-medium text-sm text-gray-900 dark:text-white">{{ r.username || r.author_name || t('common.anonymous') }}</span>
              <span v-if="auth.user && r.user_id === auth.user.id" class="badge-brand">{{ t('reviews.you') }}</span>
              <span class="text-yellow-400 text-xs">{{ '★'.repeat(Math.max(0, Math.min(5, r.rating ?? 0))) }}</span>
            </div>
            <p v-if="r.content" class="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-line break-words">{{ r.content }}</p>
            <p v-if="r.created_at" class="text-xs text-gray-400 mt-1">{{ formatDate(r.created_at) }}</p>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="!reviews.loading" class="text-center py-8 text-gray-400">{{ t('reviews.none') }}</div>
  </div>
</template>
