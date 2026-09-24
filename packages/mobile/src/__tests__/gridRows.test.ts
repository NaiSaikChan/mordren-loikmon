import { chunk } from '@/components/gridRows'

describe('chunk', () => {
  it('splits into rows, keeping a short last row', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
  it('handles empty input and invalid sizes', () => {
    expect(chunk([], 3)).toEqual([])
    expect(chunk([1, 2], 0)).toEqual([[1], [2]])
  })
})
