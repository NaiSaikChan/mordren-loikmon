/**
 * @jest-environment jsdom
 */
import { flush, renderHook } from '@/test-utils/renderHook'
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider, useAuth, useEntitlementActive } from '@/context/AuthContext'
import { queryClient } from '@/lib/queryClient'

const mockLogin = jest.fn()
const mockMe = jest.fn()
const mockLogout = jest.fn()

jest.mock('@loikmon/api', () => ({
  ...jest.requireActual('@loikmon/api'),
  auth: {
    login: (...a: unknown[]) => mockLogin(...a),
    me: (...a: unknown[]) => mockMe(...a),
    logout: (...a: unknown[]) => mockLogout(...a),
  },
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockLogout.mockResolvedValue(undefined)
})

describe('AuthProvider', () => {
  it('re-renders only the consumers that read `loading` while a login runs', async () => {
    let resolveLogin!: (value: unknown) => void
    mockLogin.mockReturnValue(new Promise((resolve) => (resolveLogin = resolve)))
    const renders = { loadingReader: 0, sessionReader: 0, badge: 0 }
    let api!: ReturnType<typeof useAuth>
    const seenLoading: boolean[] = []

    function LoadingReader() {
      const auth = useAuth()
      renders.loadingReader++
      const { loading } = auth
      useEffect(() => {
        seenLoading.push(loading)
      }, [loading])
      api = auth
      return null
    }
    function SessionReader() {
      const { isLoggedIn } = useAuth()
      renders.sessionReader++
      void isLoggedIn
      return null
    }
    function Badge() {
      useEntitlementActive()
      renders.badge++
      return null
    }

    const root = createRoot(document.createElement('div'))
    await act(async () => {
      root.render(
        <AuthProvider>
          <LoadingReader />
          <SessionReader />
          <Badge />
        </AuthProvider>,
      )
    })
    await flush()
    const before = { ...renders }

    let login!: Promise<void>
    await act(async () => {
      login = api.login({ email: 'a@b.c', password: 'x' })
    })
    expect(seenLoading.at(-1)).toBe(true)
    // The flag flip did not touch components that never read it.
    expect(renders.sessionReader).toBe(before.sessionReader)
    expect(renders.badge).toBe(before.badge)

    await act(async () => {
      resolveLogin({ data: { token: 'tok', user: { id: 'u1', email: 'a@b.c' }, entitlement: { active: false } } })
      await login
    })
    expect(seenLoading.at(-1)).toBe(false)
    expect(api.isLoggedIn).toBe(true)
    // Entitlement didn't change (inactive → inactive): the badge never re-rendered.
    expect(renders.badge).toBe(before.badge)

    // Logging out drops every cached query of the previous account.
    queryClient.setQueryData(['book', '1', 'u1:0'], { id: 1 })
    await act(async () => {
      await api.logout()
    })
    expect(queryClient.getQueryData(['book', '1', 'u1:0'])).toBeUndefined()
    expect(api.isLoggedIn).toBe(false)
    act(() => root.unmount())
  })

  it('useAuth outside the provider throws', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(renderHook(() => useAuth())).rejects.toThrow('useAuth must be used within an AuthProvider')
    spy.mockRestore()
  })
})
