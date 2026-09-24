<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { cms } from '@loikmon/api'
import type { CmsReview, CmsReviewReport, ReviewMetrics, ReviewStatus } from '@loikmon/api'
import ChartBars from '@/cms/components/ChartBars.vue'
import DataTable from '@/cms/components/DataTable.vue'
import FilterBar from '@/cms/components/FilterBar.vue'
import PageHeader from '@/cms/components/PageHeader.vue'
import PagerBar from '@/cms/components/PagerBar.vue'
import StatCard from '@/cms/components/StatCard.vue'
import StatusBadge from '@/cms/components/StatusBadge.vue'
import { formatDate, useConfirm } from '@/cms/composables/useCmsUi'
import { useResourceList } from '@/cms/composables/useResourceList'
import { useCmsSessionStore } from '@/cms/stores/session'
import { useToastStore } from '@/cms/stores/toast'

/**
 * Review moderation.
 *
 * Hiding a review immediately recomputes the item's rating, because the
 * aggregate only counts published rows.
 */
const session = useCmsSessionStore()
const toast = useToastStore()
const { confirm } = useConfirm()

const tab = ref<'reviews' | 'reports'>('reviews')

const {
  rows, pagination, page, limit, loading, error, filters,
  selection, selectedIds, allSelected, load, reset, toggle, toggleAll, clearSelection, mutate,
} = useResourceList<CmsReview, { q: string; status: ReviewStatus | ''; rating: number | ''; reported: boolean }>({
  filters: { q: '', status: '', rating: '', reported: false },
  fetcher: async ({ q, status, rating, reported, page: p, limit: l }) => {
    const { data } = await cms.reviews.list({
      q: q || undefined,
      status: status || undefined,
      rating: rating === '' ? undefined : Number(rating),
      reported: reported || undefined,
      page: p,
      limit: l,
    })
    return { rows: data.reviews, pagination: data.pagination }
  },
})

const canModerate = computed(() => session.can('reviews.moderate'))
const canDelete = computed(() => session.can('reviews.delete'))
const filtersActive = computed(() => Boolean(filters.q || filters.status || filters.rating || filters.reported))

const columns = [
  { key: 'content', label: 'Review' },
  { key: 'item', label: 'On', hideOnMobile: true },
  { key: 'rating', label: 'Rating', width: '100px' },
  { key: 'status', label: 'Status', width: '110px' },
  { key: 'created_at', label: 'Posted', width: '120px', hideOnMobile: true },
  { key: 'actions', label: '', align: 'right' as const, width: '170px' },
]

// ── Metrics ─────────────────────────────────────────────────────────────────

const metrics = ref<ReviewMetrics | null>(null)

async function loadMetrics() {
  try {
    const { data } = await cms.reviews.metrics({ days: 30 })
    metrics.value = data.metrics
  } catch {
    metrics.value = null
  }
}
void loadMetrics()

// ── Reports ─────────────────────────────────────────────────────────────────

const reports = ref<CmsReviewReport[]>([])
const reportsLoading = ref(false)

async function loadReports() {
  reportsLoading.value = true
  try {
    const { data } = await cms.reviews.reports({ status: 'open', limit: 50 })
    reports.value = data.reports
  } catch (err) {
    toast.failure(err, 'Could not load the reports')
  } finally {
    reportsLoading.value = false
  }
}

watch(tab, (value) => {
  if (value === 'reports') void loadReports()
})

async function resolveReport(report: CmsReviewReport, outcome: 'dismissed' | 'actioned') {
  try {
    await cms.reviews.resolveReport(report.id, outcome)
    await Promise.all([loadReports(), loadMetrics(), load()])
    toast.success(outcome === 'actioned' ? 'Review hidden and report closed' : 'Report dismissed')
  } catch (err) {
    toast.failure(err, 'Could not resolve the report')
  }
}

// ── Moderation ──────────────────────────────────────────────────────────────

async function setStatus(review: CmsReview, status: ReviewStatus) {
  await mutate(() => cms.reviews.setStatus(review.id, status), { success: `Review ${status}` })
  void loadMetrics()
}

async function remove(review: CmsReview) {
  const ok = await confirm({
    title: 'Delete this review?',
    message: 'It is removed permanently and the item rating is recalculated. Hiding it keeps the record instead.',
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return
  await mutate(() => cms.reviews.remove(review.id), { success: 'Review deleted' })
  void loadMetrics()
}

async function bulk(status: ReviewStatus) {
  const result = await mutate(() => cms.reviews.bulk(selectedIds.value as number[], status))
  if (result) {
    toast.success(`${result.data.succeeded.length} review(s) ${status}`)
    clearSelection()
    void loadMetrics()
  }
}

const stars = (rating: number) => '★'.repeat(rating) + '☆'.repeat(5 - rating)
</script>

<template>
  <div>
    <PageHeader title="Reviews" description="Moderate reader reviews and handle reports." :count="pagination?.total ?? null" />

    <div v-if="metrics" class="mb-5 grid gap-4 lg:grid-cols-3">
      <div class="grid grid-cols-2 gap-3 lg:col-span-2">
        <StatCard label="Average rating" :value="metrics.average_rating ? `★ ${metrics.average_rating}` : '—'" :hint="`${metrics.total} reviews`" />
        <StatCard label="Awaiting approval" :value="metrics.pending" />
        <StatCard label="Hidden" :value="metrics.hidden" />
        <StatCard label="Open reports" :value="metrics.open_reports" :hint="`${metrics.reported} reported reviews`" />
      </div>
      <div class="card p-4">
        <h2 class="section-title mb-3 text-base">Rating distribution</h2>
        <ChartBars :items="metrics.distribution.map((d) => ({ label: stars(d.rating), value: d.count }))" />
      </div>
    </div>

    <div class="mb-4 flex gap-1 border-b border-gray-200 dark:border-gray-800" role="tablist">
      <button
        v-for="name in (['reviews', 'reports'] as const)"
        :key="name"
        type="button"
        role="tab"
        class="border-b-2 px-3 py-2 text-sm font-medium capitalize"
        :class="tab === name
          ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300'
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'"
        :aria-selected="tab === name"
        @click="tab = name"
      >
        {{ name }}
        <span v-if="name === 'reports' && metrics?.open_reports" class="badge-yellow ml-1">{{ metrics.open_reports }}</span>
      </button>
    </div>

    <!-- ── Reviews ──────────────────────────────────────────────────── -->
    <template v-if="tab === 'reviews'">
      <FilterBar
        v-model:search="filters.q"
        placeholder="Search review text…"
        :active="filtersActive"
        :selected-count="selectedIds.length"
        @clear="reset"
      >
        <template #filters>
          <select v-model="filters.status" class="input h-9 w-auto" aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="pending">Awaiting approval</option>
            <option value="hidden">Hidden</option>
          </select>
          <select v-model="filters.rating" class="input h-9 w-auto" aria-label="Filter by rating">
            <option value="">Any rating</option>
            <option v-for="n in 5" :key="n" :value="n">{{ n }} star{{ n === 1 ? '' : 's' }}</option>
          </select>
          <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input v-model="filters.reported" type="checkbox" class="rounded text-brand-600" />
            Reported only
          </label>
        </template>

        <template #bulk>
          <button v-if="canModerate" type="button" class="btn-secondary h-8 text-xs" @click="bulk('published')">Publish</button>
          <button v-if="canModerate" type="button" class="btn-secondary h-8 text-xs" @click="bulk('hidden')">Hide</button>
        </template>
      </FilterBar>

      <DataTable
        :rows="rows"
        :columns="columns"
        :loading="loading"
        :error="error"
        selectable
        :selection="selection"
        :all-selected="allSelected"
        :dimmed="(row: CmsReview) => row.status === 'hidden'"
        empty-title="No reviews"
        empty-message="Reader reviews will appear here for moderation."
        @toggle="toggle"
        @toggle-all="toggleAll"
        @retry="load"
      >
        <template #cell-content="{ row }">
          <p class="line-clamp-2 text-sm text-gray-800 dark:text-gray-100">{{ row.content || '(rating only)' }}</p>
          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {{ row.user_name ?? 'Unknown' }}
            <span v-if="row.user_email"> · {{ row.user_email }}</span>
            <span v-if="row.report_count" class="badge-yellow ml-1">{{ row.report_count }} reports</span>
          </p>
        </template>

        <template #cell-item="{ row }">
          <span class="text-xs capitalize text-gray-600 dark:text-gray-300">
            {{ row.item_type }}: {{ row.book_title ?? row.article_title ?? `#${row.item_id}` }}
          </span>
        </template>

        <template #cell-rating="{ row }">
          <span class="text-amber-500" :aria-label="`${row.rating} out of 5`">{{ stars(row.rating) }}</span>
        </template>

        <template #cell-status="{ row }"><StatusBadge :status="row.status" /></template>
        <template #cell-created_at="{ row }">{{ formatDate(row.created_at) }}</template>

        <template #cell-actions="{ row }">
          <div class="flex items-center justify-end gap-1">
            <button
              v-if="canModerate && row.status !== 'published'"
              type="button"
              class="btn-ghost h-7 px-2 text-xs"
              @click="setStatus(row, 'published')"
            >
              Publish
            </button>
            <button
              v-if="canModerate && row.status !== 'hidden'"
              type="button"
              class="btn-ghost h-7 px-2 text-xs"
              @click="setStatus(row, 'hidden')"
            >
              Hide
            </button>
            <button v-if="canDelete" type="button" class="btn-ghost h-7 px-2 text-xs text-red-600" @click="remove(row)">Delete</button>
          </div>
        </template>
      </DataTable>

      <PagerBar
        :pagination="pagination"
        :limit="limit"
        :loading="loading"
        @update:page="page = $event"
        @update:limit="limit = $event"
      />
    </template>

    <!-- ── Reports ──────────────────────────────────────────────────── -->
    <template v-else>
      <div v-if="reportsLoading" class="space-y-2">
        <div v-for="n in 4" :key="n" class="skeleton h-24 w-full" />
      </div>

      <p v-else-if="!reports.length" class="card p-10 text-center text-sm text-gray-500 dark:text-gray-400">
        No open reports. Readers can flag a review from the storefront.
      </p>

      <ul v-else class="space-y-3">
        <li v-for="report in reports" :key="report.id" class="card p-4">
          <div class="flex flex-wrap items-start gap-3">
            <span class="badge-yellow shrink-0 capitalize">{{ report.reason.replace('_', ' ') }}</span>
            <div class="min-w-0 flex-1">
              <p class="text-sm text-gray-800 dark:text-gray-100">{{ report.review_content || '(rating only)' }}</p>
              <p v-if="report.note" class="mt-1 text-xs italic text-gray-500 dark:text-gray-400">“{{ report.note }}”</p>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Reported by {{ report.reporter_email ?? 'a reader' }} · {{ formatDate(report.created_at, true) }}
                <span v-if="report.review_rating"> · ★ {{ report.review_rating }}</span>
                <StatusBadge v-if="report.review_status" :status="report.review_status" class="ml-1" />
              </p>
            </div>
            <div v-if="canModerate" class="flex shrink-0 gap-2">
              <button type="button" class="btn-secondary h-8 text-xs" @click="resolveReport(report, 'dismissed')">Dismiss</button>
              <button type="button" class="btn-danger h-8 text-xs" @click="resolveReport(report, 'actioned')">Hide review</button>
            </div>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>
