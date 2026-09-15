import * as SecureStore from 'expo-secure-store'
import { getSessionToken, isSessionRejected, isUsableToken, resolveApiBase, setSessionToken } from '@/services/api'

const getItem = SecureStore.getItemAsync as jest.Mock

describe('isUsableToken', () => {
  it('rejects the fake `local:` tokens of the legacy app', () => {
    expect(isUsableToken('local:42')).toBe(false)
    expect(isUsableToken('')).toBe(false)
    expect(isUsableToken(null)).toBe(false)
    expect(isUsableToken('Zk3v9a.bearer-token')).toBe(true)
  })
})

describe('isSessionRejected', () => {
  it('signs out only for an expired/revoked session', () => {
    expect(isSessionRejected({ status: 401, code: 'UNAUTHORIZED' })).toBe(true)
    expect(isSessionRejected({ status: 401, code: 'LOGIN_REQUIRED' })).toBe(true)
    // Wrong password on delete-account / change-password is also a 401.
    expect(isSessionRejected({ status: 401, code: 'INVALID_CREDENTIALS' })).toBe(false)
    expect(isSessionRejected({ status: 403, code: 'SUBSCRIPTION_REQUIRED' })).toBe(false)
  })
})

describe('session token', () => {
  it('reads secure storage once, ignores legacy tokens and caches updates', async () => {
    getItem.mockResolvedValueOnce('local:7')
    expect(await getSessionToken()).toBeNull()
    await setSessionToken('real-token')
    expect(await getSessionToken()).toBe('real-token')
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('token', 'real-token')
    await setSessionToken(null)
    expect(await getSessionToken()).toBeNull()
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('token')
    expect(getItem).toHaveBeenCalledTimes(1)
  })
})

describe('resolveApiBase', () => {
  const original = process.env.EXPO_PUBLIC_API_BASE
  afterEach(() => {
    process.env.EXPO_PUBLIC_API_BASE = original
  })

  it('prefers EXPO_PUBLIC_API_BASE and strips trailing slashes', () => {
    process.env.EXPO_PUBLIC_API_BASE = 'http://10.0.2.2:4001/api/v1/'
    expect(resolveApiBase()).toBe('http://10.0.2.2:4001/api/v1')
  })

  it('falls back to the production API', () => {
    delete process.env.EXPO_PUBLIC_API_BASE
    expect(resolveApiBase()).toMatch(/^https:\/\/api\.loikmon\.org\/api\/v1$|^https?:\/\//)
  })
})
