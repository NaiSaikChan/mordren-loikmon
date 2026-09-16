<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import appStoreBadge from '@/assets/Download_on_the_App_Store_RGB_blk.svg'
import googlePlayBadge from '@/assets/Google_Play_Store_badge_EN.svg'
import { APP_STORE_URL, PLAY_STORE_URL } from '@/config'

const { t } = useI18n()
</script>

<template>
  <div class="flex flex-wrap gap-3">
    <a
      :href="PLAY_STORE_URL"
      target="_blank"
      rel="noopener"
      class="inline-flex transition-opacity hover:opacity-90"
      :aria-label="t('subscription.getOnGooglePlay')"
      data-testid="store-google-play"
    >
      <img :src="googlePlayBadge" :alt="t('subscription.getOnGooglePlay')" class="h-[52px] w-auto" />
    </a>
    <a
      :href="APP_STORE_URL"
      target="_blank"
      rel="noopener"
      class="inline-flex transition-opacity hover:opacity-90"
      :aria-label="t('subscription.downloadOnAppStore')"
      data-testid="store-app-store"
    >
      <img :src="appStoreBadge" :alt="t('subscription.downloadOnAppStore')" class="h-[52px] w-auto" />
    </a>
  </div>
</template>
