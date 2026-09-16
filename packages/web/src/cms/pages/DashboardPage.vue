<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { cms } from '@loikmon/api'
import type { DashboardResponse } from '@loikmon/api'
import ChartBars from '@/cms/components/ChartBars.vue'
import ChartDonut from '@/cms/components/ChartDonut.vue'
import ChartLine from '@/cms/components/ChartLine.vue'
import PageHeader from '@/cms/components/PageHeader.vue'
import StatCard from '@/cms/components/StatCard.vue'
import { downloadCsv, formatDuration, formatMoney, formatNumber } from '@/cms/composables/useCmsUi'
import { useCmsSessionStore } from '@/cms/stores/session'
import { useToastStore } from '@/cms/stores/toast'

/**
 * One dashboard, three audiences.
 *
 * The server decides what it may return: an author without `analytics.view`
 * receives `scope: 'own'` and sees only their own numbers, so there is no
 * client-side filtering to get wrong.
 */
const session = useCmsSessionStore()
const toast = useToastStore()

const days = ref(30)
const loading = ref(true)
const data = ref<DashboardResponse | null>(null)

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '12 months' },
]

async function load() {
  loading.value = true
  try {
    const response = await cms.analytics.overview({ days: days.value })
    data.value = response.data
  } catch (err) {
    toast.failure(err, 'Could not load the dashboard')
  } finally {
    loading.value = false
  }
}

watch(days, () => void load(), { immediate: true })

const platform = computed(() => (data.value?.scope === 'platform' ? data.value : null))
const own = computed(() => (data.value?.scope === 'own' ? data.value.author : null))

// ── Platform derived views ──────────────────────────────────────────────────

const contentByStatus = computed(() => {
  const content = platform.value?.overview.content
  if (!content) return []
  const merged: Record<string, number> = {}
  for (const [status, count] of Object.entries({ ...content.books })) merged[status] = (merged[status] ?? 0) + count
  for (const [status, count] of Object.entries({ ...content.articles })) merged[status] = (merged[status] ?? 0) + count
  return Object.entries(merged).map(([label, value]) => ({ label, value }))
})

const planMix = computed(
  () => platform.value?.overview.subscriptions.by_plan.map((p) => ({ label: p.plan_code, value: p.count })) ?? [],
)

const topContent = computed(() => {
  const overview = platform.value?.overview
  if (!overview) return []
  return [
    ...overview.top_books.map((b) => ({ ...b, kind: 'Book' as const })),
    ...overview.top_articles.map((a) => ({ ...a, kind: 'Article' as const })),
  ]
    .sort((a, b) => b.views - a.views)
    .slice(0, 8)
})

function exportOverview() {
  if (platform.value) {
    downloadCsv(
      `loikmon-dashboard-${days.value}d.csv`,
      [
        { key: 'date', label: 'Date' },
        { key: 'revenue', label: 'Estimated revenue (cents)' },
        { key: 'signups', label: 'New accounts' },
      ],
      platform.value.overview.revenue.series.map((point, index) => ({
        date: point.date,
        revenue: point.value,
        signups: platform.value!.overview.users.series[index]?.value ?? 0,
      })),
    )
  } else if (own.value) {
    downloadCsv(
      `my-content-${days.value}d.csv`,
      [
        { key: 'title', label: 'Title' },
        { key: 'views', label: 'Views' },
        { key: 'rating', label: 'Rating' },
      ],
      [...own.value.top_books, ...own.value.top_articles],
    )
  }
}
</script>

<template>
  <div>
    <PageHeader
      title="Dashboard"
      :description="platform ? 'Revenue, audience and catalogue performance.' : 'How your books and articles are doing.'"
    >
      <template #actions>
        <div class="flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700" role="group" aria-label="Date range">
          <button
            v-for="range in RANGES"
            :key="range.days"
            type="button"
            class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
            :class="days === range.days ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'"
            :aria-pressed="days === range.days"
            @click="days = range.days"
          >
            {{ range.label }}
          </button>
        </div>
        <button type="button" class="btn-secondary h-9" :disabled="loading || !data" @click="exportOverview">Export CSV</button>
      </template>
    </PageHeader>

    <!-- ── Author dashboard ───────────────────────────────────────────── -->
    <template v-if="own">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total views" :value="formatNumber(own.totals.views)" :loading="loading" hint="books + articles" />
        <StatCard label="Audiobook listens" :value="formatNumber(own.totals.listens)" :loading="loading" hint="unique listeners" />
        <StatCard label="Reads & downloads" :value="formatNumber(own.totals.downloads)" :loading="loading" hint="PDF and EPUB" />
        <StatCard label="Followers" :value="formatNumber(own.totals.followers)" :loading="loading" />
      </div>

      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        <section class="card p-4">
          <h2 class="section-title mb-3 text-base">Most read books</h2>
          <ChartBars
            :items="own.top_books.map((b) => ({ label: b.title, value: b.views, hint: b.rating ? `★ ${b.rating}` : undefined }))"
            empty-message="No reads recorded yet"
          />
        </section>

        <section class="card p-4">
          <h2 class="section-title mb-3 text-base">Most read articles</h2>
          <ChartBars
            :items="own.top_articles.map((a) => ({ label: a.title, value: a.views }))"
            empty-message="No article views yet"
          />
        </section>

        <section class="card p-4">
          <h2 class="section-title mb-3 text-base">How readers consume your work</h2>
          <ChartDonut
            :items="own.reading_progress.map((p) => ({ label: p.format, value: p.readers }))"
            center-label="readers"
          />
        </section>

        <section class="card p-4">
          <h2 class="section-title mb-3 text-base">Catalogue</h2>
          <dl class="grid grid-cols-2 gap-3 text-sm">
            <div><dt class="text-gray-500 dark:text-gray-400">Books</dt><dd class="text-lg font-semibold">{{ own.totals.books }}</dd></div>
            <div><dt class="text-gray-500 dark:text-gray-400">Articles</dt><dd class="text-lg font-semibold">{{ own.totals.articles }}</dd></div>
            <div><dt class="text-gray-500 dark:text-gray-400">Average rating</dt><dd class="text-lg font-semibold">{{ own.totals.average_rating || '—' }}</dd></div>
            <div>
              <dt class="text-gray-500 dark:text-gray-400">Coupons</dt>
              <dd class="text-lg font-semibold">
                <RouterLink v-if="session.canAny('author.coupons.analytics')" :to="{ name: 'cms-coupons' }" class="no-underline hover:underline">
                  View →
                </RouterLink>
                <span v-else>—</span>
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </template>

    <!-- ── Platform dashboard ─────────────────────────────────────────── -->
    <template v-else-if="platform">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Estimated revenue"
          :value="formatMoney(platform.overview.revenue.estimated_cents, platform.overview.revenue.currency)"
          :hint="`${platform.overview.revenue.new_subscriptions} new subscriptions`"
          :series="platform.overview.revenue.series.map((p) => p.value)"
          :loading="loading"
        />
        <StatCard
          label="Active users"
          :value="formatNumber(platform.overview.users.active_in_range)"
          :hint="`${formatNumber(platform.overview.users.total)} total`"
          :loading="loading"
        />
        <StatCard
          label="New accounts"
          :value="formatNumber(platform.overview.users.new_in_range)"
          :series="platform.overview.users.series.map((p) => p.value)"
          :loading="loading"
        />
        <StatCard
          label="Active subscriptions"
          :value="formatNumber(platform.overview.subscriptions.active)"
          :hint="`${platform.overview.subscriptions.in_grace} in grace`"
          :loading="loading"
        />
      </div>

      <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Revenue is the list price of plans whose subscriptions started in the period — before store commission, tax and refunds.
        Settled amounts come from App Store Connect and Google Play Console.
      </p>

      <div class="mt-4 grid gap-4 lg:grid-cols-3">
        <section class="card p-4 lg:col-span-2">
          <h2 class="section-title mb-3 text-base">Revenue trend</h2>
          <ChartLine
            :points="platform.overview.revenue.series"
            label="Estimated revenue per day"
            :format="(value) => formatMoney(value, platform!.overview.revenue.currency)"
          />
        </section>

        <section class="card p-4">
          <h2 class="section-title mb-3 text-base">Plan mix</h2>
          <ChartDonut :items="planMix" center-label="active" />
        </section>

        <section class="card p-4 lg:col-span-2">
          <h2 class="section-title mb-3 text-base">Sign-ups</h2>
          <ChartLine :points="platform.overview.users.series" label="New accounts per day" :format="formatNumber" :area="false" />
        </section>

        <section class="card p-4">
          <h2 class="section-title mb-3 text-base">Content by status</h2>
          <ChartDonut :items="contentByStatus" center-label="items" />
          <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
            {{ platform.overview.content.authors }} authors ·
            {{ platform.overview.content.categories }} categories ·
            {{ formatNumber(platform.overview.content.total_views) }} lifetime views
          </p>
        </section>
      </div>

      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        <section class="card p-4">
          <h2 class="section-title mb-3 text-base">Most viewed content</h2>
          <ChartBars
            :items="topContent.map((item) => ({ label: `${item.kind}: ${item.title}`, value: item.views, hint: item.rating ? `★ ${item.rating}` : undefined }))"
            empty-message="No views recorded yet"
          />
        </section>

        <section class="card p-4">
          <h2 class="section-title mb-3 text-base">Author performance</h2>
          <ChartBars
            :items="platform.authors.map((a) => ({ label: a.name, value: a.views, hint: `${a.books + a.articles} items` }))"
            palette
            empty-message="No author activity yet"
          />
        </section>

        <section v-if="platform.coupons" class="card p-4">
          <h2 class="section-title mb-3 text-base">Coupon campaigns</h2>
          <div class="mb-3 grid grid-cols-3 gap-3 text-sm">
            <div><p class="text-gray-500 dark:text-gray-400">Redemptions</p><p class="text-lg font-semibold">{{ platform.coupons.redemptions }}</p></div>
            <div><p class="text-gray-500 dark:text-gray-400">Discount given</p><p class="text-lg font-semibold">{{ formatMoney(platform.coupons.discount_cents) }}</p></div>
            <div><p class="text-gray-500 dark:text-gray-400">Active</p><p class="text-lg font-semibold">{{ platform.coupons.active }}/{{ platform.coupons.coupons }}</p></div>
          </div>
          <ChartBars
            :items="platform.coupons.top.map((c) => ({ label: c.code, value: c.redemptions, hint: formatMoney(c.discount_cents) }))"
            empty-message="No redemptions in this period"
          />
        </section>

        <section v-if="platform.reviews" class="card p-4">
          <h2 class="section-title mb-3 text-base">Reviews</h2>
          <div class="mb-3 grid grid-cols-3 gap-3 text-sm">
            <div><p class="text-gray-500 dark:text-gray-400">Average</p><p class="text-lg font-semibold">★ {{ platform.reviews.average_rating || '—' }}</p></div>
            <div><p class="text-gray-500 dark:text-gray-400">Awaiting review</p><p class="text-lg font-semibold">{{ platform.reviews.pending }}</p></div>
            <div><p class="text-gray-500 dark:text-gray-400">Open reports</p><p class="text-lg font-semibold">{{ platform.reviews.open_reports }}</p></div>
          </div>
          <ChartBars
            :items="platform.reviews.distribution.map((d) => ({ label: `${d.rating} star${d.rating === 1 ? '' : 's'}`, value: d.count }))"
            empty-message="No reviews yet"
          />
        </section>

        <section v-if="platform.feedback" class="card p-4">
          <h2 class="section-title mb-3 text-base">Support queue</h2>
          <div class="mb-3 grid grid-cols-3 gap-3 text-sm">
            <div><p class="text-gray-500 dark:text-gray-400">Open</p><p class="text-lg font-semibold">{{ platform.feedback.open }}</p></div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">First reply</p>
              <p class="text-lg font-semibold">{{ formatDuration(platform.feedback.avg_first_response_minutes * 60) }}</p>
            </div>
            <div>
              <p class="text-gray-500 dark:text-gray-400">Resolution</p>
              <p class="text-lg font-semibold">{{ formatDuration(platform.feedback.avg_resolution_minutes * 60) }}</p>
            </div>
          </div>
          <ChartBars
            :items="platform.feedback.by_category.map((c) => ({ label: c.category, value: c.count }))"
            palette
            empty-message="No tickets in this period"
          />
        </section>

        <section class="card p-4">
          <h2 class="section-title mb-3 text-base">Reading activity</h2>
          <ChartBars
            :items="platform.engagement.by_format.map((f) => ({ label: f.format, value: f.readers, hint: `${f.sessions} sessions` }))"
            palette
            empty-message="No reading activity in this period"
          />
          <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
            {{ platform.engagement.new_follows }} new author follows ·
            {{ platform.engagement.library_saves.reduce((sum, s) => sum + s.count, 0) }} library saves
          </p>
        </section>
      </div>
    </template>

    <div v-else-if="loading" class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard v-for="n in 4" :key="n" label="Loading" value="—" loading />
    </div>

    <p v-else class="card p-8 text-center text-sm text-gray-500 dark:text-gray-400">
      No dashboard data is available for your account.
    </p>
  </div>
</template>
