<script setup lang="ts">
import { computed } from 'vue'

/**
 * One badge vocabulary for every status in the CMS, so `published` looks the
 * same on a book, an article and a policy.
 */
const props = defineProps<{ status: string | null | undefined; label?: string }>()

const TONES: Record<string, string> = {
  // Editorial workflow
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  in_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  scheduled: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  archived: 'bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
  // Moderation
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  hidden: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  open: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
  dismissed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  actioned: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  resolved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  closed: 'bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
  // Coupons & subscriptions
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  paused: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  expired: 'bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  canceled: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  grace_period: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  billing_retry: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  revoked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  // Verification & priority
  verified: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  unverified: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  normal: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  low: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
}

const tone = computed(() => TONES[props.status ?? ''] ?? TONES.normal)
const text = computed(() => props.label ?? (props.status ?? 'unknown').replace(/_/g, ' '))
</script>

<template>
  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize" :class="tone">
    {{ text }}
  </span>
</template>
