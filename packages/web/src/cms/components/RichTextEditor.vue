<script setup lang="ts">
import DOMPurify from 'dompurify'
import { onMounted, ref, useTemplateRef, watch } from 'vue'

/**
 * Rich-text editor for article bodies and policy text.
 *
 * Built on `contenteditable` plus `document.execCommand` rather than a new
 * dependency. Everything read out of the editor and everything written into it
 * passes through DOMPurify; the server sanitises again on save, so pasted
 * markup can never become stored script.
 */
const props = withDefaults(
  defineProps<{ modelValue: string; placeholder?: string; minHeight?: number; disabled?: boolean }>(),
  { placeholder: 'Write the body…', minHeight: 320, disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [html: string] }>()

const editor = useTemplateRef<HTMLDivElement>('editor')
const showSource = ref(false)
const source = ref(props.modelValue)

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'hr', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'mark', 'small',
    'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a', 'img',
    'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'title', 'class', 'colspan', 'rowspan', 'start'],
}

const clean = (html: string) => DOMPurify.sanitize(html, PURIFY_CONFIG)

function sync() {
  if (!editor.value) return
  const html = clean(editor.value.innerHTML)
  source.value = html
  emit('update:modelValue', html)
}

/** Only write into the DOM when the value changed elsewhere; otherwise the caret jumps. */
watch(
  () => props.modelValue,
  (value) => {
    source.value = value
    if (editor.value && clean(editor.value.innerHTML) !== value) editor.value.innerHTML = clean(value ?? '')
  },
)

onMounted(() => {
  if (editor.value) editor.value.innerHTML = clean(props.modelValue ?? '')
})

// `execCommand` is deprecated but remains the only cross-browser way to drive
// contenteditable without pulling in an editor framework.
function run(command: string, value?: string) {
  if (props.disabled) return
  editor.value?.focus()
  document.execCommand(command, false, value)
  sync()
}

function createLink() {
  const url = window.prompt('Link URL (https://…)')
  if (!url) return
  if (!/^(https?:\/\/|mailto:|\/)/i.test(url)) {
    window.alert('Only http(s), mailto and site-relative links are allowed.')
    return
  }
  run('createLink', url)
}

/** Paste as plain text so Word and Google Docs markup never enters the body. */
function onPaste(event: ClipboardEvent) {
  event.preventDefault()
  const text = event.clipboardData?.getData('text/plain') ?? ''
  document.execCommand('insertText', false, text)
  sync()
}

function applySource() {
  const html = clean(source.value)
  emit('update:modelValue', html)
  if (editor.value) editor.value.innerHTML = html
  showSource.value = false
}

const TOOLS: Array<{ command: string; value?: string; label: string; icon: string }> = [
  { command: 'bold', label: 'Bold', icon: 'B' },
  { command: 'italic', label: 'Italic', icon: 'I' },
  { command: 'underline', label: 'Underline', icon: 'U' },
  { command: 'formatBlock', value: 'h2', label: 'Heading 2', icon: 'H2' },
  { command: 'formatBlock', value: 'h3', label: 'Heading 3', icon: 'H3' },
  { command: 'formatBlock', value: 'p', label: 'Paragraph', icon: '¶' },
  { command: 'insertUnorderedList', label: 'Bullet list', icon: '••' },
  { command: 'insertOrderedList', label: 'Numbered list', icon: '1.' },
  { command: 'formatBlock', value: 'blockquote', label: 'Quote', icon: '❝' },
  { command: 'removeFormat', label: 'Clear formatting', icon: '⌫' },
]
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-gray-300 dark:border-gray-700">
    <div
      class="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-gray-700 dark:bg-surface-800"
      role="toolbar"
      aria-label="Formatting"
    >
      <button
        v-for="tool in TOOLS"
        :key="tool.label"
        type="button"
        class="h-7 min-w-7 rounded px-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"
        :title="tool.label"
        :aria-label="tool.label"
        :disabled="disabled"
        @click.prevent="run(tool.command, tool.value)"
      >
        {{ tool.icon }}
      </button>
      <button
        type="button"
        class="h-7 min-w-7 rounded px-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"
        title="Insert link"
        aria-label="Insert link"
        :disabled="disabled"
        @click.prevent="createLink"
      >
        🔗
      </button>

      <span class="mx-1 h-4 w-px bg-gray-300 dark:bg-gray-600" aria-hidden="true" />

      <button
        type="button"
        class="h-7 rounded px-2 text-xs font-medium"
        :class="showSource ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'"
        :aria-pressed="showSource"
        @click.prevent="showSource ? applySource() : (showSource = true)"
      >
        {{ showSource ? 'Apply HTML' : 'HTML' }}
      </button>
    </div>

    <textarea
      v-if="showSource"
      v-model="source"
      class="w-full resize-y border-0 bg-white p-3 font-mono text-xs leading-relaxed text-gray-900 focus:outline-none dark:bg-surface-900 dark:text-gray-100"
      :style="{ minHeight: `${minHeight}px` }"
      spellcheck="false"
      aria-label="HTML source"
    />

    <div
      v-else
      ref="editor"
      class="prose prose-sm max-w-none bg-white p-4 focus:outline-none dark:prose-invert dark:bg-surface-900"
      :style="{ minHeight: `${minHeight}px` }"
      :contenteditable="!disabled"
      role="textbox"
      aria-multiline="true"
      :aria-label="placeholder"
      :data-placeholder="placeholder"
      @input="sync"
      @blur="sync"
      @paste="onPaste"
    />
  </div>
</template>

<style scoped>
[contenteditable]:empty::before {
  content: attr(data-placeholder);
  color: rgb(156 163 175);
  pointer-events: none;
}
</style>
