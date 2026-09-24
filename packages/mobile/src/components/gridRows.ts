/** Split a list into fixed-size rows for grid sections inside a SectionList/FlatList. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size))
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += n) rows.push(items.slice(i, i + n))
  return rows
}
