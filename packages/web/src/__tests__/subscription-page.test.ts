/**
 * Subscription page — plans from `subscriptions.fetchPlans()`, status from
 * `subscriptions.getStatus()`, store links, and the anonymous view.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { SubscriptionStatusResponse } from '@loikmon/api'
import { activeEntitlement, inactiveEntitlement, makePlans, makeUser, mountWithApp, response } from './helpers'

const mockFetchPlans = vi.fn()
const mockGetStatus = vi.fn()
const mockMe = vi.fn()

vi.mock('@loikmon/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@loikmon/api')>()
  return {
    ...actual,
    subscriptions: {
      ...actual.subscriptions,
      fetchPlans: (...a: unknown[]) => mockFetchPlans(...a),
      getStatus: (...a: unknown[]) => mockGetStatus(...a),
    },
    auth: { ...actual.auth, me: (...a: unknown[]) => mockMe(...a) },
  }
})

import SubscriptionPage from '@/pages/SubscriptionPage.vue'
import { useAuthStore } from '@/stores/auth'
import { useSubscriptionStore } from '@/stores/subscription'

const manageUrls = {
  app_store: 'https://apps.apple.com/account/subscriptions',
  google_play: 'https://play.google.com/store/account/subscriptions?package=org.loikmon.mobile',
}

function statusResponse(entitlement = activeEntitlement(), subscriptions: SubscriptionStatusResponse['subscriptions'] = []): SubscriptionStatusResponse {
  return { status: 'ok', entitlement, account_token: 'user-1', subscriptions, manage_urls: manageUrls }
}

function signedIn() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore(pinia)
  auth.token = 'tok-1'
  auth.user = makeUser()
  auth.entitlement = inactiveEntitlement
  return pinia
}

describe('SubscriptionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockFetchPlans.mockReturnValue(response({ status: 'ok', plans: makePlans(), platforms: { ios: true, android: true, web: false } }))
  })

  it('shows the four plans with prices, per-month price and savings', async () => {
    const { wrapper } = await mountWithApp(SubscriptionPage, { path: '/subscription' })

    const plans = wrapper.findAll('[data-testid="subscription-plan"]')
    expect(plans.map((p) => p.attributes('data-plan'))).toEqual(['monthly', 'quarterly', 'semiannual', 'yearly'])
    expect(plans.map((p) => p.find('[data-testid="subscription-plan-price"]').text())).toEqual(['$4.00', '$10.00', '$20.00', '$45.00'])
    expect(plans[1].text()).toContain('$3.33 / month')
    expect(plans[1].text()).toContain('Save 17%')
    expect(plans[3].text()).toContain('Billed every year')
    expect(plans[0].text()).not.toContain('Save')
  })

  it('anonymous users see plans, a sign-in prompt and the app store links — no status request', async () => {
    const { wrapper } = await mountWithApp(SubscriptionPage, { path: '/subscription' })

    expect(mockGetStatus).not.toHaveBeenCalled()
    const signIn = wrapper.find('[data-testid="subscription-signin"]')
    expect(signIn.exists()).toBe(true)
    expect(signIn.find('a').attributes('href')).toContain('/auth?redirect=/subscription')

    const cta = wrapper.find('[data-testid="subscription-cta"]')
    expect(cta.text()).toContain('Subscribe in the Loikmon app')
    expect(cta.text()).toContain("Subscriptions can't be purchased on the website.")
    expect(wrapper.find('[data-testid="store-google-play"]').attributes('href')).toBe('https://play.google.com/store/apps/details?id=org.loikmon.mobile')
    expect(wrapper.find('[data-testid="store-app-store"]').attributes('href')).toMatch(/^https:\/\/apps\.apple\.com\//)
  })

  it('renders an active, auto-renewing Google Play subscription with its manage link', async () => {
    const pinia = signedIn()
    mockGetStatus.mockReturnValue(response(statusResponse(activeEntitlement({ plan_code: 'quarterly' }))))

    const { wrapper } = await mountWithApp(SubscriptionPage, { path: '/subscription', pinia })

    expect(mockGetStatus).toHaveBeenCalledTimes(1)
    const status = wrapper.find('[data-testid="subscription-status"]')
    expect(status.text()).toContain('Premium active')
    expect(wrapper.find('[data-testid="subscription-status-label"]').text()).toBe('Active')
    expect(status.text()).toContain('3 Months')
    expect(status.text()).toMatch(/Renews on 15 October 2026/)
    expect(status.text()).toContain('Google Play')
    expect(wrapper.find('[data-testid="subscription-manage"]').attributes('href')).toBe(manageUrls.google_play)
    // Syncs the entitlement into the auth store (sidebar badge, card locks).
    expect(useAuthStore(pinia).isSubscribed).toBe(true)
    // The current plan is highlighted.
    const quarterly = wrapper.findAll('[data-testid="subscription-plan"]').find((p) => p.attributes('data-plan') === 'quarterly')
    expect(quarterly?.text()).toContain('Your plan')
  })

  it('explains a canceled App Store subscription that is still active until expiry', async () => {
    const pinia = signedIn()
    mockGetStatus.mockReturnValue(response(statusResponse(activeEntitlement({ platform: 'app_store', status: 'canceled', auto_renew: false }))))

    const { wrapper } = await mountWithApp(SubscriptionPage, { path: '/subscription', pinia })

    expect(wrapper.find('[data-testid="subscription-status-label"]').text()).toBe('Canceled')
    expect(wrapper.find('[data-testid="subscription-status-note"]').text()).toContain('You canceled auto-renew')
    expect(wrapper.find('[data-testid="subscription-status"]').text()).toMatch(/Access until 15 October 2026/)
    expect(wrapper.find('[data-testid="subscription-manage"]').attributes('href')).toBe(manageUrls.app_store)
  })

  it.each([
    ['grace_period', 'Grace period', "Google Play couldn't charge your payment method"],
    ['billing_retry', 'Payment problem', "Google Play couldn't renew your subscription"],
  ] as const)('explains the %s state', async (state, label, note) => {
    const pinia = signedIn()
    const entitlement = activeEntitlement({ status: state, in_grace_period: state === 'grace_period' })
    if (state === 'billing_retry') entitlement.active = false
    mockGetStatus.mockReturnValue(response(statusResponse(entitlement)))

    const { wrapper } = await mountWithApp(SubscriptionPage, { path: '/subscription', pinia })

    expect(wrapper.find('[data-testid="subscription-status-label"]').text()).toBe(label)
    expect(wrapper.find('[data-testid="subscription-status-note"]').text()).toContain(note)
  })

  it('shows the most recent expired subscription when nothing grants access', async () => {
    const pinia = signedIn()
    mockGetStatus.mockReturnValue(response(statusResponse(inactiveEntitlement, [
      { id: 's-old', plan_code: 'monthly', platform: 'google_play', product_id: null, status: 'expired', auto_renew: false, environment: 'production', started_at: null, expires_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
      { id: 's-new', plan_code: 'yearly', platform: 'app_store', product_id: null, status: 'expired', auto_renew: false, environment: 'production', started_at: null, expires_at: '2026-08-01T12:00:00.000Z', updated_at: '2026-08-01T12:00:00.000Z' },
    ])))

    const { wrapper } = await mountWithApp(SubscriptionPage, { path: '/subscription', pinia })

    const status = wrapper.find('[data-testid="subscription-status"]')
    expect(status.text()).toContain("You don't have an active subscription.")
    expect(wrapper.find('[data-testid="subscription-status-label"]').text()).toBe('Expired')
    expect(status.text()).toContain('Yearly')
    expect(status.text()).toMatch(/Expired on 1 August 2026/)
  })

  it('refreshes the status on demand (subscribed on the phone)', async () => {
    const pinia = signedIn()
    mockGetStatus
      .mockReturnValueOnce(response(statusResponse(inactiveEntitlement)))
      .mockReturnValueOnce(response(statusResponse(activeEntitlement())))
    mockMe.mockReturnValue(response({ status: 'ok', user: makeUser(), entitlement: activeEntitlement() }))

    const { wrapper } = await mountWithApp(SubscriptionPage, { path: '/subscription', pinia })
    expect(wrapper.text()).toContain("You don't have an active subscription.")

    await wrapper.find('[data-testid="subscription-refresh"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Premium active'))
    expect(useSubscriptionStore(pinia).status?.entitlement.active).toBe(true)
  })
})
