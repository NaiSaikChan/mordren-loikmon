<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCollectionsStore } from '@/stores/collections'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const { t } = useI18n()
const store = useCollectionsStore()
onMounted(() => { void store.fetchCollections().catch(() => undefined) })
</script>

<template>
  <div class="page-wrapper">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ t('nav.collections') }}</h1>
    <LoadingSpinner v-if="store.loading && !store.list.length" />
    <EmptyState v-else-if="!store.loading && !store.list.length" icon="📦" :title="t('collections.empty')" />
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      <RouterLink v-for="col in store.list" :key="col.id"
        :to="`/collections/${col.id}`"
        class="card overflow-hidden group hover:border-brand-400 transition-colors">
        <div class="h-36 bg-gradient-to-br from-brand-600/80 to-indigo-700/80 flex items-center justify-center overflow-hidden">
          <img v-if="col.thumbnail" :src="col.thumbnail" :alt="col.title" class="w-full h-full object-cover" loading="lazy" />
          <span v-else class="text-5xl">📦</span>
        </div>
        <div class="p-4">
          <h3 class="font-semibold text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
            {{ col.title || col.name }}
          </h3>
          <p v-if="col.description" class="text-sm text-gray-400 mt-1 line-clamp-2">{{ col.description }}</p>
          <p v-if="col.items_count" class="text-xs text-gray-400 mt-2">{{ t('collections.items', { count: col.items_count }) }}</p>
        </div>
      </RouterLink>
    </div>
    <div v-if="store.pagination?.has_more" class="mt-8 text-center">
      <button type="button" class="btn-secondary" :disabled="store.loading" @click="store.fetchMore()">
        {{ store.loading ? t('common.loading') : t('common.more') }}
      </button>
    </div>
  </div>
</template>
