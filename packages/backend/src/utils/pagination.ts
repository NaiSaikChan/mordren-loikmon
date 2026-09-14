export interface PageMeta {
  page: number
  limit: number
  total: number
  pages: number
}

export function buildPageMeta(page: number, limit: number, total: number): PageMeta {
  return { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
}

export function clampPage(page: unknown, fallback = 0): number {
  const n = Number(page)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback
}

export function clampLimit(limit: unknown, fallback = 20, max = 100): number {
  const n = Number(limit)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(Math.floor(n), max)
}
