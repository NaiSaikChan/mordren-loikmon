<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { cms } from '@loikmon/api'
import type { CmsPlan, CmsSubscriptionRow } from '@loikmon/api'
import DataTable from '@/cms/components/DataTable.vue'
import FilterBar from '@/cms/components/FilterBar.vue'
import FormField from '@/cms/components/FormField.vue'
import MediaPicker from '@/cms/components/MediaPicker.vue'
import ModalDialog from '@/cms/components/ModalDialog.vue'
import PageHeader from '@/cms/components/PageHeader.vue'
import PagerBar from '@/cms/components/PagerBar.vue'
import StatusBadge from '@/cms/components/StatusBadge.vue'
import { downloadCsv, formatDate, formatMoney } from '@/cms/composables/useCmsUi'
import { useResourceList } from '@/cms/composables/useResourceList'
import { useCmsSessionStore } from '@/cms/stores/session'
import { useToastStore } from '@/cms/stores/toast'

/**
 * Membership plans and the subscriptions bought against them.
 *
 * Purchases happen inside the App Store and Google Play, so nothing here
 * charges anyone: the price is the list price shown before the store takes
 * over, and the store product ids are what the apps ask the store for.
 */
const session = useCmsSessionStore()
const toast = useToastStore()

const plans = ref<CmsPlan[]>([])
const plansLoading = ref(true)

const canManagePlans = computed(() => session.can('plans.manage'))
const canManageSubscriptions = computed(() => session.can('subscriptions.manage'))

async function loadPlans() {
  plansLoading.value = true
  try {
    const { data } = await cms.plans.list()
    plans.value = data.plans
  } catch (err) {
    toast.failure(err, 'Could not load the plans')
  } finally {
    plansLoading.value = false
  }
}
void loadPlans()

// ── Plan editor ─────────────────────────────────────────────────────────────

const modal = ref(false)
const saving = ref(false)
const form = reactive({
  code: '',
  name: '',
  description: '',
  image_key: null as string | null,
  price_cents: 0,
  apple_product_id: '',
  google_product_id: '',
  google_base_plan_id: '',
  display_order: 0,
  is_active: true,
})

function open(plan: CmsPlan) {
  Object.assign(form, {
    code: plan.code,
    name: plan.name,
    description: plan.description ?? '',
    image_key: plan.image_key ?? null,
    price_cents: plan.price_cents,
    apple_product_id: plan.apple_product_id ?? '',
    google_product_id: plan.google_product_id ?? '',
    google_base_plan_id: plan.google_base_plan_id ?? '',
    display_order: 0,
    is_active: true,
  })
  modal.value = true
}

async function savePlan() {
  saving.value = true
  try {
    await cms.plans.update(form.code, {
      name: form.name,
      description: form.description || null,
      image_key: form.image_key,
      price_cents: form.price_cents,
      apple_product_id: form.apple_product_id || null,
      google_product_id: form.google_product_id || null,
      google_base_plan_id: form.google_base_plan_id || null,
      is_active: form.is_active,
    })
    modal.value = false
    await loadPlans()
    toast.success('Plan updated')
  } catch (err) {
    toast.failure(err, 'Could not update the plan')
  } finally {
    saving.value = false
  }
}

// ── Subscriptions ───────────────────────────────────────────────────────────

const { rows, pagination, page, limit, loading, error, filters, load, reset } = useResourceList<
  CmsSubscriptionRow & { id: string },
  { status: string; platform: string; plan_code: string }
>({
  filters: { status: '', platform: '', plan_code: '' },
  fetcher: async ({ status, platform, plan_code, page: p, limit: l }) => {
    const { data } = await cms.subscriptions.list({
      status: status || undefined,
      platform: platform || undefined,
      plan_code: plan_code || undefined,
      page: p,
      limit: l,
    })
    return {
      rows: data.subscriptions,
      pagination: {
        page: data.pagination.page,
        limit: data.pagination.limit,
        total: data.pagination.total,
        total_pages: Math.max(1, Math.ceil(data.pagination.total / data.pagination.limit)),
        has_more: data.pagination.page * data.pagination.limit < data.pagination.total,
      },
    }
  },
})

const filtersActive = computed(() => Boolean(filters.status || filters.platform || filters.plan_code))

const columns = [
  { key: 'user_email', label: 'Account' },
  { key: 'plan_code', label: 'Plan', width: '110px' },
  { key: 'platform', label: 'Store', width: '120px', hideOnMobile: true },
  { key: 'status', label: 'Status', width: '120px' },
  { key: 'expires_at', label: 'Renews / ends', width: '140px', hideOnMobile: true },
  { key: 'environment', label: 'Env', width: '90px', hideOnMobile: true },
]

const reconciling = ref(false)

async function reconcile() {
  reconciling.value = true
  try {
    const { data } = await cms.subscriptions.reconcile()
    await load()
    toast.success('Reconciliation finished', `checked ${data.checked ?? 0}, updated ${data.updated ?? 0}`)
  } catch (err) {
    toast.failure(err, 'Reconciliation failed')
  } finally {
    reconciling.value = false
  }
}

function exportCsv() {
  downloadCsv(
    'subscriptions.csv',
    [
      { key: 'id', label: 'ID' },
      { key: 'user_email', label: 'Account' },
      { key: 'plan_code', label: 'Plan' },
      { key: 'platform', label: 'Store' },
      { key: 'status', label: 'Status' },
      { key: 'started_at', label: 'Started' },
      { key: 'expires_at', label: 'Expires' },
      { key: 'environment', label: 'Environment' },
    ],
    rows.value,
  )
}

const STORE_LABELS: Record<string, string> = { app_store: 'App Store', google_play: 'Google Play', manual: 'Manual' }
</script>

<template>
  <div>
    <PageHeader title="Membership" description="Plans, store product ids and live subscriptions.">
      <template #actions>
        <button type="button" class="btn-secondary h-9" :disabled="!rows.length" @click="exportCsv">Export</button>
        <button
          v-if="canManageSubscriptions"
          type="button"
          class="btn-secondary h-9"
          :disabled="reconciling"
          title="Re-check every subscription against Apple and Google"
          @click="reconcile"
        >
          {{ reconciling ? 'Reconciling…' : 'Reconcile with stores' }}
        </button>
      </template>
    </PageHeader>

    <!-- Plans -->
    <section class="mb-6">
      <h2 class="section-title mb-3 text-base">Plans</h2>

      <div v-if="plansLoading" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="n in 4" :key="n" class="skeleton h-40 w-full" />
      </div>

      <ul v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <li v-for="plan in plans" :key="plan.code" class="card p-4">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <h3 class="truncate text-sm font-semibold text-gray-900 dark:text-white">{{ plan.name }}</h3>
              <code class="text-xs text-gray-500 dark:text-gray-400">{{ plan.code }}</code>
            </div>
            <span v-if="plan.savings_percent > 0" class="badge-green shrink-0">save {{ plan.savings_percent }}%</span>
          </div>

          <p class="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
            {{ formatMoney(plan.price_cents, plan.currency) }}
            <span class="text-sm font-normal text-gray-500">/ {{ plan.period_months }}mo</span>
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ formatMoney(plan.monthly_price_cents, plan.currency) }} per month
          </p>

          <dl class="mt-3 space-y-1 text-xs">
            <div class="flex gap-2">
              <dt class="shrink-0 text-gray-500 dark:text-gray-400">Apple</dt>
              <dd class="min-w-0 flex-1 truncate font-mono" :title="plan.apple_product_id ?? ''">{{ plan.apple_product_id ?? '—' }}</dd>
            </div>
            <div class="flex gap-2">
              <dt class="shrink-0 text-gray-500 dark:text-gray-400">Google</dt>
              <dd class="min-w-0 flex-1 truncate font-mono" :title="plan.google_product_id ?? ''">
                {{ plan.google_product_id ?? '—' }}<template v-if="plan.google_base_plan_id">:{{ plan.google_base_plan_id }}</template>
              </dd>
            </div>
          </dl>

          <button v-if="canManagePlans" type="button" class="btn-secondary mt-3 h-8 w-full text-xs" @click="open(plan)">
            Edit plan
          </button>
        </li>
      </ul>
    </section>

    <!-- Subscriptions -->
    <section>
      <h2 class="section-title mb-3 text-base">Subscriptions</h2>

      <FilterBar :active="filtersActive" :selected-count="0" @clear="reset">
        <template #filters>
          <select v-model="filters.status" class="input h-9 w-auto" aria-label="Filter by status">
            <option value="">All statuses</option>
            <option v-for="status in ['active', 'grace_period', 'billing_retry', 'canceled', 'expired', 'paused', 'pending', 'revoked']" :key="status" :value="status">
              {{ status.replace('_', ' ') }}
            </option>
          </select>
          <select v-model="filters.platform" class="input h-9 w-auto" aria-label="Filter by store">
            <option value="">All stores</option>
            <option value="app_store">App Store</option>
            <option value="google_play">Google Play</option>
            <option value="manual">Manual</option>
          </select>
          <select v-model="filters.plan_code" class="input h-9 w-auto" aria-label="Filter by plan">
            <option value="">All plans</option>
            <option v-for="plan in plans" :key="plan.code" :value="plan.code">{{ plan.name }}</option>
          </select>
        </template>
      </FilterBar>

      <DataTable
        :rows="rows"
        :columns="columns"
        :loading="loading"
        :error="error"
        :dimmed="(row: CmsSubscriptionRow) => row.status === 'expired' || row.status === 'revoked'"
        empty-title="No subscriptions"
        empty-message="Purchases made in the apps appear here once verified."
        @retry="load"
      >
        <template #cell-user_email="{ row }">
          <p class="truncate text-sm">{{ row.user_email ?? row.user_id }}</p>
          <p class="truncate font-mono text-xs text-gray-500 dark:text-gray-400">{{ row.product_id ?? '—' }}</p>
        </template>

        <template #cell-plan_code="{ row }">
          <span class="badge-gray">{{ row.plan_code ?? 'unknown' }}</span>
        </template>

        <template #cell-platform="{ row }">{{ STORE_LABELS[row.platform] ?? row.platform }}</template>
        <template #cell-status="{ row }"><StatusBadge :status="row.status" /></template>

        <template #cell-expires_at="{ row }">
          <span class="text-xs">{{ formatDate(row.expires_at) }}</span>
          <p v-if="row.auto_renew" class="text-xs text-green-600 dark:text-green-400">auto-renews</p>
        </template>

        <template #cell-environment="{ row }">
          <span :class="row.environment === 'sandbox' ? 'badge-yellow' : 'badge-gray'">{{ row.environment }}</span>
        </template>
      </DataTable>

      <PagerBar
        :pagination="pagination"
        :limit="limit"
        :loading="loading"
        @update:page="page = $event"
        @update:limit="limit = $event"
      />
    </section>

    <!-- Plan editor -->
    <ModalDialog :open="modal" :title="`Edit ${form.name}`" :busy="saving" @close="modal = false" @submit="savePlan">
      <div class="space-y-4">
        <FormField v-slot="{ id }" label="Name" required>
          <input :id="id" v-model="form.name" type="text" class="input" maxlength="64" required />
        </FormField>

        <FormField v-slot="{ id }" label="Description">
          <input :id="id" v-model="form.description" type="text" class="input" maxlength="255" />
        </FormField>

        <MediaPicker v-model="form.image_key" asset-type="membership_plan" label="Plan image" />

        <FormField
          v-slot="{ id }"
          label="Price (cents)"
          help="The list price shown before the store takes over. The store's own price is what a reader actually pays."
        >
          <input :id="id" v-model.number="form.price_cents" type="number" min="0" class="input" />
        </FormField>

        <FormField v-slot="{ id }" label="Apple product id" help="An auto-renewable product in the App Store subscription group.">
          <input :id="id" v-model="form.apple_product_id" type="text" class="input font-mono text-xs" maxlength="128" />
        </FormField>

        <div class="grid grid-cols-2 gap-3">
          <FormField v-slot="{ id }" label="Google product id">
            <input :id="id" v-model="form.google_product_id" type="text" class="input font-mono text-xs" maxlength="128" />
          </FormField>
          <FormField v-slot="{ id }" label="Base plan id">
            <input :id="id" v-model="form.google_base_plan_id" type="text" class="input font-mono text-xs" maxlength="64" />
          </FormField>
        </div>

        <label class="flex items-center gap-2 text-sm">
          <input v-model="form.is_active" type="checkbox" class="rounded text-brand-600" />
          Offered to new subscribers
        </label>
      </div>

      <template #footer>
        <button type="button" class="btn-secondary" @click="modal = false">Cancel</button>
        <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save plan' }}</button>
      </template>
    </ModalDialog>
  </div>
</template>
