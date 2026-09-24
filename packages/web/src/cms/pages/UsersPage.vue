<script setup lang="ts">
import { computed, ref } from 'vue'
import { cms } from '@loikmon/api'
import type { CmsRole, CmsUserDetail, CmsUserRow } from '@loikmon/api'
import DataTable from '@/cms/components/DataTable.vue'
import FilterBar from '@/cms/components/FilterBar.vue'
import FormField from '@/cms/components/FormField.vue'
import ModalDialog from '@/cms/components/ModalDialog.vue'
import PageHeader from '@/cms/components/PageHeader.vue'
import PagerBar from '@/cms/components/PagerBar.vue'
import StatusBadge from '@/cms/components/StatusBadge.vue'
import { downloadCsv, formatDate, formatRelative, useConfirm } from '@/cms/composables/useCmsUi'
import { useResourceList } from '@/cms/composables/useResourceList'
import { useCmsSessionStore } from '@/cms/stores/session'
import { useToastStore } from '@/cms/stores/toast'

/**
 * Accounts, role assignment and complimentary access.
 *
 * Two rules are enforced by the API regardless of permissions and surfaced
 * here: nobody can remove their own administrator role, and the last
 * administrator cannot be demoted or deleted.
 */
const session = useCmsSessionStore()
const toast = useToastStore()
const { confirm } = useConfirm()

const {
  rows, pagination, page, limit, loading, error, filters,
  selection, selectedIds, allSelected, load, reset, toggle, toggleAll, clearSelection, mutate,
} = useResourceList<CmsUserRow, { q: string; role: string; subscribed: '' | 'true' | 'false'; verified: '' | 'true' | 'false' }>({
  filters: { q: '', role: '', subscribed: '', verified: '' },
  fetcher: async ({ q, role, subscribed, verified, page: p, limit: l }) => {
    const { data } = await cms.users.list({
      q: q || undefined,
      role: role || undefined,
      subscribed: subscribed === '' ? undefined : subscribed === 'true',
      verified: verified === '' ? undefined : verified === 'true',
      page: p,
      limit: l,
    })
    return { rows: data.users, pagination: data.pagination }
  },
})

const canEdit = computed(() => session.can('users.edit'))
const canDelete = computed(() => session.can('users.delete'))
const canManageRoles = computed(() => session.can('roles.manage'))
const canGrant = computed(() => session.can('subscriptions.manage'))
const filtersActive = computed(() => Boolean(filters.q || filters.role || filters.subscribed || filters.verified))

const columns = [
  { key: 'email', label: 'Account' },
  { key: 'role_keys', label: 'Roles', width: '180px' },
  { key: 'email_verified', label: 'Verified', width: '100px', hideOnMobile: true },
  { key: 'created_at', label: 'Joined', width: '120px', hideOnMobile: true },
  { key: 'actions', label: '', align: 'right' as const, width: '120px' },
]

const roles = ref<CmsRole[]>([])
if (canManageRoles.value) {
  cms.roles
    .list()
    .then(({ data }) => (roles.value = data.roles))
    .catch(() => undefined)
}

// ── Detail drawer ───────────────────────────────────────────────────────────

const modal = ref(false)
const detail = ref<CmsUserDetail | null>(null)
const detailLoading = ref(false)
const savingRoles = ref(false)
const selectedRoleIds = ref<number[]>([])
const grantReason = ref('')
const grantExpires = ref('')

async function openUser(row: CmsUserRow) {
  modal.value = true
  detailLoading.value = true
  detail.value = null
  try {
    const { data } = await cms.users.get(row.id)
    detail.value = data
    selectedRoleIds.value = data.roles.map((r) => r.id)
  } catch (err) {
    toast.failure(err, 'Could not open the account')
    modal.value = false
  } finally {
    detailLoading.value = false
  }
}

async function saveRoles() {
  if (!detail.value) return
  savingRoles.value = true
  try {
    await cms.users.setRoles(detail.value.user.id, selectedRoleIds.value)
    await load()
    const refreshed = await cms.users.get(detail.value.user.id)
    detail.value = refreshed.data
    toast.success('Roles updated')
    // Changing your own roles changes your own menu.
    if (detail.value.user.id === session.session?.user.id) await session.load(true)
  } catch (err) {
    toast.failure(err, 'Could not update the roles')
  } finally {
    savingRoles.value = false
  }
}

async function grantAccess() {
  if (!detail.value || !grantReason.value.trim()) return
  try {
    await cms.users.grant(detail.value.user.id, {
      reason: grantReason.value,
      expires_at: grantExpires.value ? new Date(grantExpires.value).toISOString() : null,
    })
    const refreshed = await cms.users.get(detail.value.user.id)
    detail.value = refreshed.data
    grantReason.value = ''
    grantExpires.value = ''
    toast.success('Complimentary access granted')
  } catch (err) {
    toast.failure(err, 'Could not grant access')
  }
}

async function revokeGrant(grantId: number) {
  if (!detail.value) return
  try {
    await cms.users.revokeGrant(grantId)
    const refreshed = await cms.users.get(detail.value.user.id)
    detail.value = refreshed.data
    toast.success('Grant revoked')
  } catch (err) {
    toast.failure(err, 'Could not revoke the grant')
  }
}

async function remove(row: CmsUserRow) {
  const ok = await confirm({
    title: 'Delete this account?',
    message: `${row.email} and all of their library, progress and reviews will be removed. Store subscriptions keep renewing until cancelled in the store.`,
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return
  const result = await mutate(() => cms.users.remove(row.id), { success: 'Account deleted' })
  if (result) modal.value = false
}

async function bulkVerify() {
  const result = await mutate(() => cms.users.bulk({ user_ids: selectedIds.value as string[], action: 'verify_email' }))
  if (result) {
    toast.success(`${result.data.succeeded.length} account(s) marked verified`)
    clearSelection()
  }
}

function exportCsv() {
  downloadCsv(
    'users.csv',
    [
      { key: 'id', label: 'ID' },
      { key: 'email', label: 'E-mail' },
      { key: 'name', label: 'Name' },
      { key: 'role_keys', label: 'Roles', value: (row: CmsUserRow) => row.role_keys.join(' ') },
      { key: 'email_verified', label: 'Verified', value: (row: CmsUserRow) => (row.email_verified ? 'yes' : 'no') },
      { key: 'created_at', label: 'Joined' },
    ],
    rows.value,
  )
}
</script>

<template>
  <div>
    <PageHeader title="Users" description="Accounts, roles and complimentary access." :count="pagination?.total ?? null">
      <template #actions>
        <button type="button" class="btn-secondary h-9" :disabled="!rows.length" @click="exportCsv">Export</button>
      </template>
    </PageHeader>

    <FilterBar
      v-model:search="filters.q"
      placeholder="Search e-mail, name or phone…"
      :active="filtersActive"
      :selected-count="selectedIds.length"
      @clear="reset"
    >
      <template #filters>
        <select v-model="filters.role" class="input h-9 w-auto" aria-label="Filter by role">
          <option value="">All roles</option>
          <option v-for="role in roles" :key="role.id" :value="role.role_key">{{ role.name }}</option>
        </select>
        <select v-model="filters.subscribed" class="input h-9 w-auto" aria-label="Filter by subscription">
          <option value="">Any subscription</option>
          <option value="true">Subscribed</option>
          <option value="false">Not subscribed</option>
        </select>
        <select v-model="filters.verified" class="input h-9 w-auto" aria-label="Filter by verification">
          <option value="">Any verification</option>
          <option value="true">Verified</option>
          <option value="false">Unverified</option>
        </select>
      </template>

      <template #bulk>
        <button v-if="canEdit" type="button" class="btn-secondary h-8 text-xs" @click="bulkVerify">Mark verified</button>
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
      empty-title="No accounts"
      empty-message="Nobody matches these filters."
      @toggle="toggle"
      @toggle-all="toggleAll"
      @retry="load"
    >
      <template #cell-email="{ row }">
        <button type="button" class="text-left font-medium hover:underline" @click="openUser(row)">{{ row.email }}</button>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ row.name || 'No name' }}
          <span v-if="row.author_id" class="badge-brand ml-1">author profile</span>
        </p>
      </template>

      <template #cell-role_keys="{ row }">
        <span v-for="key in row.role_keys" :key="key" class="badge-gray mr-1 capitalize">{{ key }}</span>
      </template>

      <template #cell-email_verified="{ row }">
        <StatusBadge :status="row.email_verified ? 'verified' : 'unverified'" />
      </template>

      <template #cell-created_at="{ row }">
        <span :title="formatDate(row.created_at, true)">{{ formatRelative(row.created_at) }}</span>
      </template>

      <template #cell-actions="{ row }">
        <button type="button" class="btn-ghost h-7 px-2 text-xs" @click="openUser(row)">Manage</button>
      </template>
    </DataTable>

    <PagerBar
      :pagination="pagination"
      :limit="limit"
      :loading="loading"
      @update:page="page = $event"
      @update:limit="limit = $event"
    />

    <!-- Account detail -->
    <ModalDialog
      :open="modal"
      size="lg"
      :title="detail?.user.email ?? 'Account'"
      :busy="savingRoles"
      @close="modal = false"
      @submit="saveRoles"
    >
      <div v-if="detailLoading" class="space-y-2">
        <div v-for="n in 4" :key="n" class="skeleton h-16 w-full" />
      </div>

      <div v-else-if="detail" class="space-y-5">
        <dl class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt class="text-gray-500 dark:text-gray-400">Name</dt><dd class="font-medium">{{ detail.user.name || '—' }}</dd></div>
          <div><dt class="text-gray-500 dark:text-gray-400">Phone</dt><dd class="font-medium">{{ detail.user.phone || '—' }}</dd></div>
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Verified</dt>
            <dd><StatusBadge :status="detail.user.email_verified ? 'verified' : 'unverified'" /></dd>
          </div>
          <div><dt class="text-gray-500 dark:text-gray-400">Joined</dt><dd class="font-medium">{{ formatDate(detail.user.created_at) }}</dd></div>
        </dl>

        <!-- Entitlement -->
        <section class="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          <h3 class="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Access</h3>
          <p class="text-sm">
            <span :class="detail.entitlement.active ? 'badge-green' : 'badge-gray'">
              {{ detail.entitlement.active ? 'Active' : 'No access' }}
            </span>
            <span v-if="detail.entitlement.source" class="ml-2 text-xs text-gray-500 dark:text-gray-400">
              via {{ detail.entitlement.source }}
              <template v-if="detail.entitlement.expires_at"> until {{ formatDate(detail.entitlement.expires_at) }}</template>
            </span>
          </p>

          <div v-if="canGrant" class="mt-3 space-y-2">
            <div class="flex flex-wrap items-end gap-2">
              <FormField v-slot="{ id }" label="Grant reason" class="min-w-48 flex-1" hide-label>
                <input :id="id" v-model="grantReason" type="text" class="input h-9" placeholder="Reason for complimentary access" maxlength="255" />
              </FormField>
              <input v-model="grantExpires" type="date" class="input h-9 w-auto" aria-label="Grant expiry (optional)" />
              <button type="button" class="btn-secondary h-9" :disabled="!grantReason.trim()" @click="grantAccess">Grant</button>
            </div>

            <ul v-if="detail.grants.length" class="space-y-1 text-xs">
              <li
                v-for="grant in (detail.grants as Array<{ id: number; reason: string; expires_at: string | null; revoked_at: string | null }>)"
                :key="grant.id"
                class="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5 dark:bg-surface-800"
              >
                <span class="min-w-0 flex-1 truncate">{{ grant.reason }}</span>
                <span class="shrink-0 text-gray-500">
                  {{ grant.expires_at ? `until ${formatDate(grant.expires_at)}` : 'no expiry' }}
                </span>
                <button
                  v-if="!grant.revoked_at"
                  type="button"
                  class="btn-ghost h-6 px-2 text-xs text-red-600"
                  @click="revokeGrant(grant.id)"
                >
                  Revoke
                </button>
                <span v-else class="badge-gray">revoked</span>
              </li>
            </ul>
          </div>
        </section>

        <!-- Roles -->
        <section v-if="canManageRoles" class="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          <h3 class="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Roles</h3>
          <div class="grid gap-2 sm:grid-cols-2">
            <label
              v-for="role in roles"
              :key="role.id"
              class="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 p-2 text-sm dark:border-gray-700"
            >
              <input v-model="selectedRoleIds" type="checkbox" :value="role.id" class="mt-0.5 rounded text-brand-600" />
              <span class="min-w-0">
                <span class="block font-medium">{{ role.name }}</span>
                <span class="block text-xs text-gray-500 dark:text-gray-400">
                  {{ role.description }}
                  <span v-if="role.scope === 'own'" class="badge-yellow ml-1">own content</span>
                </span>
              </span>
            </label>
          </div>
          <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
            The highest-ranked role becomes the account's primary role. At least one administrator must always remain.
          </p>
        </section>

        <!-- Recent activity -->
        <section v-if="detail.recent_activity.length">
          <h3 class="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Recent activity</h3>
          <ul class="space-y-1 text-xs">
            <li v-for="entry in detail.recent_activity" :key="entry.id" class="flex gap-2 rounded-lg bg-gray-50 px-2 py-1.5 dark:bg-surface-800">
              <span class="badge-gray shrink-0">{{ entry.action }}</span>
              <span class="min-w-0 flex-1 truncate">{{ entry.summary ?? entry.entity_type }}</span>
              <span class="shrink-0 text-gray-500">{{ formatRelative(entry.created_at) }}</span>
            </li>
          </ul>
        </section>
      </div>

      <template #footer>
        <button
          v-if="canDelete && detail"
          type="button"
          class="btn-ghost mr-auto text-xs text-red-600"
          @click="remove({ id: detail.user.id, email: detail.user.email } as CmsUserRow)"
        >
          Delete account
        </button>
        <button type="button" class="btn-secondary" @click="modal = false">Close</button>
        <button v-if="canManageRoles" type="submit" class="btn-primary" :disabled="savingRoles">
          {{ savingRoles ? 'Saving…' : 'Save roles' }}
        </button>
      </template>
    </ModalDialog>
  </div>
</template>
