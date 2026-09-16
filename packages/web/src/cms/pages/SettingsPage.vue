<script setup lang="ts">
import { computed, ref } from 'vue'
import { cms } from '@loikmon/api'
import type { CmsSetting } from '@loikmon/api'
import FormField from '@/cms/components/FormField.vue'
import MediaPicker from '@/cms/components/MediaPicker.vue'
import PageHeader from '@/cms/components/PageHeader.vue'
import { useToastStore } from '@/cms/stores/toast'

/**
 * Website settings.
 *
 * The seeded rows define the schema — an unknown key is rejected by the API —
 * so this screen renders whatever the server reports, choosing a control from
 * the value's type and the key's naming convention.
 */
const toast = useToastStore()

const settings = ref<CmsSetting[]>([])
const loading = ref(true)
const saving = ref(false)
const edits = ref<Record<string, unknown>>({})

const GROUP_LABELS: Record<string, { label: string; description: string }> = {
  branding: { label: 'Branding', description: 'Name, tagline and logo used across the site and in e-mails.' },
  seo: { label: 'SEO', description: 'Defaults for page titles, descriptions and social previews.' },
  social: { label: 'Social profiles', description: 'Links shown in the footer and on author pages.' },
  email: { label: 'E-mail', description: 'Addresses used for support and replies. Not shown publicly.' },
  features: { label: 'Feature toggles', description: 'Switch parts of the storefront on and off.' },
  general: { label: 'General', description: '' },
}

async function load() {
  loading.value = true
  try {
    const { data } = await cms.settings.all()
    settings.value = data.settings
    edits.value = {}
  } catch (err) {
    toast.failure(err, 'Could not load the settings')
  } finally {
    loading.value = false
  }
}
void load()

const groups = computed(() => {
  const byGroup = new Map<string, CmsSetting[]>()
  for (const setting of settings.value) {
    const list = byGroup.get(setting.group) ?? []
    list.push(setting)
    byGroup.set(setting.group, list)
  }
  return [...byGroup.entries()].map(([key, items]) => ({
    key,
    ...(GROUP_LABELS[key] ?? { label: key, description: '' }),
    items,
  }))
})

const dirty = computed(() => Object.keys(edits.value).length > 0)

function valueOf(setting: CmsSetting): unknown {
  return setting.key in edits.value ? edits.value[setting.key] : setting.value
}

function update(setting: CmsSetting, value: unknown) {
  if (JSON.stringify(value) === JSON.stringify(setting.value)) {
    const next = { ...edits.value }
    delete next[setting.key]
    edits.value = next
  } else {
    edits.value = { ...edits.value, [setting.key]: value }
  }
}

/** The control a setting gets, inferred from its value and key. */
function kindOf(setting: CmsSetting): 'boolean' | 'image' | 'color' | 'list' | 'url' | 'text' {
  if (typeof setting.value === 'boolean') return 'boolean'
  if (setting.key.endsWith('_key')) return 'image'
  if (setting.key.endsWith('_color')) return 'color'
  if (Array.isArray(setting.value)) return 'list'
  if (setting.group === 'social' || setting.key.includes('url')) return 'url'
  return 'text'
}

function label(setting: CmsSetting): string {
  const name = setting.key.split('.').pop() ?? setting.key
  return name.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

async function save() {
  if (!dirty.value) return
  saving.value = true
  try {
    const { data } = await cms.settings.update(edits.value)
    settings.value = data.settings
    edits.value = {}
    toast.success('Settings saved')
  } catch (err) {
    toast.failure(err, 'Could not save the settings')
  } finally {
    saving.value = false
  }
}

function discard() {
  edits.value = {}
}
</script>

<template>
  <div>
    <PageHeader title="Website settings" description="Branding, SEO, e-mail and feature toggles.">
      <template #actions>
        <button v-if="dirty" type="button" class="btn-ghost h-9" @click="discard">Discard</button>
        <button type="button" class="btn-primary h-9" :disabled="!dirty || saving" @click="save">
          {{ saving ? 'Saving…' : dirty ? `Save ${Object.keys(edits).length} change(s)` : 'Saved' }}
        </button>
      </template>
    </PageHeader>

    <div v-if="loading" class="space-y-4">
      <div v-for="n in 3" :key="n" class="skeleton h-48 w-full" />
    </div>

    <div v-else class="space-y-4">
      <section v-for="group in groups" :key="group.key" class="card p-4">
        <header class="mb-4">
          <h2 class="section-title text-base">{{ group.label }}</h2>
          <p v-if="group.description" class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{{ group.description }}</p>
        </header>

        <div class="grid gap-4 sm:grid-cols-2">
          <template v-for="setting in group.items" :key="setting.key">
            <!-- Toggles read better as a full-width row with their explanation -->
            <div
              v-if="kindOf(setting) === 'boolean'"
              class="flex items-start gap-3 rounded-lg border border-gray-200 p-3 sm:col-span-2 dark:border-gray-700"
            >
              <input
                :id="setting.key"
                type="checkbox"
                class="mt-0.5 rounded text-brand-600"
                :checked="Boolean(valueOf(setting))"
                @change="update(setting, ($event.target as HTMLInputElement).checked)"
              />
              <label :for="setting.key" class="min-w-0 flex-1">
                <span class="block text-sm font-medium text-gray-800 dark:text-gray-100">{{ label(setting) }}</span>
                <span class="block font-mono text-xs text-gray-400">{{ setting.key }}</span>
              </label>
              <span v-if="setting.key in edits" class="badge-yellow shrink-0">changed</span>
            </div>

            <FormField
              v-else
              v-slot="{ id }"
              :label="label(setting)"
              :help="setting.is_public ? undefined : 'Private — never sent to the storefront.'"
              :class="kindOf(setting) === 'image' ? 'sm:col-span-2' : ''"
            >
              <MediaPicker
                v-if="kindOf(setting) === 'image'"
                :model-value="(valueOf(setting) as string | null) ?? null"
                kind="thumbnail"
                :label="label(setting)"
                @update:model-value="update(setting, $event)"
              />

              <input
                v-else-if="kindOf(setting) === 'color'"
                :id="id"
                type="color"
                class="input h-10 w-24 p-1"
                :value="(valueOf(setting) as string) || '#4f46e5'"
                @input="update(setting, ($event.target as HTMLInputElement).value)"
              />

              <input
                v-else-if="kindOf(setting) === 'list'"
                :id="id"
                type="text"
                class="input"
                :value="(valueOf(setting) as string[] | null)?.join(', ') ?? ''"
                placeholder="comma, separated, values"
                @input="update(setting, ($event.target as HTMLInputElement).value.split(',').map((v) => v.trim()).filter(Boolean))"
              />

              <input
                v-else
                :id="id"
                :type="kindOf(setting) === 'url' ? 'url' : 'text'"
                class="input"
                :value="(valueOf(setting) as string | null) ?? ''"
                :placeholder="kindOf(setting) === 'url' ? 'https://' : ''"
                @input="update(setting, ($event.target as HTMLInputElement).value || null)"
              />
            </FormField>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>
