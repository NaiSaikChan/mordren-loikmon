<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { misc } from '@loikmon/api'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const { t } = useI18n()
const faqs = ref<any[]>([])
const loading = ref(false)
const openId = ref<string | null>(null)

onMounted(async () => {
  loading.value = true
  try {
    const res = await misc.fetchFaqs()
    faqs.value = (res.data as any).faqs ?? []
  } catch { faqs.value = [] }
  finally { loading.value = false }
})

function toggle(id: string) {
  openId.value = openId.value === id ? null : id
}
</script>

<template>
  <div class="page-wrapper max-w-2xl">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ t('nav.faq') }}</h1>

    <LoadingSpinner v-if="loading" />

    <div v-else-if="faqs.length" class="space-y-3">
      <div v-for="faq in faqs" :key="faq.id" class="card overflow-hidden">
        <button class="w-full flex items-center justify-between p-4 text-left" @click="toggle(String(faq.id))">
          <span class="font-medium text-gray-900 dark:text-white pr-4">{{ faq.question ?? faq.name }}</span>
          <span :class="['text-gray-400 transition-transform shrink-0', openId === String(faq.id) ? 'rotate-180' : '']">▼</span>
        </button>
        <div v-if="openId === String(faq.id)" class="px-4 pb-4 text-sm text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-surface-700 pt-3">
          {{ faq.answer ?? faq.content }}
        </div>
      </div>
    </div>

    <div v-else class="card p-12 text-center text-gray-400">
      <div class="text-6xl mb-4">❓</div>
      <p>No FAQs available</p>
    </div>
  </div>
</template>
