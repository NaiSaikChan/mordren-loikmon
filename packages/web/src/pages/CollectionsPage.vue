<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCollectionsStore } from '@/stores/collections'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const { t } = useI18n()
const store = useCollectionsStore()
onMounted(() => store.fetchCollections())
</script>

<template>
  <div class="page-wrapper">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ t('nav.collections') }}</h1>
    <LoadingSpinner v-if="store.loading" />
    <EmptyState v-else-if="!store.loading && !store.list.length" icon="📦" title="No collections yet" />
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      <RouterLink v-for="col in store.list" :key="col.id"
        :to="`/collections/${col.id}`"
        class="card overflow-hidden group hover:border-brand-400 transition-colors">
        <div class="h-36 bg-gradient-to-br from-brand-600/80 to-indigo-700/80 flex items-center justify-center">
          <span class="text-5xl">📦</span>
        </div>
        <div class="p-4">
          <h3 class="font-semibold text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
            {{ col.name ?? col.title }}
          </h3>
          <p v-if="col.description" class="text-sm text-gray-400 mt-1 line-clamp-2">{{ col.description }}</p>
          <p v-if="col.books_count" class="text-xs text-gray-400 mt-2">{{ col.books_count }} items</p>
        </div>
      </RouterLink>
    </div>
    <div v-if="store.list.length" class="mt-8 text-center">
      <button class="btn-secondary" :disabled="store.loading" @click="store.fetchCollections(1)">
        {{ t('common.more') }}
      </button>
    </div>
  </div>
</template>
