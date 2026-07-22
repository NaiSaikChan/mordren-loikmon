import type { Book, Article, Author } from '@loikmon/api'

/**
 * Response normalizers.
 *
 * The loikmon.org endpoints are inconsistent: some return a bare array, some
 * wrap results in `{ books: [...] }`, some nest under `{ data: { books } }`.
 * These helpers centralise that parsing so hooks/screens stay simple, mirroring
 * the web app's Pinia stores.
 */

type AnyRecord = Record<string, unknown>

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export function parseBooks(body: unknown): Book[] {
  if (Array.isArray(body)) return body as Book[]
  const b = (body ?? {}) as AnyRecord
  return asArray<Book>(b.books ?? (b.data as AnyRecord)?.books ?? b.items)
}

export function parseArticles(body: unknown): Article[] {
  if (Array.isArray(body)) return body as Article[]
  const b = (body ?? {}) as AnyRecord
  return asArray<Article>(b.articles ?? (b.data as AnyRecord)?.articles ?? b.items)
}

export function parseAuthors(body: unknown): Author[] {
  if (Array.isArray(body)) return body as Author[]
  const b = (body ?? {}) as AnyRecord
  return asArray<Author>(b.authors ?? (b.data as AnyRecord)?.authors ?? b.items)
}

export function parseBookDetail(body: unknown): Book | null {
  const b = (body ?? {}) as AnyRecord
  return ((b.book ?? (b.data as AnyRecord)?.book) as Book | undefined) ?? null
}

export function parseArticleDetail(body: unknown): Article | null {
  const b = (body ?? {}) as AnyRecord
  return ((b.article ?? (b.data as AnyRecord)?.article) as Article | undefined) ?? null
}

export function parseTotal(body: unknown): number {
  const b = (body ?? {}) as AnyRecord
  const t = b.total ?? (b.data as AnyRecord)?.total ?? b.count ?? (b.data as AnyRecord)?.count
  return t != null ? Number(t) : 0
}

/** Loikmon "free" heuristic: is_free flag OR price/amount is missing/zero. */
export function isFree(item: Record<string, unknown>): boolean {
  const price = item.amount ?? item.price
  return Boolean(item.is_free) || price == null || Number(price) === 0
}
