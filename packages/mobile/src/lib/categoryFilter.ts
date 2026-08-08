/** Returns true when an item's category field matches the target ID string. */
export function matchesCategory(item: { category?: unknown }, targetId: string): boolean {
  return String(item.category ?? '') === targetId
}

/** Removes items with duplicate `id` fields, keeping first occurrence. */
export function deduplicateById<T extends { id: unknown }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = String(item.id)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
