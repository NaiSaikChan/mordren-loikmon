import { chunkRanges, PDF_CHUNK_BYTES } from '@/lib/pdfStream'

describe('chunkRanges', () => {
  it('covers the whole file exactly once, in order', () => {
    const size = PDF_CHUNK_BYTES * 3 + 1234
    const ranges = chunkRanges(size)
    expect(ranges[0].position).toBe(0)
    expect(ranges.reduce((n, r) => n + r.length, 0)).toBe(size)
    ranges.forEach((range, i) => {
      if (i > 0) expect(range.position).toBe(ranges[i - 1].position + ranges[i - 1].length)
    })
    const last = ranges[ranges.length - 1]
    expect(last.position + last.length).toBe(size)
  })

  it('keeps every slice but the last aligned to 3 bytes, so base64 chunks are unpadded', () => {
    const ranges = chunkRanges(PDF_CHUNK_BYTES * 2 + 7)
    expect(PDF_CHUNK_BYTES % 3).toBe(0)
    ranges.slice(0, -1).forEach((range) => expect(range.length % 3).toBe(0))
  })

  it('handles a file smaller than one chunk', () => {
    expect(chunkRanges(10)).toEqual([{ position: 0, length: 10 }])
  })

  it('returns nothing for an empty or unknown size', () => {
    expect(chunkRanges(0)).toEqual([])
    expect(chunkRanges(Number.NaN)).toEqual([])
  })
})
