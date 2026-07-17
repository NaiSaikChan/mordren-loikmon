<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { UI_FONT_OPTIONS, BODY_FONT_SIZES, HEADER_SCALES, getFontStack } from '@/stores/ui'
import type { Theme } from '@/stores/ui'

const { t } = useI18n()
const uiStore = useUiStore()

const themes: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: '☀️' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
  { value: 'system', label: 'System', icon: '💻' },
]

// Derived values for body font size slider
const currentFontSizeIndex = computed(() => {
  return BODY_FONT_SIZES.findIndex(sz => sz.id === uiStore.bodyFontSizeId)
})

const currentFontSize = computed(() => {
  return BODY_FONT_SIZES[currentFontSizeIndex.value]
})

function handleFontSizeChange(value: string) {
  const index = parseInt(value, 10)
  if (index >= 0 && index < BODY_FONT_SIZES.length) {
    uiStore.setBodyFontSize(BODY_FONT_SIZES[index].id)
  }
}

// Derived values for header scale slider
const currentHeaderScaleIndex = computed(() => {
  return HEADER_SCALES.findIndex(sc => sc.id === uiStore.headerScaleId)
})

const currentHeaderScale = computed(() => {
  return HEADER_SCALES[currentHeaderScaleIndex.value]
})

function handleHeaderScaleChange(value: string) {
  const index = parseInt(value, 10)
  if (index >= 0 && index < HEADER_SCALES.length) {
    uiStore.setHeaderScale(HEADER_SCALES[index].id)
  }
}
</script>

<template>
  <div class="page-wrapper max-w-2xl">
    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">{{ t('settings.title') }}</h1>

    <!-- Theme -->
    <div class="card p-6 mb-4">
      <h2 class="font-semibold text-gray-800 dark:text-gray-200 mb-4">{{ t('settings.theme') }}</h2>
      <div class="flex gap-3">
        <button
          v-for="th in themes"
          :key="th.value"
          :class="['flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all',
            uiStore.theme === th.value
              ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600']"
          @click="uiStore.setTheme(th.value)"
        >
          <span>{{ th.icon }}</span>
          <span>{{ th.label }}</span>
        </button>
      </div>
    </div>

    <!-- Language -->
    <div class="card p-6 mb-4">
      <h2 class="font-semibold text-gray-800 dark:text-gray-200 mb-4">{{ t('settings.language') }}</h2>
      <div class="flex gap-3">
        <button
          v-for="lang in ([{ value: 'en', label: 'English' }, { value: 'mon', label: 'မန်ဘာသာ' }] as const)"
          :key="lang.value"
          :class="['flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all',
            uiStore.locale === lang.value
              ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300']"
          @click="uiStore.setLocale(lang.value)"
        >
          {{ lang.label }}
        </button>
      </div>
    </div>

    <!-- Typography -->
    <div class="card p-6">
      <h2 class="font-semibold text-gray-800 dark:text-gray-200 mb-5">Typography</h2>

      <!-- Body Font -->
      <div class="mb-4">
        <h3 class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Body Font</h3>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="font in UI_FONT_OPTIONS"
            :key="font.id"
            :style="{ fontFamily: font.stack }"
            :class="['px-3 py-1.5 rounded-lg border-2 text-sm transition-all',
              uiStore.bodyFont === font.id
                ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500']"
            @click="uiStore.setBodyFont(font.id)"
          >
            {{ font.label }}
          </button>
        </div>
      </div>

      <!-- Body Font Size -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-medium text-gray-600 dark:text-gray-400">Body Text Size</h3>
          <span class="text-xs font-medium text-brand-600 dark:text-brand-400">
            {{ currentFontSize?.label }} ({{ currentFontSize?.px }}px)
          </span>
        </div>
        <div class="flex items-center gap-4">
          <input
            type="range"
            :value="currentFontSizeIndex"
            :min="0"
            :max="BODY_FONT_SIZES.length - 1"
            @change="e => handleFontSizeChange((e.target as HTMLInputElement).value)"
            class="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
          />
        </div>
        <div class="flex justify-between text-xs text-gray-400 mt-2">
          <span>{{ BODY_FONT_SIZES[0].label }}</span>
          <span>{{ BODY_FONT_SIZES[BODY_FONT_SIZES.length - 1].label }}</span>
        </div>
      </div>

      <!-- Divider -->
      <div class="border-t border-gray-100 dark:border-gray-800 mb-6" />

      <!-- Heading Font -->
      <div class="mb-4">
        <h3 class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Heading Font</h3>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="font in UI_FONT_OPTIONS"
            :key="font.id"
            :style="{ fontFamily: font.stack }"
            :class="['px-3 py-1.5 rounded-lg border-2 text-sm transition-all',
              uiStore.headerFont === font.id
                ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500']"
            @click="uiStore.setHeaderFont(font.id)"
          >
            {{ font.label }}
          </button>
        </div>
      </div>

      <!-- Heading Scale -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-medium text-gray-600 dark:text-gray-400">Heading Size</h3>
          <span class="text-xs font-medium text-brand-600 dark:text-brand-400">
            {{ currentHeaderScale?.label }} ({{ Math.round((currentHeaderScale?.scale ?? 1) * 100) }}%)
          </span>
        </div>
        <div class="flex items-center gap-4">
          <input
            type="range"
            :value="currentHeaderScaleIndex"
            :min="0"
            :max="HEADER_SCALES.length - 1"
            @change="e => handleHeaderScaleChange((e.target as HTMLInputElement).value)"
            class="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
          />
        </div>
        <div class="flex justify-between text-xs text-gray-400 mt-2">
          <span>{{ HEADER_SCALES[0].label }}</span>
          <span>{{ HEADER_SCALES[HEADER_SCALES.length - 1].label }}</span>
        </div>
      </div>

      <!-- Live preview -->
      <div class="rounded-xl bg-gray-50 dark:bg-surface-800 border border-gray-100 dark:border-gray-700 p-4">
        <p class="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider">Preview</p>
        <h3
          :style="{ fontFamily: getFontStack(uiStore.headerFont) }"
          class="font-semibold text-gray-900 dark:text-white mb-2 leading-snug"
          style="font-size: 1.25rem"
        >
          ဒုၚ်တၠုၚ်မုက်လိက် — Loikmon - လိက်မန်
        </h3>
        <p
          :style="{ fontFamily: getFontStack(uiStore.bodyFont) }"
          class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed"
        >
          လိက်ပတ်မန် ညံၚ်ဟွံဂွံကၠေံ၊ ညံၚ်ဂွံမံက်ဂတဝ် အကြာညးလောကမန် ဇၟာပ်မန် ဒးဗှ်လိက်မန် ဒးချူလိက်မန်ရောၚ်။
        </p>
      </div>
    </div>
  </div>
</template>

