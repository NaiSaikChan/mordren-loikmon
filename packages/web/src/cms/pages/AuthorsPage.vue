<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { cms } from '@loikmon/api'
import type { CmsAuthor, VerificationStatus } from '@loikmon/api'
import DataTable from '@/cms/components/DataTable.vue'
import FilterBar from '@/cms/components/FilterBar.vue'
import FormField from '@/cms/components/FormField.vue'
import MediaPicker from '@/cms/components/MediaPicker.vue'
import ModalDialog from '@/cms/components/ModalDialog.vue'
import PageHeader from '@/cms/components/PageHeader.vue'
import PagerBar from '@/cms/components/PagerBar.vue'
import RichTextEditor from '@/cms/components/RichTextEditor.vue'
import StatusBadge from '@/cms/components/StatusBadge.vue'
import { formatNumber, useConfirm } from '@/cms/composables/useCmsUi'
import { useResourceList } from '@/cms/composables/useResourceList'
import { useCmsSessionStore } from '@/cms/stores/session'
import { useToastStore } from '@/cms/stores/toast'

/**
 * Author profiles, their portfolio counts and the verification workflow.
 *
 * `user_id` links a profile to an account: that link is what gives an Author
 * role its `own content` scope, so it is only editable with the platform-wide
 * `authors.edit` permission.
 */
const session = useCmsSessionStore()
const toast = useToastStore()
const { confirm } = useConfirm()

const VERIFICATION: VerificationStatus[] = ['unverified', 'pending', 'verified', 'rejected']

const { rows, pagination, page, limit, loading, error, filters, load, reset, mutate } = useResourceList<
  CmsAuthor,
  { q: string; verification: VerificationStatus | '' }
>({
  filters: { q: '', verification: '' },
  fetcher: async ({ q, verification, page: p, limit: l }) => {
    const { data } = await cms.authors.list({ q: q || undefined, verification: verification || undefined, page: p, limit: l })
    return { rows: data.authors, pagination: data.pagination }
  },
})

const canCreate = computed(() => session.can('authors.create'))
const canEdit = computed(() => session.can('authors.edit'))
const canDelete = computed(() => session.can('authors.delete'))
const canVerify = computed(() => session.can('authors.verify'))
const filtersActive = computed(() => Boolean(filters.q || filters.verification))

const columns = [
  { key: 'name', label: 'Author' },
  { key: 'verification_status', label: 'Verification', width: '130px' },
  { key: 'portfolio', label: 'Portfolio', width: '140px', hideOnMobile: true },
  { key: 'followers_count', label: 'Followers', align: 'right' as const, width: '100px', hideOnMobile: true },
  { key: 'user_email', label: 'Linked account', hideOnMobile: true },
  { key: 'actions', label: '', align: 'right' as const, width: '140px' },
]

// ── Create / edit ───────────────────────────────────────────────────────────

const modal = ref(false)
const saving = ref(false)
const form = reactive({
  id: null as number | null,
  name: '',
  bio: '' as string | null,
  avatar_key: null as string | null,
  user_id: '' as string,
  website: '',
  facebook: '',
  youtube: '',
  instagram: '',
})

function open(author?: CmsAuthor) {
  Object.assign(form, {
    id: author?.id ?? null,
    name: author?.name ?? '',
    bio: author?.bio ?? '',
    avatar_key: author?.avatar_key ?? null,
    user_id: author?.user_id ?? '',
    website: author?.website ?? '',
    facebook: author?.facebook ?? '',
    youtube: author?.youtube ?? '',
    instagram: author?.instagram ?? '',
  })
  modal.value = true
}

async function save() {
  if (!form.name.trim()) {
    toast.failure(new Error('A name is required'), 'Author not saved')
    return
  }
  saving.value = true
  const payload = {
    name: form.name,
    bio: form.bio || null,
    avatar_key: form.avatar_key,
    user_id: form.user_id.trim() || null,
    website: form.website || null,
    facebook: form.facebook || null,
    youtube: form.youtube || null,
    instagram: form.instagram || null,
  }
  const result = await mutate(() => (form.id ? cms.authors.update(form.id, payload) : cms.authors.create(payload)), {
    success: form.id ? 'Author updated' : 'Author created',
  })
  saving.value = false
  if (result) modal.value = false
}

async function setVerification(author: CmsAuthor, status: VerificationStatus) {
  await mutate(() => cms.authors.setVerification(author.id, status), { success: `${author.name} marked ${status}` })
}

async function remove(author: CmsAuthor) {
  const ok = await confirm({
    title: 'Delete this author profile?',
    message: `${author.name} will be removed. Their books and articles stay in the catalogue but lose their author.`,
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return
  await mutate(() => cms.authors.remove(author.id), { success: 'Author deleted' })
}
</script>

<template>
  <div>
    <PageHeader title="Authors" description="Profiles, verification and portfolio performance." :count="pagination?.total ?? null">
      <template #actions>
        <button v-if="canCreate" type="button" class="btn-primary h-9" @click="open()">New author</button>
      </template>
    </PageHeader>

    <FilterBar v-model:search="filters.q" placeholder="Search author names…" :active="filtersActive" @clear="reset">
      <template #filters>
        <select v-model="filters.verification" class="input h-9 w-auto" aria-label="Filter by verification">
          <option value="">All verification states</option>
          <option v-for="status in VERIFICATION" :key="status" :value="status">{{ status }}</option>
        </select>
      </template>
    </FilterBar>

    <DataTable
      :rows="rows"
      :columns="columns"
      :loading="loading"
      :error="error"
      empty-title="No authors yet"
      empty-message="Create an author profile before adding books or articles."
      @retry="load"
    >
      <template #cell-name="{ row }">
        <div class="flex items-center gap-2">
          <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gray-100 text-xs font-semibold dark:bg-gray-800">
            {{ row.name.slice(0, 2).toUpperCase() }}
          </span>
          <div class="min-w-0">
            <p class="truncate font-medium">{{ row.name }}</p>
            <p v-if="row.website" class="truncate text-xs text-gray-500 dark:text-gray-400">{{ row.website }}</p>
          </div>
        </div>
      </template>

      <template #cell-verification_status="{ row }"><StatusBadge :status="row.verification_status" /></template>

      <template #cell-portfolio="{ row }">
        <span class="text-xs text-gray-600 dark:text-gray-300">
          {{ row.books_count ?? 0 }} books · {{ row.articles_count ?? 0 }} articles
        </span>
      </template>

      <template #cell-followers_count="{ row }">{{ formatNumber(row.followers_count ?? 0) }}</template>

      <template #cell-user_email="{ row }">
        <span v-if="row.user_email" class="truncate text-xs">{{ row.user_email }}</span>
        <span v-else class="text-xs text-gray-400">Not linked</span>
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-1">
          <button
            v-if="canVerify && row.verification_status !== 'verified'"
            type="button"
            class="btn-ghost h-7 px-2 text-xs"
            @click="setVerification(row, 'verified')"
          >
            Verify
          </button>
          <button
            v-else-if="canVerify"
            type="button"
            class="btn-ghost h-7 px-2 text-xs"
            @click="setVerification(row, 'unverified')"
          >
            Unverify
          </button>
          <button v-if="canEdit" type="button" class="btn-ghost h-7 px-2 text-xs" @click="open(row)">Edit</button>
          <button v-if="canDelete" type="button" class="btn-ghost h-7 px-2 text-xs text-red-600" @click="remove(row)">Delete</button>
        </div>
      </template>

      <template #empty-action>
        <button v-if="canCreate" type="button" class="btn-primary" @click="open()">New author</button>
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
      :open="modal"
      size="lg"
      :title="form.id ? 'Edit author' : 'New author'"
      :busy="saving"
      @close="modal = false"
      @submit="save"
    >
      <div class="grid gap-4 md:grid-cols-3">
        <div class="space-y-4 md:col-span-2">
          <FormField v-slot="{ id }" label="Name" required>
            <input :id="id" v-model="form.name" type="text" class="input" maxlength="255" required />
          </FormField>

          <FormField label="Biography">
            <RichTextEditor v-model="form.bio as string" :min-height="180" placeholder="Short biography…" />
          </FormField>

          <FormField
            v-slot="{ id }"
            label="Linked account (user id)"
            help="Links this profile to an account. An Author-role user can then manage only this profile's content."
          >
            <input :id="id" v-model="form.user_id" type="text" class="input font-mono text-xs" placeholder="uuid" />
          </FormField>
        </div>

        <div class="space-y-4">
          <MediaPicker v-model="form.avatar_key" kind="avatar" label="Avatar" />

          <FormField v-slot="{ id }" label="Website">
            <input :id="id" v-model="form.website" type="url" class="input" placeholder="https://" />
          </FormField>
          <FormField v-slot="{ id }" label="Facebook">
            <input :id="id" v-model="form.facebook" type="url" class="input" placeholder="https://" />
          </FormField>
          <FormField v-slot="{ id }" label="YouTube">
            <input :id="id" v-model="form.youtube" type="url" class="input" placeholder="https://" />
          </FormField>
          <FormField v-slot="{ id }" label="Instagram">
            <input :id="id" v-model="form.instagram" type="url" class="input" placeholder="https://" />
          </FormField>
        </div>
      </div>

      <template #footer>
        <button type="button" class="btn-secondary" @click="modal = false">Cancel</button>
        <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save author' }}</button>
      </template>
    </ModalDialog>
  </div>
</template>
