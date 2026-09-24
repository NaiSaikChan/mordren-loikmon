<script setup lang="ts">
import { computed, ref } from 'vue'
import { cms } from '@loikmon/api'
import type { AuditLogEntry } from '@loikmon/api'
import DataTable from '@/cms/components/DataTable.vue'
import FilterBar from '@/cms/components/FilterBar.vue'
import ModalDialog from '@/cms/components/ModalDialog.vue'
import PageHeader from '@/cms/components/PageHeader.vue'
import PagerBar from '@/cms/components/PagerBar.vue'
import { downloadCsv, formatDate, formatRelative } from '@/cms/composables/useCmsUi'
import { useResourceList } from '@/cms/composables/useResourceList'

/**
 * Activity log: who did what, to which record, and what changed.
 *
 * Entries are append-only and never edited from the UI — that is the point of
 * an audit trail.
 */
const actions = ref<string[]>([])

const { rows, pagination, page, limit, loading, error, filters, load, reset } = useResourceList<
  AuditLogEntry,
  { action: string; entity_type: string; actor_id: string; from: string; to: string }
>({
  filters: { action: '', entity_type: '', actor_id: '', from: '', to: '' },
  fetcher: async ({ action, entity_type, actor_id, from, to, page: p, limit: l }) => {
    const { data } = await cms.audit.list({
      action: action || undefined,
      entity_type: entity_type || undefined,
      actor_id: actor_id || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
      page: p,
      limit: l,
    })
    actions.value = data.actions
    return { rows: data.logs, pagination: data.pagination }
  },
})

const filtersActive = computed(() => Boolean(filters.action || filters.entity_type || filters.actor_id || filters.from || filters.to))

const columns = [
  { key: 'created_at', label: 'When', width: '150px' },
  { key: 'actor_email', label: 'Who', width: '200px' },
  { key: 'action', label: 'Action', width: '140px' },
  { key: 'summary', label: 'What' },
  { key: 'details', label: '', align: 'right' as const, width: '90px' },
]

const ENTITY_TYPES = [
  'book',
  'article',
  'chapter',
  'author',
  'category',
  'collection',
  'slider',
  'coupon',
  'review',
  'review_report',
  'ticket',
  'policy',
  'settings',
  'user',
  'role',
  'plan',
  'subscription',
  'entitlement_grant',
  'media',
]

const selected = ref<AuditLogEntry | null>(null)

/** Before/after as an aligned list of the fields that actually changed. */
const changes = computed(() => {
  const entry = selected.value
  if (!entry) return []
  const before = (entry.before_data ?? {}) as Record<string, unknown>
  const after = (entry.after_data ?? {}) as Record<string, unknown>
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
  return keys.map((key) => ({ key, before: before[key], after: after[key] }))
})

const show = (value: unknown) => {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function exportCsv() {
  downloadCsv(
    'activity-log.csv',
    [
      { key: 'created_at', label: 'When' },
      { key: 'actor_email', label: 'Actor' },
      { key: 'actor_role', label: 'Role' },
      { key: 'action', label: 'Action' },
      { key: 'entity_type', label: 'Entity' },
      { key: 'entity_id', label: 'Entity id' },
      { key: 'summary', label: 'Summary' },
      { key: 'ip', label: 'IP' },
    ],
    rows.value,
  )
}
</script>

<template>
  <div>
    <PageHeader
      title="Activity log"
      description="Every change to access, money and published content, with the values before and after."
      :count="pagination?.total ?? null"
    >
      <template #actions>
        <button type="button" class="btn-secondary h-9" :disabled="!rows.length" @click="exportCsv">Export</button>
      </template>
    </PageHeader>

    <FilterBar :active="filtersActive" @clear="reset">
      <template #filters>
        <select v-model="filters.action" class="input h-9 w-auto" aria-label="Filter by action">
          <option value="">All actions</option>
          <option v-for="action in actions" :key="action" :value="action">{{ action }}</option>
        </select>
        <select v-model="filters.entity_type" class="input h-9 w-auto" aria-label="Filter by entity">
          <option value="">All entities</option>
          <option v-for="entity in ENTITY_TYPES" :key="entity" :value="entity">{{ entity }}</option>
        </select>
        <label class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          From
          <input v-model="filters.from" type="date" class="input h-9 w-auto" aria-label="From date" />
        </label>
        <label class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          To
          <input v-model="filters.to" type="date" class="input h-9 w-auto" aria-label="To date" />
        </label>
      </template>
    </FilterBar>

    <DataTable
      :rows="rows"
      :columns="columns"
      :loading="loading"
      :error="error"
      empty-title="No activity recorded"
      empty-message="Actions taken in the CMS will be listed here."
      @retry="load"
    >
      <template #cell-created_at="{ row }">
        <span :title="formatDate(row.created_at, true)" class="text-xs">{{ formatRelative(row.created_at) }}</span>
      </template>

      <template #cell-actor_email="{ row }">
        <p class="truncate text-sm">{{ row.actor_email ?? 'System' }}</p>
        <p v-if="row.actor_role" class="text-xs text-gray-500 dark:text-gray-400">{{ row.actor_role }}</p>
      </template>

      <template #cell-action="{ row }">
        <code class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs dark:bg-gray-800">{{ row.action }}</code>
      </template>

      <template #cell-summary="{ row }">
        <p class="truncate text-sm">{{ row.summary ?? '—' }}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ row.entity_type }}<template v-if="row.entity_id"> #{{ row.entity_id }}</template>
        </p>
      </template>

      <template #cell-details="{ row }">
        <button type="button" class="btn-ghost h-7 px-2 text-xs" @click="selected = row">Details</button>
      </template>
    </DataTable>

    <PagerBar
      :pagination="pagination"
      :limit="limit"
      :loading="loading"
      @update:page="page = $event"
      @update:limit="limit = $event"
    />

    <ModalDialog
      :open="Boolean(selected)"
      size="lg"
      :title="selected ? `${selected.action} · ${selected.entity_type}` : ''"
      :description="selected?.summary ?? undefined"
      @close="selected = null"
      @submit="selected = null"
    >
      <div v-if="selected" class="space-y-4">
        <dl class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt class="text-gray-500 dark:text-gray-400">When</dt><dd>{{ formatDate(selected.created_at, true) }}</dd></div>
          <div><dt class="text-gray-500 dark:text-gray-400">Actor</dt><dd class="truncate">{{ selected.actor_email ?? 'System' }}</dd></div>
          <div><dt class="text-gray-500 dark:text-gray-400">IP</dt><dd class="font-mono text-xs">{{ selected.ip ?? '—' }}</dd></div>
          <div><dt class="text-gray-500 dark:text-gray-400">Request</dt><dd class="truncate font-mono text-xs">{{ selected.request_id ?? '—' }}</dd></div>
        </dl>

        <div v-if="changes.length" class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table class="w-full text-xs">
            <thead class="bg-gray-50 text-left uppercase tracking-wide text-gray-500 dark:bg-surface-800">
              <tr>
                <th scope="col" class="px-3 py-2">Field</th>
                <th scope="col" class="px-3 py-2">Before</th>
                <th scope="col" class="px-3 py-2">After</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
              <tr v-for="change in changes" :key="change.key">
                <td class="px-3 py-2 font-mono">{{ change.key }}</td>
                <td class="px-3 py-2 text-red-600 dark:text-red-400">{{ show(change.before) }}</td>
                <td class="px-3 py-2 text-green-700 dark:text-green-400">{{ show(change.after) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-else class="text-sm text-gray-500 dark:text-gray-400">No field-level changes were recorded for this entry.</p>

        <p v-if="selected.user_agent" class="truncate text-xs text-gray-400" :title="selected.user_agent">
          {{ selected.user_agent }}
        </p>
      </div>

      <template #footer>
        <button type="submit" class="btn-secondary">Close</button>
      </template>
    </ModalDialog>
  </div>
</template>
