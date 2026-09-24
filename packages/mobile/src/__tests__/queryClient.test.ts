import { ApiError } from '@loikmon/api'
import { retryDelay, shouldRetry } from '@/lib/queryClient'

describe('shouldRetry', () => {
  it('retries network errors, timeouts, rate limits and 5xx', () => {
    expect(shouldRetry(0, new ApiError('offline', 0, 'NETWORK_ERROR'))).toBe(true)
    expect(shouldRetry(0, new ApiError('timeout', 408, 'HTTP_408'))).toBe(true)
    expect(shouldRetry(1, new ApiError('slow down', 429, 'RATE_LIMITED'))).toBe(true)
    expect(shouldRetry(2, new ApiError('boom', 503, 'SERVICE_UNAVAILABLE'))).toBe(true)
  })

  it('does not retry 4xx (the request itself is wrong, or the session ended)', () => {
    expect(shouldRetry(0, new ApiError('nope', 401, 'UNAUTHORIZED'))).toBe(false)
    expect(shouldRetry(0, new ApiError('nope', 403, 'SUBSCRIPTION_REQUIRED'))).toBe(false)
    expect(shouldRetry(0, new ApiError('missing', 404, 'NOT_FOUND'))).toBe(false)
  })

  it('gives up after 3 failures', () => {
    expect(shouldRetry(3, new ApiError('boom', 500, 'INTERNAL_ERROR'))).toBe(false)
    expect(shouldRetry(3, new Error('x'))).toBe(false)
  })

  it('retries unknown (non-API) errors', () => {
    expect(shouldRetry(0, new Error('parse'))).toBe(true)
  })
})

describe('retryDelay', () => {
  afterEach(() => jest.restoreAllMocks())

  it('backs off exponentially from 1s', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5) // no jitter
    expect(retryDelay(0)).toBe(1000)
    expect(retryDelay(1)).toBe(2000)
    expect(retryDelay(2)).toBe(4000)
  })

  it('caps at 15s', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5)
    expect(retryDelay(10)).toBe(15_000)
  })

  it('adds ±20% jitter', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0)
    expect(retryDelay(1)).toBe(1600)
    jest.spyOn(Math, 'random').mockReturnValue(0.999999)
    expect(retryDelay(1)).toBe(2400)
  })
})
