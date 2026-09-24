<script setup lang="ts">
import { computed, ref } from 'vue'

/** Chip-style tag entry. Enter or comma commits, Backspace on an empty box removes the last chip. */
const props = withDefaults(
  defineProps<{ modelValue: string[]; suggestions?: string[]; max?: number; placeholder?: string; id?: string }>(),
  { max: 30, placeholder: 'Add a tag and press Enter' },
)

const emit = defineEmits<{ 'update:modelValue': [tags: string[]] }>()

const draft = ref('')
const listId = `tags-${Math.random().toString(36).slice(2, 9)}`

const available = computed(() => (props.suggestions ?? []).filter((s) => !props.modelValue.includes(s)).slice(0, 50))

function add(raw: string) {
  const value = raw.trim().replace(/,+$/, '')
  if (!value || props.modelValue.includes(value) || props.modelValue.length >= props.max) {
    draft.value = ''
    return
  }
  emit('update:modelValue', [...props.modelValue, value])
  draft.value = ''
}

function remove(tag: string) {
  emit('update:modelValue', props.modelValue.filter((t) => t !== tag))
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    add(draft.value)
  } else if (event.key === 'Backspace' && !draft.value && props.modelValue.length) {
    remove(props.modelValue[props.modelValue.length - 1])
  }
}
</script>

<template>
  <div
    class="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2 py-1.5 focus-within:ring-2 focus-within:ring-brand-500 dark:border-gray-600 dark:bg-surface-800"
  >
    <span
      v-for="tag in modelValue"
      :key="tag"
      class="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
    >
      {{ tag }}
      <button type="button" class="leading-none opacity-60 hover:opacity-100" :aria-label="`Remove tag ${tag}`" @click="remove(tag)">
        ×
      </button>
    </span>

    <input
      :id="id"
      v-model="draft"
      type="text"
      class="min-w-32 flex-1 border-0 bg-transparent p-0 text-sm focus:outline-none focus:ring-0 dark:text-gray-100"
      :placeholder="modelValue.length >= max ? `Limit of ${max} tags reached` : placeholder"
      :disabled="modelValue.length >= max"
      :list="available.length ? listId : undefined"
      @keydown="onKeydown"
      @blur="add(draft)"
    />

    <datalist v-if="available.length" :id="listId">
      <option v-for="suggestion in available" :key="suggestion" :value="suggestion" />
    </datalist>
  </div>
</template>
