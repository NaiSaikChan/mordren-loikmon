<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { cms } from '@loikmon/api'
import type { CmsCouponDetail, CouponPerformance } from '@loikmon/api'
import ChartLine from '@/cms/components/ChartLine.vue'
import PageHeader from '@/cms/components/PageHeader.vue'
import StatCard from '@/cms/components/StatCard.vue'
import StatusBadge from '@/cms/components/StatusBadge.vue'
import { downloadCsv, formatDate, formatMoney, formatNumber, printSection } from '@/cms/composables/useCmsUi'
import { useCmsSessionStore } from '@/cms/stores/session'
import { useToastStore } from '@/cms/stores/toast'

/**
 * One campaign: its terms, its redemption history and a printable voucher.
 *
 * "Print / PDF" prints the voucher card through the browser, which also offers
 * "Save as PDF" — no PDF library in the bundle.
 */
const props = defineProps<{ id: string }>()

const router = useRouter()
const session = useCmsSessionStore()
const toast = useToastStore()

const couponId = computed(() => Number(props.id))
const coupon = ref<CmsCouponDetail | null>(null)
const performance = ref<CouponPerformance | null>(null)
const loading = ref(true)
const days = ref(30)

const canAnalyse = computed(() => session.canAny('coupons.analytics', 'author.coupons.analytics'))

async function load() {
  loading.value = true
  try {
    const { data } = await cms.coupons.get(couponId.value)
    coupon.value = data.coupon
    if (canAnalyse.value) {
      const result = await cms.coupons.performance(couponId.value, { days: days.value })
      performance.value = result.data.performance
    }
  } catch (err) {
    toast.failure(err, 'Could not open this campaign')
    void router.push({ name: 'cms-coupons' })
  } finally {
    loading.value = false
  }
}

watch([couponId, days], () => void load(), { immediate: true })

const discountLabel = computed(() => {
  if (!coupon.value) return ''
  return coupon.value.discount_type === 'percent'
    ? `${coupon.value.discount_value}% off`
    : `${formatMoney(coupon.value.discount_value, coupon.value.currency)} off`
})

const target = computed(
  () => coupon.value?.book_title ?? coupon.value?.article_title ?? coupon.value?.plan_code ?? 'the whole catalogue',
)

/** Conversion: redemptions per unique reader who used the code. */
const conversion = computed(() => {
  if (!performance.value || !performance.value.unique_users) return null
  return Math.round((performance.value.redemptions / performance.value.unique_users) * 100) / 100
})

function exportRedemptions() {
  if (!coupon.value) return
  downloadCsv(
    `${coupon.value.code}-redemptions.csv`,
    [
      { key: 'created_at', label: 'Date' },
      { key: 'user_email', label: 'Reader' },
      { key: 'item_type', label: 'Item type' },
      { key: 'item_id', label: 'Item id' },
      { key: 'gross_cents', label: 'Gross (cents)' },
      { key: 'discount_cents', label: 'Discount (cents)' },
      { key: 'currency', label: 'Currency' },
    ],
    coupon.value.redemptions,
  )
}
</script>

<template>
  <div>
    <PageHeader :title="coupon?.name ?? 'Campaign'" :description="coupon ? `${discountLabel} on ${target}` : ''">
      <template #actions>
        <RouterLink :to="{ name: 'cms-coupons' }" class="btn-ghost h-9 no-underline">← All campaigns</RouterLink>
        <select v-model="days" class="input h-9 w-auto" aria-label="Analytics period">
          <option :value="7">7 days</option>
          <option :value="30">30 days</option>
          <option :value="90">90 days</option>
        </select>
        <button type="button" class="btn-secondary h-9" @click="printSection('voucher')">Print / PDF</button>
        <button type="button" class="btn-secondary h-9" :disabled="!coupon?.redemptions.length" @click="exportRedemptions">
          Export
        </button>
      </template>
    </PageHeader>

    <div v-if="loading" class="space-y-3">
      <div class="skeleton h-28 w-full" />
      <div class="skeleton h-64 w-full" />
    </div>

    <template v-else-if="coupon">
      <!-- Printable voucher -->
      <div id="voucher" class="mb-5">
        <div class="mx-auto max-w-xl rounded-2xl border-2 border-dashed border-brand-400 bg-white p-6 text-center dark:bg-surface-900">
          <p class="text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">Loikmon</p>
          <p class="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{{ discountLabel }}</p>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{{ coupon.name }}</p>
          <p class="my-4 inline-block rounded-lg bg-gray-900 px-6 py-3 font-mono text-2xl font-bold tracking-[0.2em] text-white">
            {{ coupon.code }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Valid {{ formatDate(coupon.starts_at) }}
            <template v-if="coupon.ends_at"> – {{ formatDate(coupon.ends_at) }}</template>
            <template v-else> onwards</template>
          </p>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Applies to {{ target }}<template v-if="coupon.min_order_cents"> · minimum {{ formatMoney(coupon.min_order_cents, coupon.currency) }}</template>
            <template v-if="coupon.usage_limit_per_user"> · {{ coupon.usage_limit_per_user }} use per reader</template>
          </p>
        </div>
      </div>

      <div class="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge :status="coupon.status" />
        <span class="badge-gray capitalize">{{ coupon.scope }}</span>
        <span class="badge-gray">{{ coupon.campaign_type }}</span>
        <span v-if="coupon.author_name" class="text-xs text-gray-500 dark:text-gray-400">by {{ coupon.author_name }}</span>
      </div>

      <div v-if="performance" class="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Redemptions" :value="formatNumber(performance.redemptions)" />
        <StatCard label="Unique readers" :value="formatNumber(performance.unique_users)" />
        <StatCard label="Discount given" :value="formatMoney(performance.discount_cents, coupon.currency)" />
        <StatCard label="Net revenue" :value="formatMoney(performance.net_cents, coupon.currency)" hint="after discount" />
        <StatCard
          label="Redemption rate"
          :value="performance.redemption_rate === null ? 'Unlimited' : `${performance.redemption_rate}%`"
          :hint="conversion ? `${conversion} uses per reader` : undefined"
        />
      </div>

      <div v-if="performance" class="card mt-4 p-4">
        <h2 class="section-title mb-3 text-base">Redemptions over time</h2>
        <ChartLine
          :points="performance.daily.map((d) => ({ date: d.date, value: d.redemptions }))"
          label="Redemptions per day"
          :format="formatNumber"
        />
      </div>

      <section class="mt-4">
        <h2 class="section-title mb-3 text-base">Recent redemptions</h2>
        <div class="card overflow-x-auto">
          <table v-if="coupon.redemptions.length" class="w-full text-sm">
            <thead class="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800">
              <tr>
                <th scope="col" class="px-3 py-2 text-left">When</th>
                <th scope="col" class="px-3 py-2 text-left">Reader</th>
                <th scope="col" class="px-3 py-2 text-left">Item</th>
                <th scope="col" class="px-3 py-2 text-right">Gross</th>
                <th scope="col" class="px-3 py-2 text-right">Discount</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
              <tr v-for="redemption in coupon.redemptions" :key="redemption.id">
                <td class="px-3 py-2">{{ formatDate(redemption.created_at, true) }}</td>
                <td class="px-3 py-2">{{ redemption.user_email ?? 'Guest' }}</td>
                <td class="px-3 py-2 capitalize">{{ redemption.item_type }}<template v-if="redemption.item_id"> #{{ redemption.item_id }}</template></td>
                <td class="px-3 py-2 text-right tabular-nums">{{ formatMoney(redemption.gross_cents, redemption.currency) }}</td>
                <td class="px-3 py-2 text-right tabular-nums text-green-600 dark:text-green-400">
                  −{{ formatMoney(redemption.discount_cents, redemption.currency) }}
                </td>
              </tr>
            </tbody>
          </table>
          <p v-else class="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            This campaign has not been redeemed yet.
          </p>
        </div>
      </section>
    </template>
  </div>
</template>
