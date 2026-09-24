import type { Purchase } from 'expo-iap'
import {
  REJECTION_BASE_BACKOFF_MS,
  REJECTION_MAX_BACKOFF_MS,
  backedOffKeys,
  isBackedOff,
  pruneRejections,
  recordRejection,
  selectRetryCandidates,
} from '@/lib/iap'

const androidPurchase = (token: string, acknowledged = false) =>
  ({ productId: 'loikmon_premium', purchaseToken: token, purchaseState: 'purchased', isAcknowledgedAndroid: acknowledged }) as unknown as Purchase

describe('rejected purchase back-off', () => {
  it('doubles the delay per rejection, capped at 7 days', () => {
    let log = recordRejection({}, 'tok', 0)
    expect(log.tok).toEqual({ attempts: 1, retryAt: REJECTION_BASE_BACKOFF_MS })
    log = recordRejection(log, 'tok', 0)
    expect(log.tok.retryAt).toBe(2 * REJECTION_BASE_BACKOFF_MS)
    for (let i = 0; i < 20; i++) log = recordRejection(log, 'tok', 0)
    expect(log.tok.retryAt).toBe(REJECTION_MAX_BACKOFF_MS)
  })

  it('is backed off until retryAt', () => {
    const log = recordRejection({}, 'tok', 1000)
    expect(isBackedOff(log, 'tok', 1000)).toBe(true)
    expect(isBackedOff(log, 'tok', 1000 + REJECTION_BASE_BACKOFF_MS)).toBe(false)
    expect(isBackedOff(log, 'other', 1000)).toBe(false)
    expect(backedOffKeys(log, 1000)).toEqual(new Set(['tok']))
  })

  it('an unacknowledged Android purchase that was just rejected is not re-verified on the next foreground', () => {
    const purchases = [androidPurchase('rejected'), androidPurchase('fresh')]
    const log = recordRejection({}, 'rejected', Date.now())
    const skus = new Set(['loikmon_premium'])
    const candidates = selectRetryCandidates(purchases, new Set(), 'android', skus, backedOffKeys(log, Date.now()))
    expect(candidates.map((p) => p.purchaseToken)).toEqual(['fresh'])
    // Without a skip set the behaviour is unchanged.
    expect(selectRetryCandidates(purchases, new Set(), 'android', skus)).toHaveLength(2)
  })

  it('prunes records, returning the same object when nothing changes', () => {
    const log = recordRejection(recordRejection({}, 'a', 0), 'b', 0)
    expect(pruneRejections(log, () => true)).toBe(log)
    expect(Object.keys(pruneRejections(log, (key) => key === 'a'))).toEqual(['a'])
  })
})
