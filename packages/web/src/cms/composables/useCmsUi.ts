import { ref } from 'vue'
import { useCmsSessionStore } from '@/cms/stores/session'

/** Thin wrapper so templates read `can('books.edit')` instead of touching the store. */
export function usePermissions() {
  const session = useCmsSessionStore()
  return {
    session,
    can: (...required: string[]) => session.can(...required),
    canAny: (...required: string[]) => session.canAny(...required),
    isOwnScope: session.isOwnScope,
  }
}

export interface ConfirmRequest {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

interface PendingConfirm extends ConfirmRequest {
  resolve: (value: boolean) => void
}

const pending = ref<PendingConfirm | null>(null)

/**
 * Promise-based confirmation. `ConfirmDialog` (mounted once in the CMS layout)
 * renders whatever is pending, so a call site just awaits the answer.
 */
export function useConfirm() {
  function confirm(request: ConfirmRequest): Promise<boolean> {
    // A second request while one is open resolves the first as "cancelled".
    pending.value?.resolve(false)
    return new Promise<boolean>((resolve) => {
      pending.value = { ...request, resolve }
    })
  }

  function answer(value: boolean) {
    pending.value?.resolve(value)
    pending.value = null
  }

  return { pending, confirm, answer }
}

/** Escapes a CSV cell per RFC 4180 so commas and quotes survive a round trip. */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export interface CsvColumn<T> {
  key: string
  label: string
  value?: (row: T) => unknown
}

/** Builds a CSV file in the browser and hands it to the user as a download. */
export function downloadCsv<T>(filename: string, columns: CsvColumn<T>[], rows: T[]): void {
  const header = columns.map((c) => csvCell(c.label)).join(',')
  const body = rows
    .map((row) => columns.map((c) => csvCell(c.value ? c.value(row) : (row as Record<string, unknown>)[c.key])).join(','))
    .join('\r\n')
  // The BOM makes Excel open UTF-8 (Mon script included) correctly.
  const blob = new Blob([`﻿${header}\r\n${body}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/**
 * Prints a fragment of the current page. The CMS stylesheet hides everything
 * outside `[data-print-root]` while printing, which is also how "export as PDF"
 * works: the browser's print dialog offers "Save as PDF".
 */
export function printSection(elementId: string): void {
  const root = document.getElementById(elementId)
  if (!root) return
  root.setAttribute('data-print-root', '')
  document.body.classList.add('cms-printing')
  const cleanup = () => {
    root.removeAttribute('data-print-root')
    document.body.classList.remove('cms-printing')
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  window.print()
}

/** `1234` cents → `$12.34`. */
export function formatMoney(cents: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format((cents ?? 0) / 100)
}

export function formatNumber(value: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale).format(value ?? 0)
}

export function formatDate(value: string | Date | null | undefined, withTime = false): string {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

/** "3 days ago" / "in 2 hours" for audit rows and ticket queues. */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit)
  }
  return formatter.format(seconds, 'second')
}

export function formatDuration(totalSeconds: number | null | undefined): string {
  if (!totalSeconds) return '—'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return hours ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

/** ISO string for `input[type=datetime-local]`, and back. */
export function toLocalInput(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
