<script setup lang="ts">
import { computed } from 'vue'
import logoUrl from '@/assets/logo.png'
import { CMS_NAV } from '@/cms/navigation'
import { useCmsSessionStore } from '@/cms/stores/session'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const session = useCmsSessionStore()

/** Sections with nothing visible are dropped entirely. */
const sections = computed(() =>
  CMS_NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) => session.canAny(...item.permissions)),
  })).filter((section) => section.items.length > 0),
)

const roleLabel = computed(() => session.session?.roles.map((r) => r.name).join(', ') || 'No role')
</script>

<template>
  <aside
    class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-200 dark:border-gray-800 dark:bg-surface-900 lg:static lg:translate-x-0 print:hidden"
    :class="props.open ? 'translate-x-0' : '-translate-x-full'"
    aria-label="CMS navigation"
  >
    <div class="flex h-14 shrink-0 items-center gap-2 border-b border-gray-100 px-4 dark:border-gray-800">
      <RouterLink to="/" class="flex min-w-0 items-center gap-2 no-underline" title="Back to the site">
        <img :src="logoUrl" alt="Loikmon logo" class="h-7 w-7 shrink-0 rounded-lg object-cover" />
        <span class="truncate text-sm font-semibold text-gray-900 dark:text-white">Loikmon CMS</span>
      </RouterLink>
      <button
        type="button"
        class="btn-ghost ml-auto p-1.5 lg:hidden"
        aria-label="Close navigation"
        @click="emit('close')"
      >
        ×
      </button>
    </div>

    <nav class="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      <div v-for="section in sections" :key="section.key">
        <p class="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {{ section.label }}
        </p>
        <ul class="space-y-0.5">
          <li v-for="item in section.items" :key="item.name">
            <RouterLink
              :to="{ name: item.name }"
              class="nav-link no-underline"
              active-class="active"
              @click="emit('close')"
            >
              <span class="w-4 shrink-0 text-center text-base leading-none" aria-hidden="true">{{ item.icon }}</span>
              <span class="truncate">{{ item.label }}</span>
            </RouterLink>
          </li>
        </ul>
      </div>

      <p v-if="!sections.length" class="px-3 text-sm text-gray-500 dark:text-gray-400">
        Your account has no CMS permissions yet.
      </p>
    </nav>

    <div class="shrink-0 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
      <p class="truncate text-xs font-medium text-gray-700 dark:text-gray-200">{{ session.session?.user.email }}</p>
      <p class="truncate text-[11px] text-gray-500 dark:text-gray-400">
        {{ roleLabel }}
        <span v-if="session.isOwnScope" class="badge-yellow ml-1">own content</span>
      </p>
      <RouterLink to="/" class="mt-2 block text-xs text-brand-600 no-underline hover:underline dark:text-brand-400">
        ← Back to the site
      </RouterLink>
    </div>
  </aside>
</template>
