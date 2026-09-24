<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { cms } from '@loikmon/api'
import type { CmsCoupon, CouponScope, CouponStatus, CouponSummary, DiscountType } from '@loikmon/api'
import ChartBars from '@/cms/components/ChartBars.vue'
import ChartLine from '@/cms/components/ChartLine.vue'
import DataTable from '@/cms/components/DataTable.vue'
import FilterBar from '@/cms/components/FilterBar.vue'
import FormField from '@/cms/components/FormField.vue'
import MediaPicker from '@/cms/components/MediaPicker.vue'
import ModalDialog from '@/cms/components/ModalDialog.vue'
import PageHeader from '@/cms/components/PageHeader.vue'
import PagerBar from '@/cms/components/PagerBar.vue'
import StatCard from '@/cms/components/StatCard.vue'
import StatusBadge from '@/cms/components/StatusBadge.vue'
import { downloadCsv, formatDate, formatMoney, formatNumber, fromLocalInput, printSection, toLocalInput, useConfirm } from '@/cms/composables/useCmsUi'
import { useResourceList } from '@/cms/composables/useResourceList'
import { useCmsSessionStore } from '@/cms/stores/session'
import { useToastStore } from '@/cms/stores/toast'

/**
 * Coupon campaigns.
 *
 * What an author sees here is already limited by the server to their own books
 * and articles; the form additionally hides the global and subscription scopes
 * unless the session holds `coupons.global.manage`.
 */
const session = useCmsSessionStore()
const toast = useToastStore()
const { confirm } = useConfirm()

const STATUSES: CouponStatus[] = ['draft', 'active', 'paused', 'expired', 'archived']

const {
  rows, pagination, page, limit, loading, error, filters, load, reset, mutate,
} = useResourceList<CmsCoupon, { q: string; status: CouponStatus | ''; scope: CouponScope | '' }>({
  filters: { q: '', status: '', scope: '' },
  fetcher: async ({ q, status, scope, page: p, limit: l }) => {
    const { data } = await cms.coupons.list({ q: q || undefined, status: status || undefined, scope: scope || undefined, page: p, limit: l })
    return { rows: data.coupons, pagination: data.pagination }
  },
})

const canCreate = computed(() => session.canAny('coupons.create', 'author.coupons.create'))
const canEdit = computed(() => session.canAny('coupons.edit', 'author.coupons.edit'))
const canDelete = computed(() => session.canAny('coupons.delete', 'author.coupons.delete'))
const canGlobal = computed(() => session.can('coupons.global.manage'))
const canAnalyse = computed(() => session.canAny('coupons.analytics', 'author.coupons.analytics'))
const filtersActive = computed(() => Boolean(filters.q || filters.status || filters.scope))

const columns = [
  { key: 'code', label: 'Code', width: '150px' },
  { key: 'name', label: 'Campaign' },
  { key: 'discount', label: 'Discount', width: '110px' },
  { key: 'usage', label: 'Usage', width: '120px' },
  { key: 'window', label: 'Valid', width: '170px', hideOnMobile: true },
  { key: 'status', label: 'Status', width: '110px' },
  { key: 'actions', label: '', align: 'right' as const, width: '190px' },
]

// ── Campaign summary ────────────────────────────────────────────────────────

const summary = ref<CouponSummary | null>(null)
const summaryDays = ref(30)

async function loadSummary() {
  if (!canAnalyse.value) return
  try {
    const { data } = await cms.coupons.summary({ days: summaryDays.value })
    summary.value = data.summary
  } catch {
    summary.value = null // analytics are optional; the table still works
  }
}
watch(summaryDays, () => void loadSummary(), { immediate: true })

// ── Create / edit ───────────────────────────────────────────────────────────

const modal = ref(false)
const saving = ref(false)
const bookOptions = ref<Array<{ id: number; title: string }>>([])
const articleOptions = ref<Array<{ id: number; title: string }>>([])
const planOptions = ref<Array<{ code: string; name: string }>>([])

const form = reactive({
  id: null as number | null,
  code: '',
  name: '',
  description: '',
  banner_key: null as string | null,
  scope: 'book' as CouponScope,
  book_id: null as number | null,
  article_id: null as number | null,
  plan_code: '' as string,
  campaign_type: 'standard',
  discount_type: 'percent' as DiscountType,
  discount_value: 10,
  max_discount_cents: null as number | null,
  min_order_cents: null as number | null,
  usage_limit: null as number | null,
  usage_limit_per_user: 1 as number | null,
  starts_at: '',
  ends_at: '',
  status: 'draft' as CouponStatus,
})

const scopeOptions = computed(() =>
  canGlobal.value
    ? ([
        { value: 'book', label: 'One book' },
        { value: 'article', label: 'One article' },
        { value: 'global', label: 'Platform-wide' },
        { value: 'subscription', label: 'Subscription plan' },
      ] as const)
    : ([
        { value: 'book', label: 'One of my books' },
        { value: 'article', label: 'One of my articles' },
      ] as const),
)

async function loadOptions() {
  const [books, articles, plans] = await Promise.all([
    cms.books.list({ limit: 100, sort: 'title' }).catch(() => null),
    cms.articles.list({ limit: 100, sort: 'title' }).catch(() => null),
    canGlobal.value ? cms.plans.list().catch(() => null) : Promise.resolve(null),
  ])
  bookOptions.value = books?.data.books.map((b) => ({ id: b.id, title: b.title })) ?? []
  articleOptions.value = articles?.data.articles.map((a) => ({ id: a.id, title: a.title })) ?? []
  planOptions.value = plans?.data.plans.map((p) => ({ code: p.code, name: p.name })) ?? []
}

async function open(coupon?: CmsCoupon) {
  Object.assign(form, {
    id: coupon?.id ?? null,
    code: coupon?.code ?? '',
    name: coupon?.name ?? '',
    description: coupon?.description ?? '',
    banner_key: coupon?.banner_key ?? null,
    scope: coupon?.scope ?? 'book',
    book_id: coupon?.book_id ?? null,
    article_id: coupon?.article_id ?? null,
    plan_code: coupon?.plan_code ?? '',
    campaign_type: coupon?.campaign_type ?? 'standard',
    discount_type: coupon?.discount_type ?? 'percent',
    discount_value: coupon?.discount_value ?? 10,
    max_discount_cents: coupon?.max_discount_cents ?? null,
    min_order_cents: coupon?.min_order_cents ?? null,
    usage_limit: coupon?.usage_limit ?? null,
    usage_limit_per_user: coupon?.usage_limit_per_user ?? 1,
    starts_at: toLocalInput(coupon?.starts_at ?? new Date().toISOString()),
    ends_at: toLocalInput(coupon?.ends_at ?? null),
    status: coupon?.status ?? 'draft',
  })
  modal.value = true
  await loadOptions()
  if (!coupon) {
    try {
      const { data } = await cms.coupons.suggestCode()
      form.code = data.code
    } catch {
      form.code = ''
    }
  }
}

async function save() {
  if (!form.name.trim()) {
    toast.failure(new Error('A campaign name is required'), 'Coupon not saved')
    return
  }
  saving.value = true
  const payload = {
    code: form.code || undefined,
    name: form.name,
    description: form.description || null,
    banner_key: form.banner_key,
    scope: form.scope,
    book_id: form.scope === 'book' ? form.book_id : null,
    article_id: form.scope === 'article' ? form.article_id : null,
    plan_code: form.scope === 'subscription' ? form.plan_code || null : null,
    campaign_type: form.campaign_type || 'standard',
    discount_type: form.discount_type,
    discount_value: form.discount_value,
    max_discount_cents: form.max_discount_cents,
    min_order_cents: form.min_order_cents,
    usage_limit: form.usage_limit,
    usage_limit_per_user: form.usage_limit_per_user,
    starts_at: fromLocalInput(form.starts_at),
    ends_at: fromLocalInput(form.ends_at),
    status: form.status,
  }
  const result = await mutate(() => (form.id ? cms.coupons.update(form.id, payload) : cms.coupons.create(payload)), {
    success: form.id ? 'Campaign updated' : 'Campaign created',
  })
  saving.value = false
  if (result) {
    modal.value = false
    void loadSummary()
  }
}

async function setStatus(coupon: CmsCoupon, status: CouponStatus) {
  await mutate(() => cms.coupons.setStatus(coupon.id, status), { success: `${coupon.code} is now ${status}` })
  void loadSummary()
}

async function remove(coupon: CmsCoupon) {
  const redeemed = coupon.used_count > 0
  const ok = await confirm({
    title: redeemed ? 'Archive this campaign?' : 'Delete this campaign?',
    message: redeemed
      ? `${coupon.code} has ${coupon.used_count} redemptions, so it is archived instead of deleted — the history stays auditable.`
      : `${coupon.code} will be removed permanently.`,
    confirmLabel: redeemed ? 'Archive' : 'Delete',
    danger: !redeemed,
  })
  if (!ok) return
  await mutate(() => cms.coupons.remove(coupon.id), { success: redeemed ? 'Campaign archived' : 'Campaign deleted' })
}

function discountLabel(coupon: CmsCoupon): string {
  return coupon.discount_type === 'percent'
    ? `${coupon.discount_value}%`
    : formatMoney(coupon.discount_value, coupon.currency)
}

function exportCsv() {
  downloadCsv(
    'coupon-campaigns.csv',
    [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Campaign' },
      { key: 'scope', label: 'Scope' },
      { key: 'campaign_type', label: 'Type' },
      { key: 'discount', label: 'Discount', value: (row: CmsCoupon) => discountLabel(row) },
      { key: 'used_count', label: 'Redemptions' },
      { key: 'usage_limit', label: 'Limit' },
      { key: 'starts_at', label: 'Starts' },
      { key: 'ends_at', label: 'Ends' },
      { key: 'status', label: 'Status' },
      { key: 'author_name', label: 'Author' },
      { key: 'target', label: 'Applies to', value: (row: CmsCoupon) => row.book_title ?? row.article_title ?? row.plan_code ?? 'Everything' },
    ],
    rows.value,
  )
}
</script>

<template>
  <div>
    <PageHeader
      title="Coupons"
      :description="session.isOwnScope ? 'Discount campaigns for your own books and articles.' : 'Platform, subscription and per-item discount campaigns.'"
      :count="pagination?.total ?? null"
    >
      <template #actions>
        <button type="button" class="btn-secondary h-9" :disabled="!rows.length" @click="exportCsv">Export CSV</button>
        <button type="button" class="btn-secondary h-9" :disabled="!rows.length" @click="printSection('coupon-print')">
          Print / PDF
        </button>
        <button v-if="canCreate" type="button" class="btn-primary h-9" @click="open()">New campaign</button>
      </template>
    </PageHeader>

    <!-- Performance overview -->
    <section v-if="canAnalyse && summary" class="mb-5">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Redemptions" :value="formatNumber(summary.redemptions)" :hint="`last ${summaryDays} days`" />
        <StatCard label="Discount given" :value="formatMoney(summary.discount_cents)" />
        <StatCard label="Gross value" :value="formatMoney(summary.gross_cents)" hint="orders that used a coupon" />
        <StatCard label="Active campaigns" :value="`${summary.active} / ${summary.coupons}`" />
      </div>

      <div class="mt-3 grid gap-4 lg:grid-cols-2">
        <div class="card p-4">
          <h2 class="section-title mb-3 text-base">Redemptions over time</h2>
          <ChartLine
            :points="summary.daily.map((d) => ({ date: d.date, value: d.redemptions }))"
            label="Redemptions per day"
            :height="150"
            :format="formatNumber"
          />
        </div>
        <div class="card p-4">
          <h2 class="section-title mb-3 text-base">Top campaigns</h2>
          <ChartBars
            :items="summary.top.map((t) => ({ label: t.code, value: t.redemptions, hint: formatMoney(t.discount_cents) }))"
            empty-message="No redemptions in this period"
          />
        </div>
      </div>
    </section>

    <FilterBar v-model:search="filters.q" placeholder="Search code or campaign name…" :active="filtersActive" @clear="reset">
      <template #filters>
        <select v-model="filters.status" class="input h-9 w-auto" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option v-for="status in STATUSES" :key="status" :value="status">{{ status }}</option>
        </select>
        <select v-model="filters.scope" class="input h-9 w-auto" aria-label="Filter by scope">
          <option value="">All scopes</option>
          <option value="book">Book</option>
          <option value="article">Article</option>
          <option v-if="canGlobal" value="global">Platform-wide</option>
          <option v-if="canGlobal" value="subscription">Subscription</option>
        </select>
        <select v-model="summaryDays" class="input h-9 w-auto" aria-label="Analytics period">
          <option :value="7">7 days</option>
          <option :value="30">30 days</option>
          <option :value="90">90 days</option>
        </select>
      </template>
    </FilterBar>

    <div id="coupon-print">
      <DataTable
        :rows="rows"
        :columns="columns"
        :loading="loading"
        :error="error"
        :dimmed="(row: CmsCoupon) => row.status === 'archived' || row.status === 'expired'"
        empty-title="No campaigns yet"
        empty-message="Create a campaign to offer a discount on a book, an article or a subscription."
        @retry="load"
      >
        <template #cell-code="{ row }">
          <code class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-semibold dark:bg-gray-800">{{ row.code }}</code>
        </template>

        <template #cell-name="{ row }">
          <RouterLink :to="{ name: 'cms-coupon-detail', params: { id: row.id } }" class="font-medium no-underline hover:underline">
            {{ row.name }}
          </RouterLink>
          <p class="truncate text-xs text-gray-500 dark:text-gray-400">
            <span class="capitalize">{{ row.scope }}</span>
            <template v-if="row.book_title"> · {{ row.book_title }}</template>
            <template v-else-if="row.article_title"> · {{ row.article_title }}</template>
            <template v-else-if="row.plan_code"> · {{ row.plan_code }}</template>
            <template v-if="row.author_name"> · {{ row.author_name }}</template>
          </p>
        </template>

        <template #cell-discount="{ row }">
          <span class="font-medium">{{ discountLabel(row) }}</span>
          <p v-if="row.max_discount_cents" class="text-xs text-gray-500">max {{ formatMoney(row.max_discount_cents, row.currency) }}</p>
        </template>

        <template #cell-usage="{ row }">
          <span class="tabular-nums">{{ row.used_count }}<template v-if="row.usage_limit"> / {{ row.usage_limit }}</template></span>
          <div v-if="row.usage_limit" class="mt-1 h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div class="h-full bg-brand-500" :style="{ width: `${Math.min(100, (row.used_count / row.usage_limit) * 100)}%` }" />
          </div>
        </template>

        <template #cell-window="{ row }">
          <span class="text-xs">{{ formatDate(row.starts_at) }} → {{ row.ends_at ? formatDate(row.ends_at) : 'no end' }}</span>
        </template>

        <template #cell-status="{ row }"><StatusBadge :status="row.status" /></template>

        <template #cell-actions="{ row }">
          <div class="flex items-center justify-end gap-1">
            <button
              v-if="canEdit && row.status === 'draft'"
              type="button"
              class="btn-ghost h-7 px-2 text-xs"
              @click="setStatus(row, 'active')"
            >
              Activate
            </button>
            <button
              v-else-if="canEdit && row.status === 'active'"
              type="button"
              class="btn-ghost h-7 px-2 text-xs"
              @click="setStatus(row, 'paused')"
            >
              Pause
            </button>
            <button
              v-else-if="canEdit && row.status === 'paused'"
              type="button"
              class="btn-ghost h-7 px-2 text-xs"
              @click="setStatus(row, 'active')"
            >
              Resume
            </button>
            <RouterLink
              :to="{ name: 'cms-coupon-detail', params: { id: row.id } }"
              class="btn-ghost h-7 px-2 text-xs no-underline"
            >
              Details
            </RouterLink>
            <button v-if="canEdit" type="button" class="btn-ghost h-7 px-2 text-xs" @click="open(row)">Edit</button>
            <button v-if="canDelete" type="button" class="btn-ghost h-7 px-2 text-xs text-red-600" @click="remove(row)">
              {{ row.used_count ? 'Archive' : 'Delete' }}
            </button>
          </div>
        </template>

        <template #empty-action>
          <button v-if="canCreate" type="button" class="btn-primary" @click="open()">New campaign</button>
        </template>
      </DataTable>
    </div>

    <PagerBar
      :pagination="pagination"
      :limit="limit"
      :loading="loading"
      @update:page="page = $event"
      @update:limit="limit = $event"
    />

    <!-- Campaign editor -->
    <ModalDialog
      :open="modal"
      size="lg"
      :title="form.id ? `Edit ${form.code}` : 'New campaign'"
      :busy="saving"
      @close="modal = false"
      @submit="save"
    >
      <div class="grid gap-4 md:grid-cols-2">
        <FormField v-slot="{ id }" label="Campaign name" required>
          <input :id="id" v-model="form.name" type="text" class="input" maxlength="160" required />
        </FormField>

        <FormField v-slot="{ id }" label="Code" :help="form.id ? 'The code cannot change once the campaign exists.' : 'Shown to readers. Letters and digits only.'">
          <input
            :id="id"
            v-model="form.code"
            type="text"
            class="input font-mono uppercase"
            maxlength="48"
            :disabled="Boolean(form.id)"
          />
        </FormField>

        <FormField v-slot="{ id }" label="Applies to" required>
          <select :id="id" v-model="form.scope" class="input">
            <option v-for="option in scopeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </FormField>

        <FormField v-if="form.scope === 'book'" v-slot="{ id }" label="Book" required>
          <select :id="id" v-model.number="form.book_id" class="input" required>
            <option :value="null">Select a book…</option>
            <option v-for="book in bookOptions" :key="book.id" :value="book.id">{{ book.title }}</option>
          </select>
        </FormField>

        <FormField v-else-if="form.scope === 'article'" v-slot="{ id }" label="Article" required>
          <select :id="id" v-model.number="form.article_id" class="input" required>
            <option :value="null">Select an article…</option>
            <option v-for="article in articleOptions" :key="article.id" :value="article.id">{{ article.title }}</option>
          </select>
        </FormField>

        <FormField v-else-if="form.scope === 'subscription'" v-slot="{ id }" label="Plan" help="Leave empty to apply to every plan.">
          <select :id="id" v-model="form.plan_code" class="input">
            <option value="">All plans</option>
            <option v-for="plan in planOptions" :key="plan.code" :value="plan.code">{{ plan.name }}</option>
          </select>
        </FormField>

        <FormField v-else v-slot="{ id }" label="Campaign type" help="A label for grouping and reporting.">
          <input :id="id" v-model="form.campaign_type" type="text" class="input" maxlength="48" />
        </FormField>

        <FormField v-slot="{ id }" label="Discount type" required>
          <select :id="id" v-model="form.discount_type" class="input">
            <option value="percent">Percentage</option>
            <option value="fixed">Fixed amount</option>
          </select>
        </FormField>

        <FormField
          v-slot="{ id }"
          :label="form.discount_type === 'percent' ? 'Percentage off' : 'Amount off (cents)'"
          required
          :help="form.discount_type === 'percent' ? '1–100' : 'In minor units, e.g. 250 = $2.50'"
        >
          <input
            :id="id"
            v-model.number="form.discount_value"
            type="number"
            class="input"
            :min="1"
            :max="form.discount_type === 'percent' ? 100 : undefined"
            required
          />
        </FormField>

        <FormField v-if="form.discount_type === 'percent'" v-slot="{ id }" label="Maximum discount (cents)" help="Optional cap.">
          <input :id="id" v-model.number="form.max_discount_cents" type="number" min="0" class="input" />
        </FormField>

        <FormField v-slot="{ id }" label="Minimum order (cents)" help="Optional threshold.">
          <input :id="id" v-model.number="form.min_order_cents" type="number" min="0" class="input" />
        </FormField>

        <FormField v-slot="{ id }" label="Total redemptions" help="Leave empty for unlimited.">
          <input :id="id" v-model.number="form.usage_limit" type="number" min="1" class="input" />
        </FormField>

        <FormField v-slot="{ id }" label="Per reader" help="How many times one reader may use it.">
          <input :id="id" v-model.number="form.usage_limit_per_user" type="number" min="1" class="input" />
        </FormField>

        <FormField v-slot="{ id }" label="Starts" required>
          <input :id="id" v-model="form.starts_at" type="datetime-local" class="input" required />
        </FormField>

        <FormField v-slot="{ id }" label="Ends" help="Leave empty to run indefinitely.">
          <input :id="id" v-model="form.ends_at" type="datetime-local" class="input" />
        </FormField>

        <FormField v-slot="{ id }" label="Status">
          <select :id="id" v-model="form.status" class="input">
            <option value="draft">Draft — not redeemable yet</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </FormField>

        <FormField v-slot="{ id }" label="Description" class="md:col-span-2">
          <textarea :id="id" v-model="form.description" rows="2" class="input resize-y" maxlength="500" />
        </FormField>

        <MediaPicker v-model="form.banner_key" asset-type="coupon_banner" label="Campaign banner" class="md:col-span-2" />
      </div>

      <template #footer>
        <button type="button" class="btn-secondary" @click="modal = false">Cancel</button>
        <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save campaign' }}</button>
      </template>
    </ModalDialog>
  </div>
</template>
