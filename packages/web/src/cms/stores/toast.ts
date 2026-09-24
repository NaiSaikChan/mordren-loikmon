import { defineStore } from 'pinia'
import { ref } from 'vue'
import { errorMessage, isApiError } from '@loikmon/api'

export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
  /** Shown under the message — e.g. which permission an action needed. */
  detail?: string
  timeout: number
}

let nextId = 1

/** Transient notifications for CMS actions. Rendered by `ToastHost`. */
export const useToastStore = defineStore('cms-toast', () => {
  const toasts = ref<Toast[]>([])

  function push(kind: ToastKind, message: string, detail?: string, timeout = kind === 'error' ? 8000 : 4000) {
    const toast: Toast = { id: nextId++, kind, message, detail, timeout }
    toasts.value.push(toast)
    if (timeout > 0) {
      window.setTimeout(() => dismiss(toast.id), timeout)
    }
    return toast.id
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  const success = (message: string, detail?: string) => push('success', message, detail)
  const info = (message: string, detail?: string) => push('info', message, detail)

  /**
   * Turns an API rejection into a message a person can act on: a missing
   * permission names the permission, an ownership failure says so.
   */
  function failure(err: unknown, fallback = 'Something went wrong') {
    let detail: string | undefined
    if (isApiError(err)) {
      if (err.code === 'PERMISSION_DENIED') {
        const required = (err.details as { required?: string[] } | undefined)?.required
        detail = required?.length ? `Requires: ${required.join(', ')}` : undefined
      } else if (err.code === 'VALIDATION_ERROR') {
        const issues = err.details as Array<{ path: string; message: string }> | undefined
        detail = issues?.map((i) => `${i.path}: ${i.message}`).join(' · ')
      } else if (err.requestId) {
        detail = `Request ${err.requestId}`
      }
    }
    return push('error', errorMessage(err, fallback), detail)
  }

  return { toasts, push, dismiss, success, info, failure }
})
