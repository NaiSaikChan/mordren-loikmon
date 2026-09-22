<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'

/**
 * Accessible modal: focus moves in on open, Tab is trapped inside, Escape and
 * the backdrop close it, and focus returns to whatever opened it.
 */
const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description?: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
    /** Set while a save is in flight: closing is blocked and the footer shows a spinner. */
    busy?: boolean
    closeOnBackdrop?: boolean
  }>(),
  { size: 'md', busy: false, closeOnBackdrop: true },
)

const emit = defineEmits<{ close: []; submit: [] }>()

const panel = useTemplateRef<HTMLElement>('panel')
const titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`
let lastFocused: HTMLElement | null = null

const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }

const focusables = () =>
  Array.from(
    panel.value?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? [],
  ).filter((el) => el.offsetParent !== null)

function onKeydown(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key === 'Escape' && !props.busy) {
    event.stopPropagation()
    emit('close')
    return
  }
  if (event.key !== 'Tab') return
  const items = focusables()
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  const active = document.activeElement as HTMLElement | null
  if (event.shiftKey && (active === first || !panel.value?.contains(active))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      lastFocused = document.activeElement as HTMLElement | null
      document.addEventListener('keydown', onKeydown, true)
      document.body.style.overflow = 'hidden'
      await nextTick()
      focusables()[0]?.focus()
    } else {
      document.removeEventListener('keydown', onKeydown, true)
      document.body.style.overflow = ''
      lastFocused?.focus?.()
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown, true)
  document.body.style.overflow = ''
})

const submitting = ref(false)
function onSubmit() {
  if (props.busy || submitting.value) return
  emit('submit')
}

/**
 * `:user-invalid` is visual only, so mirror it onto `aria-invalid` for
 * assistive tech: on blur/input for interactive feedback, and on the native
 * `invalid` event (fired per-control, doesn't bubble) when a submit attempt
 * fails constraint validation.
 */
function syncAriaInvalid(target: EventTarget | null) {
  const el = target as (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) | null
  if (!el || typeof el.checkValidity !== 'function' || !el.hasAttribute('required')) return
  // NOTE: don't call this from an `invalid` handler — checkValidity() re-fires
  // `invalid` on a still-invalid control, causing infinite recursion. Use
  // markAriaInvalid there instead, since that event only fires when invalid.
  if (el.checkValidity()) el.removeAttribute('aria-invalid')
  else el.setAttribute('aria-invalid', 'true')
}

function markAriaInvalid(target: EventTarget | null) {
  const el = target as HTMLElement | null
  el?.setAttribute?.('aria-invalid', 'true')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6 print:hidden">
        <div class="fixed inset-0 bg-black/50" @click="closeOnBackdrop && !busy && emit('close')" />

        <div
          ref="panel"
          class="relative my-8 w-full rounded-2xl bg-white shadow-2xl dark:bg-surface-900"
          :class="widths[size]"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
        >
          <form
            @submit.prevent="onSubmit"
            @blur.capture="syncAriaInvalid($event.target)"
            @input="syncAriaInvalid($event.target)"
            @change="syncAriaInvalid($event.target)"
            @invalid.capture="markAriaInvalid($event.target)"
          >
            <header class="flex items-start gap-4 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <div class="min-w-0 flex-1">
                <h2 :id="titleId" class="truncate text-base font-semibold text-gray-900 dark:text-white">{{ title }}</h2>
                <p v-if="description" class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ description }}</p>
              </div>
              <button
                type="button"
                class="btn-ghost -mr-2 -mt-1 rounded-lg p-2 text-lg leading-none"
                aria-label="Close dialog"
                :disabled="busy"
                @click="emit('close')"
              >
                ×
              </button>
            </header>

            <div class="max-h-[70vh] overflow-y-auto px-5 py-4">
              <slot />
            </div>

            <footer
              v-if="$slots.footer"
              class="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-800"
            >
              <slot name="footer" :busy="busy" />
            </footer>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.15s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
