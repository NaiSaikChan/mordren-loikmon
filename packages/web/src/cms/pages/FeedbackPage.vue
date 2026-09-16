<script setup lang="ts">
import { computed, ref } from 'vue'
import { cms } from '@loikmon/api'
import type { CmsTicket, CmsTicketDetail, CmsUserRow, FeedbackMetrics, TicketPriority, TicketStatus } from '@loikmon/api'
import ChartBars from '@/cms/components/ChartBars.vue'
import DataTable from '@/cms/components/DataTable.vue'
import FilterBar from '@/cms/components/FilterBar.vue'
import FormField from '@/cms/components/FormField.vue'
import ModalDialog from '@/cms/components/ModalDialog.vue'
import PageHeader from '@/cms/components/PageHeader.vue'
import PagerBar from '@/cms/components/PagerBar.vue'
import StatCard from '@/cms/components/StatCard.vue'
import StatusBadge from '@/cms/components/StatusBadge.vue'
import { formatDate, formatDuration, formatRelative, useConfirm } from '@/cms/composables/useCmsUi'
import { useResourceList } from '@/cms/composables/useResourceList'
import { useCmsSessionStore } from '@/cms/stores/session'
import { useToastStore } from '@/cms/stores/toast'

/**
 * Support queue: triage, reply and resolve.
 *
 * A public reply is e-mailed to the reporter; an internal note stays in the
 * CMS, which is why the two are visually distinct in the thread.
 */
const session = useCmsSessionStore()
const toast = useToastStore()
const { confirm } = useConfirm()

const STATUSES: TicketStatus[] = ['open', 'pending', 'resolved', 'closed']
const PRIORITIES: TicketPriority[] = ['low', 'normal', 'high', 'urgent']

const { rows, pagination, page, limit, loading, error, filters, load, reset } = useResourceList<
  CmsTicket,
  { q: string; status: TicketStatus | ''; priority: TicketPriority | ''; unassigned: boolean }
>({
  filters: { q: '', status: 'open', priority: '', unassigned: false },
  fetcher: async ({ q, status, priority, unassigned, page: p, limit: l }) => {
    const { data } = await cms.feedback.list({
      q: q || undefined,
      status: status || undefined,
      priority: priority || undefined,
      unassigned: unassigned || undefined,
      page: p,
      limit: l,
    })
    return { rows: data.tickets, pagination: data.pagination }
  },
})

const canRespond = computed(() => session.can('feedback.respond'))
const canAssign = computed(() => session.can('feedback.assign'))
const canDelete = computed(() => session.can('feedback.delete'))
const filtersActive = computed(() => Boolean(filters.q || filters.priority || filters.unassigned) || filters.status !== 'open')

const columns = [
  { key: 'subject', label: 'Ticket' },
  { key: 'category', label: 'Category', width: '110px', hideOnMobile: true },
  { key: 'priority', label: 'Priority', width: '100px' },
  { key: 'status', label: 'Status', width: '100px' },
  { key: 'assignee_name', label: 'Assigned', width: '140px', hideOnMobile: true },
  { key: 'created_at', label: 'Opened', width: '120px', hideOnMobile: true },
  { key: 'actions', label: '', align: 'right' as const, width: '90px' },
]

// ── Metrics ─────────────────────────────────────────────────────────────────

const metrics = ref<FeedbackMetrics | null>(null)
cms.feedback
  .metrics({ days: 30 })
  .then(({ data }) => (metrics.value = data.metrics))
  .catch(() => undefined)

// ── Ticket thread ───────────────────────────────────────────────────────────

const modal = ref(false)
const ticket = ref<CmsTicketDetail | null>(null)
const threadLoading = ref(false)
const replyBody = ref('')
const replyInternal = ref(false)
const replying = ref(false)
const staff = ref<CmsUserRow[]>([])

async function openTicket(row: CmsTicket) {
  modal.value = true
  threadLoading.value = true
  ticket.value = null
  replyBody.value = ''
  replyInternal.value = false
  try {
    const { data } = await cms.feedback.get(row.id)
    ticket.value = data.ticket
    if (canAssign.value && !staff.value.length) {
      // Only staff accounts can own a ticket, so exclude plain members.
      const users = await cms.users.list({ limit: 100 })
      staff.value = users.data.users.filter((u) => u.role !== 'user')
    }
  } catch (err) {
    toast.failure(err, 'Could not open the ticket')
    modal.value = false
  } finally {
    threadLoading.value = false
  }
}

async function sendReply() {
  if (!ticket.value || !replyBody.value.trim()) return
  replying.value = true
  try {
    const { data } = await cms.feedback.reply(ticket.value.id, replyBody.value, replyInternal.value)
    ticket.value = data.ticket
    replyBody.value = ''
    await load()
    toast.success(replyInternal.value ? 'Internal note added' : 'Reply sent to the reporter')
  } catch (err) {
    toast.failure(err, 'Could not send the reply')
  } finally {
    replying.value = false
  }
}

async function patch(payload: Parameters<typeof cms.feedback.update>[1]) {
  if (!ticket.value) return
  try {
    const { data } = await cms.feedback.update(ticket.value.id, payload)
    ticket.value = data.ticket
    await load()
  } catch (err) {
    toast.failure(err, 'Could not update the ticket')
  }
}

async function assign(userId: string) {
  if (!ticket.value) return
  try {
    const { data } = await cms.feedback.assign(ticket.value.id, userId || null)
    ticket.value = data.ticket
    await load()
    toast.success(userId ? 'Ticket assigned' : 'Ticket unassigned')
  } catch (err) {
    toast.failure(err, 'Could not assign the ticket')
  }
}

async function remove(row: CmsTicket) {
  const ok = await confirm({
    title: 'Delete this ticket?',
    message: `${row.reference} and its whole conversation will be removed permanently.`,
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return
  try {
    await cms.feedback.remove(row.id)
    modal.value = false
    await load()
    toast.success('Ticket deleted')
  } catch (err) {
    toast.failure(err, 'Could not delete the ticket')
  }
}
</script>

<template>
  <div>
    <PageHeader title="Feedback" description="Reader tickets, replies and resolution." :count="pagination?.total ?? null" />

    <div v-if="metrics" class="mb-5 grid gap-4 lg:grid-cols-3">
      <div class="grid grid-cols-2 gap-3 lg:col-span-2">
        <StatCard label="Open tickets" :value="metrics.open" />
        <StatCard label="Resolved" :value="metrics.by_status.resolved ?? 0" />
        <StatCard label="First reply" :value="formatDuration(metrics.avg_first_response_minutes * 60)" hint="average" />
        <StatCard label="Time to resolve" :value="formatDuration(metrics.avg_resolution_minutes * 60)" hint="average" />
      </div>
      <div class="card p-4">
        <h2 class="section-title mb-3 text-base">By category</h2>
        <ChartBars :items="metrics.by_category.map((c) => ({ label: c.category, value: c.count }))" palette />
      </div>
    </div>

    <FilterBar v-model:search="filters.q" placeholder="Search subject, reference or e-mail…" :active="filtersActive" @clear="reset">
      <template #filters>
        <select v-model="filters.status" class="input h-9 w-auto" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option v-for="status in STATUSES" :key="status" :value="status">{{ status }}</option>
        </select>
        <select v-model="filters.priority" class="input h-9 w-auto" aria-label="Filter by priority">
          <option value="">Any priority</option>
          <option v-for="priority in PRIORITIES" :key="priority" :value="priority">{{ priority }}</option>
        </select>
        <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input v-model="filters.unassigned" type="checkbox" class="rounded text-brand-600" />
          Unassigned only
        </label>
      </template>
    </FilterBar>

    <DataTable
      :rows="rows"
      :columns="columns"
      :loading="loading"
      :error="error"
      :dimmed="(row: CmsTicket) => row.status === 'closed'"
      empty-title="No tickets"
      empty-message="Reader messages from the contact form arrive here."
      @retry="load"
    >
      <template #cell-subject="{ row }">
        <button type="button" class="text-left font-medium hover:underline" @click="openTicket(row)">{{ row.subject }}</button>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ row.reference }} · {{ row.email ?? 'account holder' }}
          <template v-if="row.messages_count"> · {{ row.messages_count }} messages</template>
        </p>
      </template>

      <template #cell-category="{ row }"><span class="badge-gray capitalize">{{ row.category }}</span></template>
      <template #cell-priority="{ row }"><StatusBadge :status="row.priority" /></template>
      <template #cell-status="{ row }"><StatusBadge :status="row.status" /></template>
      <template #cell-assignee_name="{ row }">
        <span v-if="row.assignee_name" class="text-xs">{{ row.assignee_name }}</span>
        <span v-else class="text-xs text-gray-400">Unassigned</span>
      </template>
      <template #cell-created_at="{ row }">
        <span :title="formatDate(row.created_at, true)">{{ formatRelative(row.created_at) }}</span>
      </template>

      <template #cell-actions="{ row }">
        <button type="button" class="btn-ghost h-7 px-2 text-xs" @click="openTicket(row)">Open</button>
      </template>
    </DataTable>

    <PagerBar
      :pagination="pagination"
      :limit="limit"
      :loading="loading"
      @update:page="page = $event"
      @update:limit="limit = $event"
    />

    <!-- Ticket thread -->
    <ModalDialog
      :open="modal"
      size="lg"
      :title="ticket ? `${ticket.reference} — ${ticket.subject}` : 'Ticket'"
      :busy="replying"
      @close="modal = false"
      @submit="sendReply"
    >
      <div v-if="threadLoading" class="space-y-2">
        <div v-for="n in 3" :key="n" class="skeleton h-16 w-full" />
      </div>

      <div v-else-if="ticket" class="space-y-4">
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge :status="ticket.status" />
          <StatusBadge :status="ticket.priority" />
          <span class="badge-gray capitalize">{{ ticket.category }}</span>
          <span class="text-xs text-gray-500 dark:text-gray-400">
            {{ ticket.name ?? ticket.email ?? 'Reader' }} · opened {{ formatDate(ticket.created_at, true) }}
          </span>
        </div>

        <!-- Conversation -->
        <ol class="space-y-2">
          <li
            v-for="message in ticket.messages"
            :key="message.id"
            class="rounded-xl border p-3 text-sm"
            :class="message.is_internal
              ? 'border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20'
              : message.author_user_id
                ? 'border-brand-200 bg-brand-50 dark:border-brand-900/50 dark:bg-brand-900/20'
                : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-surface-800'"
          >
            <div class="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <strong class="font-medium text-gray-700 dark:text-gray-200">
                {{ message.author_name ?? ticket.name ?? 'Reader' }}
              </strong>
              <span>{{ formatDate(message.created_at, true) }}</span>
              <span v-if="message.is_internal" class="badge-yellow">internal note</span>
            </div>
            <p class="whitespace-pre-wrap text-gray-800 dark:text-gray-100">{{ message.body }}</p>
          </li>
        </ol>

        <!-- Triage -->
        <div v-if="canRespond" class="grid gap-3 sm:grid-cols-3">
          <FormField v-slot="{ id }" label="Status">
            <select :id="id" class="input" :value="ticket.status" @change="patch({ status: ($event.target as HTMLSelectElement).value as TicketStatus })">
              <option v-for="status in STATUSES" :key="status" :value="status">{{ status }}</option>
            </select>
          </FormField>
          <FormField v-slot="{ id }" label="Priority">
            <select :id="id" class="input" :value="ticket.priority" @change="patch({ priority: ($event.target as HTMLSelectElement).value as TicketPriority })">
              <option v-for="priority in PRIORITIES" :key="priority" :value="priority">{{ priority }}</option>
            </select>
          </FormField>
          <FormField v-if="canAssign" v-slot="{ id }" label="Assigned to">
            <select :id="id" class="input" :value="ticket.assigned_to ?? ''" @change="assign(($event.target as HTMLSelectElement).value)">
              <option value="">Unassigned</option>
              <option v-for="user in staff" :key="user.id" :value="user.id">{{ user.name || user.email }}</option>
            </select>
          </FormField>
        </div>

        <!-- Reply -->
        <div v-if="canRespond">
          <FormField v-slot="{ id }" label="Reply" :help="replyInternal ? 'Internal notes are never sent to the reporter.' : 'This is e-mailed to the reporter.'">
            <textarea :id="id" v-model="replyBody" rows="4" class="input resize-y" maxlength="8000" placeholder="Write a reply…" />
          </FormField>
          <label class="mt-2 flex items-center gap-2 text-sm">
            <input v-model="replyInternal" type="checkbox" class="rounded text-brand-600" />
            Internal note (not sent by e-mail)
          </label>
        </div>
      </div>

      <template #footer>
        <button v-if="canDelete && ticket" type="button" class="btn-ghost mr-auto text-xs text-red-600" @click="remove(ticket)">
          Delete ticket
        </button>
        <button type="button" class="btn-secondary" @click="modal = false">Close</button>
        <button v-if="canRespond" type="submit" class="btn-primary" :disabled="replying || !replyBody.trim()">
          {{ replying ? 'Sending…' : replyInternal ? 'Add note' : 'Send reply' }}
        </button>
      </template>
    </ModalDialog>
  </div>
</template>
