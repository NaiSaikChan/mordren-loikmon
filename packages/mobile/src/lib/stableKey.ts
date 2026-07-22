/**
 * Produces a deterministic string key from a params object for use as a hook
 * dependency. Unlike a plain `JSON.stringify`, object keys are sorted
 * recursively so that `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` yield the same key,
 * preventing needless re-fetches when property order varies between renders.
 */
export function stableKey(value: unknown): string {
  return JSON.stringify(sortValue(value ?? {}))
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue)
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortValue(obj[key])
        return acc
      }, {})
  }
  return value
}
