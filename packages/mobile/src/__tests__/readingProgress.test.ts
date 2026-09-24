import {
  READING_SAVE_INTERVAL_MS,
  createReadingProgressReporter,
  epubCfiFrom,
  loadReadingPosition,
  localPositionKey,
  newerPosition,
  normalizePosition,
  parseTimestamp,
  pdfPageFrom,
  pdfPosition,
} from '@/lib/readingProgress'

const mockGetJSON = jest.fn()
const mockSetJSON = jest.fn()

jest.mock('@/services/storage', () => ({
  storage: {
    getJSON: (...a: unknown[]) => mockGetJSON(...a),
    setJSON: (...a: unknown[]) => mockSetJSON(...a),
  },
}))


beforeEach(() => {
  mockGetJSON.mockReset()
  mockSetJSON.mockReset().mockResolvedValue(undefined)
})

describe('normalizePosition (backward compatibility)', () => {
  it('accepts the current shape', () => {
    expect(normalizePosition({ location: 'epubcfi(/6/4!/4/2)', progress: 12.5, updatedAt: 1000 })).toEqual({
      location: 'epubcfi(/6/4!/4/2)',
      progress: 12.5,
      updatedAt: 1000,
    })
  })

  it('treats a save without updatedAt as oldest, and coerces numeric pages and string decimals', () => {
    expect(normalizePosition({ location: 42, progress: '37.50' })).toEqual({ location: '42', progress: 37.5, updatedAt: 0 })
  })

  it('reads server rows (updated_at) including MySQL datetime strings', () => {
    const row = { format: 'pdf', location: '3', progress: 10, updated_at: '2026-09-20 10:00:00.000' }
    expect(normalizePosition(row)?.updatedAt).toBe(Date.parse('2026-09-20T10:00:00.000Z'))
    expect(parseTimestamp('2026-09-20T10:00:00.000Z')).toBe(Date.parse('2026-09-20T10:00:00.000Z'))
    expect(parseTimestamp('garbage')).toBe(0)
  })

  it('rejects rows without a location and clamps progress', () => {
    expect(normalizePosition({ location: null, progress: 50 })).toBeNull()
    expect(normalizePosition({ location: '  ' })).toBeNull()
    expect(normalizePosition(null)).toBeNull()
    expect(normalizePosition({ location: 'x', progress: 180 })?.progress).toBe(100)
    expect(normalizePosition({ location: 'x', progress: -3 })?.progress).toBe(0)
  })
})

describe('newerPosition', () => {
  const a = { location: 'a', progress: 10, updatedAt: 100 }
  const b = { location: 'b', progress: 20, updatedAt: 200 }
  it('picks the newer copy', () => {
    expect(newerPosition(a, b)).toBe(b)
    expect(newerPosition(b, a)).toBe(b)
  })
  it('prefers the first (server) copy on a tie and handles missing copies', () => {
    const tie = { ...b, location: 'c' }
    expect(newerPosition(b, tie)).toBe(b)
    expect(newerPosition(null, a)).toBe(a)
    expect(newerPosition(a, null)).toBe(a)
    expect(newerPosition(null, null)).toBeNull()
  })
})

describe('loadReadingPosition', () => {
  const serverRows = (rows: unknown[]) => jest.fn().mockResolvedValue({ data: { status: 'ok', progress: rows } })

  it('uses only the device copy when signed out', async () => {
    mockGetJSON.mockResolvedValue({ location: '5', progress: 50, updatedAt: 10 })
    const getProgress = jest.fn()
    await expect(loadReadingPosition(7, 'pdf', false, getProgress)).resolves.toEqual({
      location: '5',
      progress: 50,
      updatedAt: 10,
    })
    expect(getProgress).not.toHaveBeenCalled()
    expect(mockGetJSON).toHaveBeenCalledWith(localPositionKey(7, 'pdf'))
  })

  it('newer server copy wins over the device copy', async () => {
    mockGetJSON.mockResolvedValue({ location: '5', progress: 50, updatedAt: Date.parse('2026-01-01T00:00:00Z') })
    const getProgress = serverRows([
      { format: 'epub', location: 'epubcfi(/6/2)', progress: 1, updated_at: '2026-06-01T00:00:00Z' },
      { format: 'pdf', location: '9', progress: 90, updated_at: '2026-06-01T00:00:00Z' },
    ])
    const position = await loadReadingPosition(7, 'pdf', true, getProgress)
    expect(position?.location).toBe('9')
  })

  it('newer device copy wins over the server copy (read offline, synced later)', async () => {
    mockGetJSON.mockResolvedValue({ location: '12', progress: 60, updatedAt: Date.parse('2026-07-01T00:00:00Z') })
    const getProgress = serverRows([{ format: 'pdf', location: '9', progress: 45, updated_at: '2026-06-01T00:00:00Z' }])
    expect((await loadReadingPosition(7, 'pdf', true, getProgress))?.location).toBe('12')
  })

  it('falls back to the device copy when the server fails, and to null when nothing is stored', async () => {
    mockGetJSON.mockResolvedValueOnce({ location: '3', progress: 1, updatedAt: 1 })
    const failing = jest.fn().mockRejectedValue(new Error('offline'))
    expect((await loadReadingPosition(7, 'pdf', true, failing))?.location).toBe('3')

    mockGetJSON.mockRejectedValueOnce(new Error('storage broken'))
    await expect(loadReadingPosition(7, 'pdf', true, failing)).resolves.toBeNull()
  })
})

describe('createReadingProgressReporter', () => {
  function setup(loggedIn = true) {
    let clock = 1_000_000
    const timers: { fn: () => void; at: number }[] = []
    const save = jest.fn().mockResolvedValue({ data: { status: 'ok' } })
    const reporter = createReadingProgressReporter({
      bookId: 42,
      format: 'epub',
      isLoggedIn: () => loggedIn,
      save,
      now: () => clock,
      setTimer: (fn, ms) => {
        const t = { fn, at: clock + ms }
        timers.push(t)
        return t
      },
      clearTimer: (handle) => {
        const i = timers.indexOf(handle as (typeof timers)[number])
        if (i >= 0) timers.splice(i, 1)
      },
    })
    const advance = async (ms: number) => {
      clock += ms
      for (const t of [...timers]) {
        if (t.at <= clock) {
          timers.splice(timers.indexOf(t), 1)
          t.fn()
        }
      }
      await Promise.resolve()
    }
    return { reporter, save, advance, timers }
  }

  it('sends the first report at once, then at most once per interval with a trailing write', async () => {
    const { reporter, save, advance } = setup()
    reporter.report('epubcfi(/6/2)', 1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenLastCalledWith('42', { format: 'epub', location: 'epubcfi(/6/2)', progress: 1 })

    await advance(1_000)
    reporter.report('epubcfi(/6/4)', 2)
    reporter.report('epubcfi(/6/6)', 3)
    expect(save).toHaveBeenCalledTimes(1)

    await advance(READING_SAVE_INTERVAL_MS)
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith('42', { format: 'epub', location: 'epubcfi(/6/6)', progress: 3 })
  })

  it('writes the device copy on every report, with a timestamp', () => {
    const { reporter } = setup()
    reporter.report('epubcfi(/6/2)', 5)
    reporter.report('epubcfi(/6/4)', 6)
    expect(mockSetJSON).toHaveBeenCalledTimes(2)
    expect(mockSetJSON).toHaveBeenLastCalledWith(localPositionKey(42, 'epub'), {
      location: 'epubcfi(/6/4)',
      progress: 6,
      updatedAt: expect.any(Number),
    })
  })

  it('flush sends the pending position immediately and cancels the scheduled send', async () => {
    const { reporter, save, advance, timers } = setup()
    reporter.report('a', 1)
    await advance(10)
    reporter.report('b', 2)
    expect(timers).toHaveLength(1)
    await reporter.flush()
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith('42', { format: 'epub', location: 'b', progress: 2 })
    expect(timers).toHaveLength(0)
    await reporter.flush()
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('never calls the server when signed out, and swallows server failures', async () => {
    const signedOut = setup(false)
    signedOut.reporter.report('a', 1)
    await signedOut.reporter.flush()
    expect(signedOut.save).not.toHaveBeenCalled()
    expect(mockSetJSON).toHaveBeenCalled()

    const failing = setup()
    failing.save.mockRejectedValue(new Error('500'))
    failing.reporter.report('a', 1)
    await expect(failing.reporter.flush()).resolves.toBeUndefined()
  })

  it('ignores reports after dispose', () => {
    const { reporter, save } = setup()
    reporter.dispose()
    reporter.report('a', 1)
    expect(save).not.toHaveBeenCalled()
    expect(mockSetJSON).not.toHaveBeenCalled()
  })
})

describe('format helpers', () => {
  it('maps PDF pages to location + percent and back', () => {
    expect(pdfPosition(5, 20)).toEqual({ location: '5', progress: 25 })
    expect(pdfPosition(0, 20)).toBeNull()
    expect(pdfPageFrom({ location: '5', progress: 25, updatedAt: 0 })).toBe(5)
    expect(pdfPageFrom({ location: '1', progress: 0, updatedAt: 0 })).toBeNull()
    expect(pdfPageFrom({ location: 'epubcfi(/6/2)', progress: 0, updatedAt: 0 })).toBeNull()
  })

  it('only restores real CFIs for EPUB', () => {
    expect(epubCfiFrom({ location: 'epubcfi(/6/2)', progress: 0, updatedAt: 0 })).toBe('epubcfi(/6/2)')
    expect(epubCfiFrom({ location: 'chapter1.xhtml', progress: 0, updatedAt: 0 })).toBeNull()
    expect(epubCfiFrom(null)).toBeNull()
  })
})
