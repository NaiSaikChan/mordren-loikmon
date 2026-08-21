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
    if (faqs.value.length) openId.value = String(faqs.value[0].id)
  } catch { faqs.value = [] }
  finally { loading.value = false }
})

function toggle(id: string) {
  openId.value = openId.value === id ? null : id
}

function isOpen(id: string) {
  return openId.value === String(id)
}
</script>

<template>
  <div class="page-wrapper max-w-3xl">
    <div class="mb-8 rounded-[28px] border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-amber-50 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] dark:border-brand-900/40 dark:from-surface-900 dark:via-surface-900 dark:to-brand-950/30 sm:p-8">
      <div class="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-700 shadow-sm dark:border-brand-800/70 dark:bg-surface-900/70 dark:text-brand-300">
        <span class="inline-flex h-2.5 w-2.5 rounded-full bg-brand-500" />
        Help center
      </div>
      <h1 class="text-3xl font-black tracking-tight text-gray-900 dark:text-white sm:text-4xl">{{ t('nav.faq') }}</h1>
      <p class="mt-3 max-w-xl text-sm leading-7 text-gray-600 dark:text-gray-300 sm:text-base">
        Find quick answers about reading, downloading, account access, and using the LoikMon platform with ease.
      </p>
    </div>

    <LoadingSpinner v-if="loading" />

    <div v-else-if="faqs.length" class="space-y-4">
      <div
        v-for="(faq, index) in faqs"
        :key="faq.id"
        class="overflow-hidden rounded-2xl border border-gray-200 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition-all duration-200 hover:border-brand-200 hover:shadow-[0_18px_40px_rgba(15,23,42,0.06)] dark:border-surface-700 dark:bg-surface-900/80 dark:hover:border-brand-800"
      >
        <button
          class="flex w-full items-center justify-between gap-4 p-4 text-left sm:p-5"
          :aria-expanded="isOpen(faq.id)"
          @click="toggle(String(faq.id))"
        >
          <span class="flex min-w-0 items-start gap-3">
            <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xs font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
              {{ index + 1 }}
            </span>
            <span class="min-w-0 text-base font-semibold leading-7 text-gray-900 dark:text-white sm:text-lg">
              {{ faq.question ?? faq.name }}
            </span>
          </span>

          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 text-lg text-gray-500 transition-all duration-200 dark:border-surface-600 dark:text-gray-300"
            :class="isOpen(faq.id) ? 'rotate-180 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : ''"
          >
            ▾
          </span>
        </button>

        <div
          v-if="isOpen(faq.id)"
          class="border-t border-gray-100 bg-gradient-to-b from-brand-50/40 to-transparent px-4 pb-4 pt-4 text-sm text-gray-600 dark:border-surface-700 dark:from-brand-950/10 dark:text-gray-300 sm:px-5"
        >
          <div
            class="prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 dark:prose-invert"
            v-html="faq.answer ?? faq.content"
          />
        </div>
      </div>
    </div>

    <div v-else class="rounded-[28px] border border-dashed border-gray-300 bg-white/80 px-6 py-12 text-center shadow-sm dark:border-surface-700 dark:bg-surface-900/70">
      <div class="mb-4 text-5xl">❓</div>
      <h2 class="text-lg font-semibold text-gray-700 dark:text-gray-200">No FAQs available</h2>
      <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">Please check back later for updated answers.</p>
    </div>
  </div>
</template>
