<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { UI_FONT_OPTIONS, BODY_FONT_SIZES, HEADER_SCALES, getFontStack } from '@/stores/ui'
import type { Locale, Theme } from '@/stores/ui'
import ChoiceCard from '@/components/settings/ChoiceCard.vue'
import RangeControl from '@/components/settings/RangeControl.vue'
import SettingsSection from '@/components/settings/SettingsSection.vue'

const { t, locale } = useI18n()
const uiStore = useUiStore()

const themes = computed<{ value: Theme; label: string; description: string; icon: string; previewClass: string }[]>(() => [
  {
    value: 'light',
    label: t('settings.themeLight'),
    description: t('settings.themeLightDesc'),
    icon: '☀️',
    previewClass: 'bg-linear-to-r from-amber-200 via-white to-sky-200',
  },
  {
    value: 'dark',
    label: t('settings.themeDark'),
    description: t('settings.themeDarkDesc'),
    icon: '🌙',
    previewClass: 'bg-linear-to-r from-slate-900 via-indigo-950 to-brand-900',
  },
  {
    value: 'system',
    label: t('settings.themeSystem'),
    description: t('settings.themeSystemDesc'),
    icon: '💻',
    previewClass: 'bg-linear-to-r from-white via-brand-100 to-slate-900',
  },
])

const languages = computed<{ value: Locale; label: string; description: string; icon: string }[]>(() => [
  { value: 'en', label: 'English', description: t('settings.languageEnglishDesc'), icon: 'EN' },
  { value: 'mon', label: 'ဘာသာမန်', description: t('settings.languageMonDesc'), icon: 'မန်' },
])

const currentFontSizeIndex = computed(() =>
  Math.max(0, BODY_FONT_SIZES.findIndex(sz => sz.id === uiStore.bodyFontSizeId)),
)

const currentFontSize = computed(() => BODY_FONT_SIZES[currentFontSizeIndex.value] ?? BODY_FONT_SIZES[2])

const currentHeaderScaleIndex = computed(() =>
  Math.max(0, HEADER_SCALES.findIndex(sc => sc.id === uiStore.headerScaleId)),
)

const currentHeaderScale = computed(() => HEADER_SCALES[currentHeaderScaleIndex.value] ?? HEADER_SCALES[1])

const activeTheme = computed(() => themes.value.find(th => th.value === uiStore.theme) ?? themes.value[2])
const activeLanguage = computed(() => languages.value.find(lang => lang.value === uiStore.locale) ?? languages.value[0])
const activeBodyFont = computed(() => UI_FONT_OPTIONS.find(font => font.id === uiStore.bodyFont))
const activeHeaderFont = computed(() => UI_FONT_OPTIONS.find(font => font.id === uiStore.headerFont))

function handleFontSizeChange(value: string) {
  const index = Number.parseInt(value, 10)
  if (index >= 0 && index < BODY_FONT_SIZES.length) {
    uiStore.setBodyFontSize(BODY_FONT_SIZES[index].id)
  }
}

function decreaseFontSize() {
  const nextIndex = Math.max(0, currentFontSizeIndex.value - 1)
  uiStore.setBodyFontSize(BODY_FONT_SIZES[nextIndex].id)
}

function increaseFontSize() {
  const nextIndex = Math.min(BODY_FONT_SIZES.length - 1, currentFontSizeIndex.value + 1)
  uiStore.setBodyFontSize(BODY_FONT_SIZES[nextIndex].id)
}

function handleHeaderScaleChange(value: string) {
  const index = Number.parseInt(value, 10)
  if (index >= 0 && index < HEADER_SCALES.length) {
    uiStore.setHeaderScale(HEADER_SCALES[index].id)
  }
}

function decreaseHeaderScale() {
  const nextIndex = Math.max(0, currentHeaderScaleIndex.value - 1)
  uiStore.setHeaderScale(HEADER_SCALES[nextIndex].id)
}

function increaseHeaderScale() {
  const nextIndex = Math.min(HEADER_SCALES.length - 1, currentHeaderScaleIndex.value + 1)
  uiStore.setHeaderScale(HEADER_SCALES[nextIndex].id)
}

function setLocale(value: Locale) {
  uiStore.setLocale(value)
  locale.value = value
}
</script>

<template>
  <div class="page-wrapper max-w-6xl">
    <div class="relative mb-8 overflow-hidden rounded-4xl border border-brand-100 bg-linear-to-br from-brand-50 via-white to-sky-50 p-6 shadow-sm dark:border-brand-900/50 dark:from-brand-950/50 dark:via-surface-900 dark:to-surface-950 sm:p-8">
      <div class="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-300/20 blur-3xl dark:bg-brand-700/20" />
      <div class="absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-800/20" />

      <div class="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div class="max-w-2xl">
          <p class="mb-3 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-600 shadow-sm ring-1 ring-brand-100 dark:bg-surface-900/70 dark:text-brand-300 dark:ring-brand-800">
            ⚙️ {{ t('nav.settings') }}
          </p>
          <p class="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300 sm:text-base">
            {{ t('settings.subtitle') }}
          </p>
        </div>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-104">
          <div class="rounded-2xl bg-white/75 p-3 shadow-sm ring-1 ring-gray-100 backdrop-blur dark:bg-surface-900/70 dark:ring-gray-800">
            <p class="text-xs text-gray-400">{{ t('settings.currentTheme') }}</p>
            <p class="mt-1 truncate text-sm font-bold text-gray-900 dark:text-white">{{ activeTheme.label }}</p>
          </div>
          <div class="rounded-2xl bg-white/75 p-3 shadow-sm ring-1 ring-gray-100 backdrop-blur dark:bg-surface-900/70 dark:ring-gray-800">
            <p class="text-xs text-gray-400">{{ t('settings.currentLanguage') }}</p>
            <p class="mt-1 truncate text-sm font-bold text-gray-900 dark:text-white">{{ activeLanguage.label }}</p>
          </div>
          <div class="rounded-2xl bg-white/75 p-3 shadow-sm ring-1 ring-gray-100 backdrop-blur dark:bg-surface-900/70 dark:ring-gray-800">
            <p class="text-xs text-gray-400">{{ t('settings.bodyTextSize') }}</p>
            <p class="mt-1 truncate text-sm font-bold text-gray-900 dark:text-white">{{ currentFontSize.label }} · {{ currentFontSize.px }}px</p>
          </div>
          <div class="rounded-2xl bg-white/75 p-3 shadow-sm ring-1 ring-gray-100 backdrop-blur dark:bg-surface-900/70 dark:ring-gray-800">
            <p class="text-xs text-gray-400">{{ t('settings.headingSize') }}</p>
            <p class="mt-1 truncate text-sm font-bold text-gray-900 dark:text-white">{{ currentHeaderScale.label }} · {{ Math.round(currentHeaderScale.scale * 100) }}%</p>
          </div>
        </div>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div class="space-y-6">
        <SettingsSection
          icon="🎨"
          :title="t('settings.appearanceTitle')"
          :description="t('settings.appearanceDescription')"
        >
          <div class="grid gap-3 md:grid-cols-3">
            <ChoiceCard
              v-for="theme in themes"
              :key="theme.value"
              :active="uiStore.theme === theme.value"
              :icon="theme.icon"
              :title="theme.label"
              :description="theme.description"
              :preview-class="theme.previewClass"
              @select="uiStore.setTheme(theme.value)"
            />
          </div>
        </SettingsSection>

        <SettingsSection
          icon="🌐"
          :title="t('settings.language')"
          :description="t('settings.languageDescription')"
        >
          <div class="grid gap-3 sm:grid-cols-2">
            <ChoiceCard
              v-for="language in languages"
              :key="language.value"
              :active="uiStore.locale === language.value"
              :icon="language.icon"
              :title="language.label"
              :description="language.description"
              @select="setLocale(language.value)"
            />
          </div>
        </SettingsSection>

        <SettingsSection
          icon="🔤"
          :title="t('settings.typography')"
          :description="t('settings.typographyDescription')"
        >
          <div class="space-y-6">
            <div>
              <div class="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 class="text-sm font-bold text-gray-800 dark:text-gray-100">{{ t('settings.bodyFont') }}</h3>
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.bodyFontDescription') }}</p>
                </div>
                <span v-if="activeBodyFont" class="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
                  {{ activeBodyFont.label }}
                </span>
              </div>

              <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <button
                  v-for="font in UI_FONT_OPTIONS"
                  :key="font.id"
                  type="button"
                  :style="{ fontFamily: font.stack }"
                  :class="[
                    'rounded-2xl border px-3 py-2.5 text-left text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                    uiStore.bodyFont === font.id
                      ? 'border-brand-500 bg-brand-50 text-brand-800 shadow-sm dark:bg-brand-900/30 dark:text-brand-200'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-brand-200 hover:shadow-sm dark:border-gray-800 dark:bg-surface-900 dark:text-gray-300 dark:hover:border-brand-800',
                  ]"
                  @click="uiStore.setBodyFont(font.id)"
                >
                  {{ font.label }}
                </button>
              </div>
            </div>

            <RangeControl
              :label="t('settings.bodyTextSize')"
              :display-value="`${currentFontSize.label} (${currentFontSize.px}px)`"
              :value="currentFontSizeIndex"
              :max="BODY_FONT_SIZES.length - 1"
              :min-label="BODY_FONT_SIZES[0].label"
              :max-label="BODY_FONT_SIZES[BODY_FONT_SIZES.length - 1].label"
              decrease-label="Decrease body font size"
              increase-label="Increase body font size"
              @decrease="decreaseFontSize"
              @increase="increaseFontSize"
              @change="handleFontSizeChange"
            />

            <div class="h-px bg-linear-to-r from-transparent via-gray-200 to-transparent dark:via-gray-800" />

            <div>
              <div class="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 class="text-sm font-bold text-gray-800 dark:text-gray-100">{{ t('settings.headingFont') }}</h3>
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.headingFontDescription') }}</p>
                </div>
                <span v-if="activeHeaderFont" class="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
                  {{ activeHeaderFont.label }}
                </span>
              </div>

              <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <button
                  v-for="font in UI_FONT_OPTIONS"
                  :key="font.id"
                  type="button"
                  :style="{ fontFamily: font.stack }"
                  :class="[
                    'rounded-2xl border px-3 py-2.5 text-left text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                    uiStore.headerFont === font.id
                      ? 'border-brand-500 bg-brand-50 text-brand-800 shadow-sm dark:bg-brand-900/30 dark:text-brand-200'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-brand-200 hover:shadow-sm dark:border-gray-800 dark:bg-surface-900 dark:text-gray-300 dark:hover:border-brand-800',
                  ]"
                  @click="uiStore.setHeaderFont(font.id)"
                >
                  {{ font.label }}
                </button>
              </div>
            </div>

            <RangeControl
              :label="t('settings.headingSize')"
              :display-value="`${currentHeaderScale.label} (${Math.round(currentHeaderScale.scale * 100)}%)`"
              :value="currentHeaderScaleIndex"
              :max="HEADER_SCALES.length - 1"
              :min-label="HEADER_SCALES[0].label"
              :max-label="HEADER_SCALES[HEADER_SCALES.length - 1].label"
              decrease-label="Decrease heading scale"
              increase-label="Increase heading scale"
              @decrease="decreaseHeaderScale"
              @increase="increaseHeaderScale"
              @change="handleHeaderScaleChange"
            />
          </div>
        </SettingsSection>
      </div>

      <aside class="lg:sticky lg:top-20">
        <div class="overflow-hidden rounded-4xl border border-gray-100 bg-white shadow-lg shadow-gray-200/60 dark:border-gray-800 dark:bg-surface-900 dark:shadow-black/20">
          <div class="bg-linear-to-br from-brand-600 via-brand-500 to-sky-500 p-5 text-white">
            <p class="text-xs font-bold uppercase tracking-wider text-white/70">{{ t('settings.preview') }}</p>
            <h2 class="mt-2 text-xl font-black">{{ t('settings.previewTitle') }}</h2>
            <p class="mt-1 text-sm text-white/80">{{ t('settings.previewSubtitle') }}</p>
          </div>

          <div class="space-y-5 p-5">
            <div class="rounded-2xl bg-gray-50 p-4 dark:bg-surface-800">
              <p class="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">{{ t('settings.readingPreview') }}</p>
              <h3
                :style="{ fontFamily: getFontStack(uiStore.headerFont) }"
                class="mb-3 font-bold leading-snug text-gray-950 dark:text-white"
              >
                {{ t('settings.previewHeading') }}
              </h3>
              <p
                :style="{ fontFamily: getFontStack(uiStore.bodyFont) }"
                class="text-sm leading-relaxed text-gray-600 dark:text-gray-300"
              >
                {{ t('settings.previewBody') }}
              </p>
            </div>

            <div class="grid grid-cols-2 gap-3 text-sm">
              <div class="rounded-2xl border border-gray-100 p-3 dark:border-gray-800">
                <p class="text-xs text-gray-400">{{ t('settings.currentTheme') }}</p>
                <p class="mt-1 font-bold text-gray-900 dark:text-white">{{ activeTheme.label }}</p>
              </div>
              <div class="rounded-2xl border border-gray-100 p-3 dark:border-gray-800">
                <p class="text-xs text-gray-400">{{ t('settings.currentLanguage') }}</p>
                <p class="mt-1 font-bold text-gray-900 dark:text-white">{{ activeLanguage.label }}</p>
              </div>
            </div>

            <p class="rounded-2xl bg-brand-50 px-4 py-3 text-xs font-medium leading-relaxed text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">
              ✨ {{ t('settings.quickStatus') }}
            </p>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>
