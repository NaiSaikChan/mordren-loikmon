<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { cms } from '@loikmon/api'
import type { CmsPolicyDetail, CmsPolicySummary } from '@loikmon/api'
import FormField from '@/cms/components/FormField.vue'
import ModalDialog from '@/cms/components/ModalDialog.vue'
import PageHeader from '@/cms/components/PageHeader.vue'
import RichTextEditor from '@/cms/components/RichTextEditor.vue'
import StatusBadge from '@/cms/components/StatusBadge.vue'
import { formatDate, fromLocalInput, toLocalInput, useConfirm } from '@/cms/composables/useCmsUi'
import { useCmsSessionStore } from '@/cms/stores/session'
import { useToastStore } from '@/cms/stores/toast'

/**
 * Policies and terms with version history.
 *
 * Editing always writes a draft; publishing points the live version at it and
 * archives the previous one, so the text a reader agreed to on a given date can
 * always be reproduced.
 */
const session = useCmsSessionStore()
const toast = useToastStore()
const { confirm } = useConfirm()

const policies = ref<CmsPolicySummary[]>([])
const selected = ref<string | null>(null)
const detail = ref<CmsPolicyDetail | null>(null)
const loading = ref(true)
const detailLoading = ref(false)
const saving = ref(false)

const canEdit = computed(() => session.can('policies.edit'))
const canPublish = computed(() => session.can('policies.publish'))

const draft = reactive({ title: '', body: '', summary: '', effective_at: '' })
let pristine = ''

async function loadList() {
  loading.value = true
  try {
    const { data } = await cms.policies.list()
    policies.value = data.policies
    if (!selected.value && data.policies.length) selected.value = data.policies[0].slug
  } catch (err) {
    toast.failure(err, 'Could not load the policies')
  } finally {
    loading.value = false
  }
}

async function loadDetail(slug: string) {
  detailLoading.value = true
  try {
    const { data } = await cms.policies.get(slug)
    detail.value = data.policy
    const source = data.policy.draft ?? data.policy.current
    Object.assign(draft, {
      title: source?.title ?? data.policy.title,
      body: source?.body ?? '',
      summary: source?.summary ?? '',
      effective_at: toLocalInput(source?.effective_at ?? null),
    })
    pristine = JSON.stringify(draft)
  } catch (err) {
    toast.failure(err, 'Could not open this policy')
  } finally {
    detailLoading.value = false
  }
}

void loadList()
watch(selected, (slug) => slug && void loadDetail(slug))

const dirty = computed(() => JSON.stringify(draft) !== pristine)

async function saveDraft() {
  if (!selected.value) return
  saving.value = true
  try {
    const { data } = await cms.policies.saveDraft(selected.value, {
      title: draft.title,
      body: draft.body,
      summary: draft.summary || null,
      effective_at: fromLocalInput(draft.effective_at),
    })
    detail.value = data.policy
    pristine = JSON.stringify(draft)
    await loadList()
    toast.success('Draft saved')
  } catch (err) {
    toast.failure(err, 'Could not save the draft')
  } finally {
    saving.value = false
  }
}

async function publish() {
  if (!selected.value || !detail.value) return
  const version = detail.value.draft?.version ?? detail.value.published_version
  if (!version) {
    toast.failure(new Error('Save a draft before publishing'), 'Nothing to publish')
    return
  }
  const ok = await confirm({
    title: `Publish version ${version}?`,
    message: 'It becomes the text readers see. The previous version is archived, not deleted.',
    confirmLabel: 'Publish',
  })
  if (!ok) return
  if (dirty.value) await saveDraft()
  try {
    const { data } = await cms.policies.publish(selected.value, version)
    detail.value = data.policy
    await loadList()
    toast.success(`Version ${version} is live`)
  } catch (err) {
    toast.failure(err, 'Could not publish')
  }
}

/** Makes an older version live again without editing it first. */
async function publishVersion(version: number) {
  const slug = selected.value
  if (!slug) return
  try {
    const { data } = await cms.policies.publish(slug, version)
    detail.value = data.policy
    await loadList()
    toast.success(`Version ${version} is live`)
  } catch (err) {
    toast.failure(err, 'Could not publish that version')
  }
}

async function viewVersion(version: number) {
  if (!selected.value) return
  try {
    const { data } = await cms.policies.get(selected.value)
    const found = data.policy.versions.find((v) => v.version === version)
    if (!found) return
    // Version list rows carry no body; fetch the whole policy and copy the text
    // of the requested version into the editor as a new draft.
    const source = data.policy.current?.version === version ? data.policy.current : data.policy.draft
    Object.assign(draft, {
      title: found.title,
      body: source?.body ?? draft.body,
      summary: found.summary ?? '',
      effective_at: toLocalInput(found.effective_at),
    })
    toast.info(`Loaded version ${version} into the editor — save to make it the new draft`)
  } catch (err) {
    toast.failure(err, 'Could not load that version')
  }
}

// ── New policy ──────────────────────────────────────────────────────────────

const modal = ref(false)
const newPolicy = reactive({ slug: '', title: '', kind: 'custom' })

async function createPolicy() {
  if (!newPolicy.slug.trim() || !newPolicy.title.trim()) {
    toast.failure(new Error('A slug and a title are required'), 'Policy not created')
    return
  }
  saving.value = true
  try {
    await cms.policies.create({ slug: newPolicy.slug, title: newPolicy.title, kind: newPolicy.kind })
    modal.value = false
    await loadList()
    selected.value = newPolicy.slug.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    Object.assign(newPolicy, { slug: '', title: '', kind: 'custom' })
    toast.success('Policy created')
  } catch (err) {
    toast.failure(err, 'Could not create the policy')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title="Policies & terms" description="Versioned legal text published to the storefront." :count="policies.length">
      <template #actions>
        <a
          v-if="detail?.published_version"
          :href="`/policies/${detail.slug}`"
          target="_blank"
          rel="noopener"
          class="btn-ghost h-9 no-underline"
        >
          View live ↗
        </a>
        <button v-if="canEdit" type="button" class="btn-secondary h-9" @click="modal = true">New policy</button>
        <button v-if="canEdit" type="button" class="btn-secondary h-9" :disabled="!dirty || saving" @click="saveDraft">
          {{ saving ? 'Saving…' : dirty ? 'Save draft' : 'Draft saved' }}
        </button>
        <button v-if="canPublish" type="button" class="btn-primary h-9" @click="publish">Publish</button>
      </template>
    </PageHeader>

    <div v-if="loading" class="skeleton h-96 w-full" />

    <div v-else class="grid gap-4 lg:grid-cols-4">
      <!-- Policy list -->
      <nav class="card h-fit p-2 lg:col-span-1" aria-label="Policies">
        <ul class="space-y-0.5">
          <li v-for="policy in policies" :key="policy.slug">
            <button
              type="button"
              class="w-full rounded-lg px-3 py-2 text-left text-sm transition-colors"
              :class="selected === policy.slug
                ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'"
              :aria-current="selected === policy.slug ? 'page' : undefined"
              @click="selected = policy.slug"
            >
              <span class="block truncate">{{ policy.title }}</span>
              <span class="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                <template v-if="policy.published_version">v{{ policy.published_version }} live</template>
                <template v-else>not published</template>
                <template v-if="policy.draft_version"> · draft v{{ policy.draft_version }}</template>
              </span>
            </button>
          </li>
        </ul>
      </nav>

      <!-- Editor -->
      <section class="space-y-4 lg:col-span-3">
        <div v-if="detailLoading" class="skeleton h-96 w-full" />

        <template v-else-if="detail">
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge :status="detail.draft ? 'draft' : detail.published_version ? 'published' : 'draft'" />
            <span class="text-xs text-gray-500 dark:text-gray-400">
              {{ detail.versions_count }} version{{ detail.versions_count === 1 ? '' : 's' }}
              <template v-if="detail.current"> · live since {{ formatDate(detail.current.published_at, true) }}</template>
            </span>
            <span v-if="dirty" class="badge-yellow ml-auto">Unsaved changes</span>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <FormField v-slot="{ id }" label="Title" required>
              <input :id="id" v-model="draft.title" type="text" class="input" maxlength="255" :disabled="!canEdit" required />
            </FormField>
            <FormField v-slot="{ id }" label="Effective from" help="Shown to readers as the date this version applies.">
              <input :id="id" v-model="draft.effective_at" type="datetime-local" class="input" :disabled="!canEdit" />
            </FormField>
          </div>

          <FormField v-slot="{ id }" label="Summary of changes" help="A one-line note for the version list.">
            <input :id="id" v-model="draft.summary" type="text" class="input" maxlength="500" :disabled="!canEdit" />
          </FormField>

          <FormField label="Text">
            <RichTextEditor v-model="draft.body" :min-height="420" :disabled="!canEdit" placeholder="Write the policy text…" />
          </FormField>

          <section>
            <h2 class="section-title mb-2 text-base">Version history</h2>
            <ul class="card divide-y divide-gray-100 dark:divide-gray-800">
              <li v-if="!detail.versions.length" class="p-4 text-sm text-gray-500 dark:text-gray-400">No versions yet.</li>
              <li v-for="version in detail.versions" :key="version.id" class="flex flex-wrap items-center gap-3 p-3">
                <span class="badge-gray shrink-0">v{{ version.version }}</span>
                <StatusBadge :status="version.status" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm">{{ version.summary ?? version.title }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    {{ formatDate(version.created_at, true) }}
                    <template v-if="version.published_at"> · published {{ formatDate(version.published_at) }}</template>
                  </p>
                </div>
                <button v-if="canEdit" type="button" class="btn-ghost h-7 px-2 text-xs" @click="viewVersion(version.version)">
                  Load
                </button>
                <button
                  v-if="canPublish && version.status !== 'published'"
                  type="button"
                  class="btn-secondary h-7 px-2.5 text-xs"
                  @click="publishVersion(version.version)"
                >
                  Publish
                </button>
              </li>
            </ul>
          </section>
        </template>
      </section>
    </div>

    <ModalDialog :open="modal" title="New policy" :busy="saving" @close="modal = false" @submit="createPolicy">
      <div class="space-y-4">
        <FormField v-slot="{ id }" label="Title" required>
          <input :id="id" v-model="newPolicy.title" type="text" class="input" maxlength="255" required />
        </FormField>
        <FormField v-slot="{ id }" label="Slug" required help="Used in the URL, e.g. /policies/community-guidelines.">
          <input :id="id" v-model="newPolicy.slug" type="text" class="input font-mono" maxlength="96" required />
        </FormField>
        <FormField v-slot="{ id }" label="Kind">
          <select :id="id" v-model="newPolicy.kind" class="input">
            <option value="custom">Custom</option>
            <option value="terms">Terms & conditions</option>
            <option value="privacy">Privacy</option>
            <option value="refund">Refund</option>
            <option value="content">Content policy</option>
          </select>
        </FormField>
      </div>

      <template #footer>
        <button type="button" class="btn-secondary" @click="modal = false">Cancel</button>
        <button type="submit" class="btn-primary" :disabled="saving">Create</button>
      </template>
    </ModalDialog>
  </div>
</template>
