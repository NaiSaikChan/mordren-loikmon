import { ApiError, getClient } from '@loikmon/api'
import { initApiClient, setSessionToken, setUnauthorizedHandler } from '@/services/api'

/** Axios adapter answering every request with a session-ended 401. */
function rejectAll(config: any) {
  return Promise.reject(
    Object.assign(new Error('Request failed with status code 401'), {
      isAxiosError: true,
      config,
      response: { status: 401, data: { status: 'error', code: 'UNAUTHORIZED', message: 'expired' }, headers: {}, config },
    }),
  )
}

describe('unauthorized handling', () => {
  const onSignOut = jest.fn<void, [ApiError]>()

  beforeAll(() => {
    initApiClient()
    getClient().defaults.adapter = rejectAll
    setUnauthorizedHandler(onSignOut)
  })

  beforeEach(() => onSignOut.mockClear())

  it('signs out when the current session is rejected', async () => {
    await setSessionToken('current-token')
    await getClient().get('auth/me').catch(() => {})
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })

  it('ignores a late 401 from a token that was replaced (re-login / password change)', async () => {
    await setSessionToken('old-token')
    const inFlight = getClient().get('library', { headers: { Authorization: 'Bearer old-token' } })
    await setSessionToken('new-token')
    await inFlight.catch(() => {})
    expect(onSignOut).not.toHaveBeenCalled()
  })
})
