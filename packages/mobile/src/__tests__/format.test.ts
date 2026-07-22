import { detectFormat } from '@/lib/format'

describe('detectFormat', () => {
  it('detects PDF', () => {
    expect(detectFormat('https://loikmon.org/a.pdf')).toBe('pdf')
    expect(detectFormat('https://loikmon.org/a.PDF?token=1')).toBe('pdf')
  })
  it('detects EPUB', () => {
    expect(detectFormat('https://loikmon.org/a.epub')).toBe('epub')
  })
  it('returns unknown otherwise', () => {
    expect(detectFormat('https://loikmon.org/a.txt')).toBe('unknown')
  })
})
