<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthorsStore } from '@/stores/authors'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const props = defineProps<{ id: string }>()
const { t } = useI18n()
const store = useAuthorsStore()
const author = computed(() => store.detail)
onMounted(() => store.fetchDetail(props.id))
</script>

<template>
  <div class="page-wrapper">
    <LoadingSpinner v-if="store.loading && !author" />
    <div v-else-if="author" class="max-w-2xl mx-auto">
      <div class="card p-6 flex gap-5 items-start mb-6">
        <div class="w-20 h-20 rounded-full overflow-hidden bg-brand-100 dark:bg-brand-900/30 shrink-0 flex items-center justify-center">
          <img v-if="author.avatar_url ?? author.avatar" :src="author.avatar_url ?? author.avatar" :alt="author.name" class="w-full h-full object-cover" />
          <span v-else class="text-3xl font-bold text-brand-600">{{ author.name.charAt(0) }}</span>
        </div>
        <div class="flex-1">
          <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-1">{{ author.name }}</h1>
          <p class="text-sm text-gray-400 mb-3">{{ author.books_count ?? 0 }} books · {{ author.followers_count ?? 0 }} followers</p>
          <p v-if="author.bio" class="text-sm text-gray-600 dark:text-gray-300 mb-4">{{ author.bio }}</p>
          <button
            :class="author.is_following ? 'btn-secondary' : 'btn-primary'"
            @click="store.toggleFollow(props.id)"
          >
            {{ author.is_following ? t('authors.unfollow') : t('authors.follow') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
