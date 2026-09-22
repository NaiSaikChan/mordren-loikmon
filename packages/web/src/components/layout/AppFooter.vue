<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import StoreButtons from '@/components/shared/StoreButtons.vue'
import logoUrl from '@/assets/logo.png'
import {
  CONTACT_EMAIL,
  CONTACT_PHONE,
  PRIVACY_URL,
  SITE_URL,
  TERMS_URL,
} from '@/config'

const { t } = useI18n()

interface FooterLink {
  key: string
  label: string
  /** In-app route (RouterLink) … */
  to?: string
  /** … or an external/protocol target (plain anchor). */
  href?: string
}

interface FooterGroup {
  /** Also the id of the group heading that labels its <nav>. */
  key: string
  title: string
  links: FooterLink[]
}

const groups = computed<FooterGroup[]>(() => [
  {
    key: 'discover',
    title: t('footer.discover'),
    links: [
      { key: 'home',        label: t('nav.home'),        to: '/' },
      { key: 'books',       label: t('nav.books'),       to: '/books' },
      { key: 'articles',    label: t('nav.articles'),    to: '/articles' },
      { key: 'authors',     label: t('nav.authors'),     to: '/authors' }
    ],
  },
  {
    key: 'account',
    title: t('footer.account'),
    links: [
      { key: 'library',      label: t('nav.library'),      to: '/library' },
      { key: 'subscription', label: t('nav.subscription'), to: '/subscription' },
      { key: 'inbox',        label: t('nav.inbox'),        to: '/inbox' },
      { key: 'settings',     label: t('nav.settings'),     to: '/settings' }
    ],
  },
  {
    key: 'support',
    title: t('footer.support'),
    links: [
      { key: 'about',   label: t('nav.about'),       to: '/about' },
      { key: 'faq',     label: t('nav.faq'),         to: '/faq' },
      { key: 'contact', label: CONTACT_EMAIL,        href: `mailto:${CONTACT_EMAIL}` },
      { key: 'phone',   label: CONTACT_PHONE,        href: `tel:${CONTACT_PHONE.replace(/\s+/g, '')}` }
    ],
  },
])

const legalLinks = computed<FooterLink[]>(() => [
  { key: 'terms',   label: t('footer.terms'),   href: TERMS_URL },
  { key: 'privacy', label: t('footer.privacy'), href: PRIVACY_URL },
])

const year = new Date().getFullYear()

/** `mailto:`/`tel:` must not get target/rel; only real web links do. */
function isWebLink(href: string) {
  return href.startsWith('http')
}
</script>

<template>
  <footer class="app-footer border-t border-gray-100 bg-white dark:border-gray-800 dark:bg-surface-900">
    <div class="app-footer-inner mx-auto w-full max-w-screen-xl px-4 pt-10 sm:px-6 lg:px-8">
      <div class="grid gap-10 lg:grid-cols-12 lg:gap-8">
        <!-- Brand + app stores -->
        <div class="lg:col-span-4">
          <RouterLink
            to="/"
            class="inline-flex items-center gap-3 text-gray-900 no-underline hover:text-gray-900 dark:text-white dark:hover:text-white"
          >
            <span class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
              <img :src="logoUrl" alt="" width="40" height="40" loading="lazy" decoding="async" class="size-full object-contain" />
            </span>
            <span>
              <span class="block text-sm font-bold leading-tight">{{ t('app.name') }}</span>
              <span class="block text-xs text-gray-400">{{ t('app.tagline') }}</span>
            </span>
          </RouterLink>

          <p class="mt-4 max-w-sm text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            {{ t('footer.tagline') }}
          </p>

          <h2 class="mt-6 text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">
            {{ t('footer.getTheApp') }}
          </h2>
          <p class="mt-1 text-xs text-gray-400">{{ t('footer.getTheAppBody') }}</p>
          <StoreButtons class="mt-3" />
        </div>

        <!-- Link groups -->
        <div class="grid gap-8 sm:grid-cols-3 lg:col-span-8">
          <nav
            v-for="group in groups"
            :key="group.key"
            :aria-labelledby="`footer-group-${group.key}`"
          >
            <h2
              :id="`footer-group-${group.key}`"
              class="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white"
            >
              {{ group.title }}
            </h2>
            <ul role="list" class="mt-3 space-y-1">
              <li v-for="link in group.links" :key="link.key">
                <RouterLink v-if="link.to" :to="link.to" class="footer-link">
                  {{ link.label }}
                </RouterLink>
                <a
                  v-else-if="link.href"
                  :href="link.href"
                  class="footer-link"
                  :target="isWebLink(link.href) ? '_blank' : undefined"
                  :rel="isWebLink(link.href) ? 'noopener noreferrer' : undefined"
                >
                  {{ link.label }}
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      <!-- Legal bar -->
      <div
        class="mt-10 flex flex-col gap-3 border-t border-gray-100 py-6 text-xs text-gray-400 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between"
      >
        <p>
          © {{ year }} {{ t('app.name') }}. {{ t('footer.rights') }}
          <span class="hidden sm:inline">· {{ t('footer.madeFor') }}</span>
        </p>
        <nav aria-labelledby="footer-legal-label">
          <h2 id="footer-legal-label" class="sr-only">{{ t('footer.legal') }}</h2>
          <ul role="list" class="flex flex-wrap items-center gap-x-4 gap-y-1">
            <li v-for="link in legalLinks" :key="link.key">
              <a :href="link.href" target="_blank" rel="noopener noreferrer" class="footer-link">
                {{ link.label }}
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  </footer>
</template>

<style scoped>
/*
 * The footer always starts offscreen, so its subtree is skipped until it
 * scrolls close. The reserved block size keeps the scrollbar from jumping;
 * the real footer is taller on mobile (stacked columns) than on desktop.
 */
.app-footer {
  content-visibility: auto;
  contain-intrinsic-size: auto 760px;
}

@media (min-width: 1024px) {
  .app-footer {
    contain-intrinsic-size: auto 340px;
  }
}
</style>
