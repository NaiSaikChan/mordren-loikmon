import { ref, shallowRef, toValue, type MaybeRefOrGetter } from 'vue'
import { books as booksApi, errorCode, errorMessage } from '@loikmon/api'
import type { BookFileResponse } from '@loikmon/api'
import { lockReasonFromError, type LockReason } from '@/utils/access'

export type BookFormat = 'pdf' | 'epub'

/** Storage answers expired/invalid signed URLs with 401/403 (S3/MinIO) or 410. */
export function isExpiredUrlStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 410
}

/** Refresh a little before the signed URL actually expires. */
const EXPIRY_MARGIN_MS = 15_000

/**
 * Requests short-lived signed URLs for a book file. The URL is never taken
 * from the book object: `books.getFileUrl` is the only source, and it answers
 * LOGIN_REQUIRED / SUBSCRIPTION_REQUIRED when the viewer has no access.
 */
export function useBookFile(bookId: MaybeRefOrGetter<string | number>) {
  const file       = shallowRef<BookFileResponse | null>(null)
  const loading    = ref(false)
  const lockReason = ref<LockReason | null>(null)
  const error      = ref<{ code: string; message: string } | null>(null)
  let requestedFormat: BookFormat | undefined

  function isExpiring(): boolean {
    if (!file.value?.expires_at) return false
    const expiresAt = Date.parse(file.value.expires_at)
    return Number.isFinite(expiresAt) && expiresAt - EXPIRY_MARGIN_MS <= Date.now()
  }

  /** Asks the server for a signed URL. Omit `format` to let the server pick (EPUB first). */
  async function request(format?: BookFormat): Promise<BookFileResponse | null> {
    requestedFormat = format
    loading.value = true
    lockReason.value = null
    error.value = null
    try {
      const { data } = await booksApi.getFileUrl(toValue(bookId), format)
      file.value = data
      return data
    } catch (err) {
      file.value = null
      lockReason.value = lockReasonFromError(err)
      if (!lockReason.value) error.value = { code: errorCode(err), message: errorMessage(err) }
      return null
    } finally {
      loading.value = false
    }
  }

  /** Re-requests a signed URL for the same format. Resolves to the new URL, or null when access was lost. */
  async function refresh(): Promise<string | null> {
    const next = await request(file.value?.format ?? requestedFormat)
    return next?.url ?? null
  }

  /**
   * Downloads the file. When the signed URL has expired (or storage rejects it
   * with 401/403/410) a fresh URL is requested once and the download retried.
   */
  async function fetchBytes(): Promise<ArrayBuffer> {
    let url = file.value?.url ?? null
    let refreshed = false
    if (!url || isExpiring()) {
      url = await refresh()
      refreshed = true
    }
    if (!url) throw new Error(error.value?.message ?? 'File not available')

    let response = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store' })
    if (!response.ok && isExpiredUrlStatus(response.status) && !refreshed) {
      url = await refresh()
      if (!url) throw new Error(error.value?.message ?? 'File not available')
      response = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store' })
    }
    if (!response.ok) throw new Error(`Failed to download file: ${response.status}`)
    return response.arrayBuffer()
  }

  return { file, loading, lockReason, error, request, refresh, fetchBytes }
}
