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

describe('streamToViewer', () => {
  const { streamToViewer } = jest.requireActual('@/lib/pdfStream') as typeof import('@/lib/pdfStream')

  it('begins with the size and start page, sends every slice, then finishes', async () => {
    const injected: string[] = []
    const readSlice = jest.fn(async (position: number, length: number) => `${position}:${length}`)
    const done = await streamToViewer({ size: 10, startPage: 7, chunk: 3, readSlice, inject: (c) => injected.push(c) })
    expect(done).toBe(true)
    expect(injected[0]).toContain('__pdfBegin(10,7)')
    expect(injected.filter((c) => c.includes('__pdfChunk'))).toHaveLength(4)
    expect(injected[injected.length - 1]).toContain('__pdfDone(10)')
  })

  it('starts at the top for a missing or invalid page', async () => {
    const injected: string[] = []
    await streamToViewer({ size: 3, startPage: Number.NaN, readSlice: async () => 'AAAA', inject: (c) => injected.push(c) })
    expect(injected[0]).toContain('__pdfBegin(3,1)')
  })

  it('stops without __pdfDone when aborted mid-stream', async () => {
    const controller = new AbortController()
    const injected: string[] = []
    const readSlice = jest.fn(async () => {
      controller.abort()
      return 'AAAA'
    })
    const done = await streamToViewer({ size: 9, chunk: 3, readSlice, inject: (c) => injected.push(c), signal: controller.signal })
    expect(done).toBe(false)
    expect(injected.some((c) => c.includes('__pdfDone'))).toBe(false)
    expect(readSlice).toHaveBeenCalledTimes(1)
  })

  it('rejects an empty file', async () => {
    await expect(streamToViewer({ size: 0, readSlice: async () => '', inject: () => undefined })).rejects.toThrow(
      'The file is empty',
    )
  })
})
