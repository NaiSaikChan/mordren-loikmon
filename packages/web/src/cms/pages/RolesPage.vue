<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { cms } from '@loikmon/api'
import type { CmsRole, PermissionGroup, RoleScope } from '@loikmon/api'
import FormField from '@/cms/components/FormField.vue'
import ModalDialog from '@/cms/components/ModalDialog.vue'
import PageHeader from '@/cms/components/PageHeader.vue'
import { useConfirm } from '@/cms/composables/useCmsUi'
import { useCmsSessionStore } from '@/cms/stores/session'
import { useToastStore } from '@/cms/stores/toast'

/**
 * Role editor.
 *
 * Permissions are a fixed vocabulary defined in the backend; roles are data, so
 * an administrator can build a custom role (say, "Audio editor") without a
 * deployment. The scope decides whether a role reaches the whole catalogue or
 * only the holder's own author profiles.
 */
const session = useCmsSessionStore()
const toast = useToastStore()
const { confirm } = useConfirm()

const roles = ref<CmsRole[]>([])
const groups = ref<PermissionGroup[]>([])
const loading = ref(true)
const saving = ref(false)

async function load() {
  loading.value = true
  try {
    const [roleList, permissions] = await Promise.all([cms.roles.list(), cms.roles.permissions()])
    roles.value = roleList.data.roles
    groups.value = permissions.data.groups
  } catch (err) {
    toast.failure(err, 'Could not load the roles')
  } finally {
    loading.value = false
  }
}
void load()

// ── Editor ──────────────────────────────────────────────────────────────────

const modal = ref(false)
const form = reactive({
  id: null as number | null,
  key: '',
  name: '',
  description: '',
  scope: 'all' as RoleScope,
  rank: 150,
  permissions: [] as string[],
  isSystem: false,
})

function open(role?: CmsRole) {
  Object.assign(form, {
    id: role?.id ?? null,
    key: role?.role_key ?? '',
    name: role?.name ?? '',
    description: role?.description ?? '',
    scope: role?.scope ?? 'all',
    rank: role?.rank ?? 150,
    permissions: role ? [...role.permissions] : [],
    isSystem: role?.is_system ?? false,
  })
  modal.value = true
}

/** The administrator role always holds everything; its list is read-only. */
const locked = computed(() => form.key === 'admin')

function toggleGroup(group: PermissionGroup) {
  const all = group.permissions.every((p) => form.permissions.includes(p))
  form.permissions = all
    ? form.permissions.filter((p) => !group.permissions.includes(p))
    : [...new Set([...form.permissions, ...group.permissions])]
}

function groupState(group: PermissionGroup): 'none' | 'some' | 'all' {
  const count = group.permissions.filter((p) => form.permissions.includes(p)).length
  return count === 0 ? 'none' : count === group.permissions.length ? 'all' : 'some'
}

async function save() {
  if (!form.name.trim() || (!form.id && !form.key.trim())) {
    toast.failure(new Error('A key and a name are required'), 'Role not saved')
    return
  }
  saving.value = true
  try {
    if (form.id) {
      await cms.roles.update(form.id, {
        name: form.name,
        description: form.description || null,
        // System roles keep their scope and rank; the API rejects changes anyway.
        ...(form.isSystem ? {} : { scope: form.scope, rank: form.rank }),
        ...(locked.value ? {} : { permissions: form.permissions }),
      })
    } else {
      await cms.roles.create({
        key: form.key,
        name: form.name,
        description: form.description || null,
        scope: form.scope,
        rank: form.rank,
        permissions: form.permissions,
      })
    }
    modal.value = false
    await load()
    // A change to your own role changes your own menu.
    await session.load(true)
    toast.success(form.id ? 'Role updated' : 'Role created')
  } catch (err) {
    toast.failure(err, 'Could not save the role')
  } finally {
    saving.value = false
  }
}

async function remove(role: CmsRole) {
  const ok = await confirm({
    title: `Delete the “${role.name}” role?`,
    message: role.users_count
      ? `${role.users_count} account(s) still hold it — reassign them first or this will fail.`
      : 'This cannot be undone.',
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return
  try {
    await cms.roles.remove(role.id)
    await load()
    toast.success('Role deleted')
  } catch (err) {
    toast.failure(err, 'Could not delete the role')
  }
}

const totalPermissions = computed(() => groups.value.reduce((sum, g) => sum + g.permissions.length, 0))
</script>

<template>
  <div>
    <PageHeader
      title="Roles & permissions"
      description="Permissions are fixed in the platform; roles are yours to define."
      :count="roles.length"
    >
      <template #actions>
        <button type="button" class="btn-primary h-9" @click="open()">New role</button>
      </template>
    </PageHeader>

    <div v-if="loading" class="grid gap-3 md:grid-cols-2">
      <div v-for="n in 4" :key="n" class="skeleton h-44 w-full" />
    </div>

    <ul v-else class="grid gap-3 md:grid-cols-2">
      <li v-for="role in roles" :key="role.id" class="card p-4">
        <div class="flex items-start gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="truncate text-base font-semibold text-gray-900 dark:text-white">{{ role.name }}</h2>
              <code class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs dark:bg-gray-800">{{ role.role_key }}</code>
              <span v-if="role.is_system" class="badge-gray">system</span>
              <span v-if="role.scope === 'own'" class="badge-yellow">own content</span>
            </div>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ role.description || 'No description' }}</p>
          </div>
        </div>

        <div class="mt-3 flex items-center gap-2">
          <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              class="h-full bg-brand-500"
              :style="{ width: `${totalPermissions ? (role.permissions.length / totalPermissions) * 100 : 0}%` }"
            />
          </div>
          <span class="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">
            {{ role.permissions.length }}/{{ totalPermissions }}
          </span>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <span class="text-xs text-gray-500 dark:text-gray-400">
            {{ role.users_count }} account{{ role.users_count === 1 ? '' : 's' }}
          </span>
          <div class="ml-auto flex gap-1">
            <button type="button" class="btn-ghost h-7 px-2 text-xs" @click="open(role)">
              {{ role.role_key === 'admin' ? 'View' : 'Edit' }}
            </button>
            <button
              v-if="!role.is_system"
              type="button"
              class="btn-ghost h-7 px-2 text-xs text-red-600"
              @click="remove(role)"
            >
              Delete
            </button>
          </div>
        </div>
      </li>
    </ul>

    <ModalDialog
      :open="modal"
      size="xl"
      :title="form.id ? `Edit “${form.name}”` : 'New role'"
      :description="locked ? 'The administrator role always holds every permission.' : undefined"
      :busy="saving"
      @close="modal = false"
      @submit="save"
    >
      <div class="space-y-5">
        <div class="grid gap-3 sm:grid-cols-4">
          <FormField v-slot="{ id }" label="Name" required class="sm:col-span-2">
            <input :id="id" v-model="form.name" type="text" class="input" maxlength="128" required />
          </FormField>

          <FormField v-slot="{ id }" label="Key" required :help="form.id ? 'Fixed once created.' : 'Lowercase identifier.'">
            <input :id="id" v-model="form.key" type="text" class="input font-mono" maxlength="64" :disabled="Boolean(form.id)" required />
          </FormField>

          <FormField v-slot="{ id }" label="Rank" help="Highest rank becomes the primary role.">
            <input :id="id" v-model.number="form.rank" type="number" min="1" max="399" class="input" :disabled="form.isSystem" />
          </FormField>

          <FormField v-slot="{ id }" label="Description" class="sm:col-span-3">
            <input :id="id" v-model="form.description" type="text" class="input" maxlength="255" />
          </FormField>

          <FormField v-slot="{ id }" label="Scope" help="'Own' limits every action to the holder's author profiles.">
            <select :id="id" v-model="form.scope" class="input" :disabled="form.isSystem">
              <option value="all">Whole catalogue</option>
              <option value="own">Own content only</option>
            </select>
          </FormField>
        </div>

        <fieldset :disabled="locked">
          <legend class="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            Permissions ({{ form.permissions.length }}/{{ totalPermissions }})
          </legend>

          <div class="grid gap-3 sm:grid-cols-2">
            <div v-for="group in groups" :key="group.key" class="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
              <div class="mb-2 flex items-center justify-between gap-2">
                <p class="text-sm font-medium text-gray-800 dark:text-gray-100">{{ group.label }}</p>
                <button
                  type="button"
                  class="btn-ghost h-6 px-2 text-xs"
                  :disabled="locked"
                  @click="toggleGroup(group)"
                >
                  {{ groupState(group) === 'all' ? 'Clear' : 'Select all' }}
                </button>
              </div>
              <ul class="space-y-1">
                <li v-for="permission in group.permissions" :key="permission">
                  <label class="flex cursor-pointer items-center gap-2 text-xs">
                    <input v-model="form.permissions" type="checkbox" :value="permission" class="rounded text-brand-600" />
                    <code class="font-mono text-gray-600 dark:text-gray-300">{{ permission }}</code>
                  </label>
                </li>
              </ul>
            </div>
          </div>
        </fieldset>
      </div>

      <template #footer>
        <button type="button" class="btn-secondary" @click="modal = false">Cancel</button>
        <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save role' }}</button>
      </template>
    </ModalDialog>
  </div>
</template>
