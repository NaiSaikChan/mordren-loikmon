import { useWindowDimensions } from 'react-native'

/**
 * Auto-layout responsive column count for grid lists.
 * Targets a card width of ~150px and clamps between `min` and `max`.
 */
export function useResponsiveColumns(target = 160, min = 2, max = 6): number {
  const { width } = useWindowDimensions()
  const cols = Math.floor(width / target)
  return Math.max(min, Math.min(max, cols || min))
}
