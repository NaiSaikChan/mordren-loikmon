<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCategoriesStore } from '@/stores/categories'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const { t } = useI18n()
const store = useCategoriesStore()
onMounted(() => store.fetchCategories())
</script>

<template>
  <div class="page-wrapper">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Categories</h1>
    <LoadingSpinner v-if="store.loading" />
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      <RouterLink v-for="cat in store.list" :key="cat.id"
        :to="`/categories/${cat.id}`"
        class="card p-5 flex flex-col items-center gap-3 text-center hover:border-brand-400 transition-colors">
        <div class="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-2xl">
          {{ cat.icon ?? '📂' }}
        </div>
        <div>
          <p class="font-semibold text-sm text-gray-900 dark:text-white">{{ cat.name }}</p>
          <p v-if="cat.books_count" class="text-xs text-gray-400 mt-0.5">{{ cat.books_count }} books</p>
        </div>
      </RouterLink>
    </div>
  </div>
</template>
