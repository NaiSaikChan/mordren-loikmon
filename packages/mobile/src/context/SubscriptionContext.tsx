import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, Linking, Platform } from 'react-native'
import { router } from 'expo-router'
import {
  finishTransaction as storeFinishTransaction,
  getAvailablePurchases,
  restorePurchases as storeRestorePurchases,
  useIAP,
  type Purchase,
} from 'expo-iap'
import { errorMessage, storeSkus, subscriptions as subscriptionsApi } from '@loikmon/api'
import type { Entitlement, PlansResponse, SubscriptionStatusResponse } from '@loikmon/api'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { storage } from '@/services/storage'
import {
  buildSubscriptionRequest,
  isUserCancelled,
  mergePlansWithProducts,
  processPurchase,
  purchaseKey,
  resolveManageUrl,
  restoreWithBackend,
  selectRetryCandidates,
  storePlatformOf,
  type PlanOffer,
  type PurchaseOutcome,
  type StorePlatform,
} from '@/lib/iap'

/** Purchases whose backend verification failed transiently (retried on launch / foreground). */
const PENDING_VERIFICATION_KEY = 'iap_pending_verification'

interface SubscriptionContextValue {
  /** Backend plans merged with the store's localised products. */
  plans: PlanOffer[]
  /** Which platforms the server can verify purchases for. */
  platforms: PlansResponse['platforms'] | null
  storePlatform: StorePlatform | null
  /** The server can verify purchases from this device's store. */
  storeConfigured: boolean
  /** The native store connection is up. */
  connected: boolean
  entitlement: Entitlement | null
  status: SubscriptionStatusResponse | null
  loading: boolean
  /** Plan code being purchased. */
  purchasing: string | null
  restoring: boolean
  error: string | null
  notice: string | null
  manageUrl: string | null
  purchase: (planCode: string) => Promise<void>
  restore: () => Promise<void>
  refresh: () => Promise<void>
  openManageSubscription: () => Promise<void>
  clearMessages: () => void
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined)

/**
 * App-wide subscription state. Owns the single `useIAP` instance (and thus the
 * only purchase listener): purchase → backend verification → finishTransaction.
 */
export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n()
  const { isLoggedIn, user, entitlement, setEntitlement } = useAuth()
  const storePlatform = storePlatformOf(Platform.OS)

  const [plansResponse, setPlansResponse] = useState<PlansResponse | null>(null)
  const [status, setStatus] = useState<SubscriptionStatusResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loggedInRef = useRef(isLoggedIn)
  loggedInRef.current = isLoggedIn
  /** Product the user is buying right now (drives success/error UI). */
  const interactiveRef = useRef<{ productId: string } | null>(null)
  const inFlightRef = useRef(new Set<string>())
  /** Purchases delivered while signed out; verified once a session exists. */
  const deferredRef = useRef(new Map<string, Purchase>())
  const pendingKeysRef = useRef(new Set<string>())
  const handlePurchaseRef = useRef<(purchase: Purchase) => void>(() => undefined)

  const {
    connected,
    subscriptions: storeProducts,
    fetchProducts,
    requestPurchase,
    reconnect,
  } = useIAP({
    onPurchaseSuccess: (purchase) => handlePurchaseRef.current(purchase),
    onPurchaseError: (purchaseError) => {
      if (!interactiveRef.current) return
      interactiveRef.current = null
      setPurchasing(null)
      if (isUserCancelled(purchaseError)) return
      if (purchaseError.code === 'already-owned') setError(t('subscribe.alreadyOwned'))
      else if (purchaseError.code === 'deferred-payment' || purchaseError.code === 'pending') setNotice(t('subscribe.pendingPayment'))
      else setError(t('subscribe.purchaseFailed'))
    },
    onError: (storeError) => {
      if (__DEV__) console.warn('[subscriptions] store error:', storeError.message)
    },
  })

  const skuKey = plansResponse && storePlatform ? storeSkus(plansResponse.plans, storePlatform).join(',') : ''
  // Stable identity while the product ids stay the same (plans are re-fetched on every paywall visit).
  const skus = useMemo(() => (skuKey ? skuKey.split(',') : []), [skuKey])
  const storeConfigured = Boolean(storePlatform && plansResponse?.platforms[storePlatform])

  const plans = useMemo(
    () => mergePlansWithProducts(plansResponse?.plans ?? [], storeProducts, storePlatform),
    [plansResponse, storeProducts, storePlatform],
  )

  // ── Backend data ─────────────────────────────────────────────────────────

  const loadPlans = useCallback(async () => {
    const { data } = await subscriptionsApi.fetchPlans()
    setPlansResponse(data)
    return data
  }, [])

  const loadStatus = useCallback(async () => {
    if (!loggedInRef.current) {
      setStatus(null)
      return null
    }
    const { data } = await subscriptionsApi.getStatus()
    if (!loggedInRef.current) return null // signed out while the request was in flight
    setStatus(data)
    setEntitlement(data.entitlement)
    return data
  }, [setEntitlement])

  useEffect(() => {
    loadPlans().catch(() => undefined)
  }, [loadPlans])

  useEffect(() => {
    setError(null)
    setNotice(null)
    if (isLoggedIn) loadStatus().catch(() => undefined)
    else setStatus(null)
  }, [isLoggedIn, user?.id, loadStatus])

  useEffect(() => {
    storage
      .getJSON<string[]>(PENDING_VERIFICATION_KEY)
      .then((keys) => {
        for (const key of keys ?? []) pendingKeysRef.current.add(key)
      })
      .catch(() => undefined)
  }, [])

  const persistPendingKeys = useCallback(() => storage.setJSON(PENDING_VERIFICATION_KEY, [...pendingKeysRef.current]).catch(() => undefined), [])

  // ── Store products ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!connected || !storeConfigured || skus.length === 0) return
    fetchProducts({ skus, type: 'subs' }).catch(() => undefined)
  }, [connected, storeConfigured, skus, fetchProducts])

  // ── Purchase handling (verify → finish) ──────────────────────────────────

  const handlePurchase = useCallback(
    async (purchase: Purchase) => {
      if (!storePlatform) return
      const key = purchaseKey(purchase, storePlatform)
      if (!loggedInRef.current) {
        deferredRef.current.set(key, purchase)
        return
      }
      if (inFlightRef.current.has(key)) return
      inFlightRef.current.add(key)
      const interactive = interactiveRef.current?.productId === purchase.productId

      let outcome: PurchaseOutcome
      try {
        outcome = await processPurchase(purchase, {
          platform: storePlatform,
          verify: async (proof) => (await subscriptionsApi.verify(proof)).data,
          finishTransaction: storeFinishTransaction,
          onFinishError: (finishError) => {
            if (__DEV__) console.warn('[subscriptions] finishTransaction failed:', finishError)
          },
        })
      } finally {
        inFlightRef.current.delete(key)
        if (interactive) {
          interactiveRef.current = null
          setPurchasing(null)
        }
      }

      deferredRef.current.delete(key)
      switch (outcome.status) {
        case 'verified':
          setEntitlement(outcome.entitlement)
          if (pendingKeysRef.current.delete(key)) void persistPendingKeys()
          if (interactive) setNotice(t('subscribe.success'))
          loadStatus().catch(() => undefined)
          break
        case 'pending':
          if (interactive) setNotice(t('subscribe.pendingPayment'))
          break
        case 'retry':
          // Keep the store transaction unfinished; verify again later.
          pendingKeysRef.current.add(key)
          void persistPendingKeys()
          if (interactive) setNotice(t('subscribe.verifyLater'))
          break
        case 'rejected':
          if (pendingKeysRef.current.delete(key)) void persistPendingKeys()
          // Only surface errors for purchases the user is making right now; background
          // re-deliveries (e.g. on every launch) must not show a message each time.
          if (!interactive) break
          if (outcome.code === 'PURCHASE_ALREADY_LINKED') setError(t('subscribe.alreadyLinked'))
          else setError(errorMessage(outcome.error, t('subscribe.verifyFailed')))
          break
      }
    },
    [storePlatform, setEntitlement, persistPendingKeys, loadStatus, t],
  )
  handlePurchaseRef.current = (purchase) => void handlePurchase(purchase)

  /** Verify purchases that are still unfinished (after a network/store outage, or bought while signed out). */
  const retryUnfinished = useCallback(async () => {
    if (!storePlatform || !connected || !loggedInRef.current || !storeConfigured || skus.length === 0) return
    const deferred = [...deferredRef.current.values()]
    deferredRef.current.clear()
    for (const purchase of deferred) await handlePurchase(purchase)

    if (pendingKeysRef.current.size === 0 && storePlatform === 'ios') return
    let purchases: Purchase[]
    try {
      purchases = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true })
    } catch {
      return
    }
    const candidates = selectRetryCandidates(purchases, pendingKeysRef.current, storePlatform, new Set(skus))
    for (const purchase of candidates) await handlePurchase(purchase)

    // Forget remembered purchases the store no longer reports (expired, refunded).
    const present = new Set(purchases.map((purchase) => purchaseKey(purchase, storePlatform)))
    let changed = false
    for (const key of [...pendingKeysRef.current]) {
      if (!present.has(key)) {
        pendingKeysRef.current.delete(key)
        changed = true
      }
    }
    if (changed) void persistPendingKeys()
  }, [storePlatform, connected, storeConfigured, skus, handlePurchase, persistPendingKeys])

  // App start (store connected + session restored) …
  useEffect(() => {
    if (connected && isLoggedIn && storeConfigured) void retryUnfinished()
  }, [connected, isLoggedIn, storeConfigured, retryUnfinished])

  // … and every return to the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      if (loggedInRef.current) loadStatus().catch(() => undefined)
      void retryUnfinished()
    })
    return () => subscription.remove()
  }, [loadStatus, retryUnfinished])

  // ── Actions ──────────────────────────────────────────────────────────────

  const ensureConnected = useCallback(async () => {
    if (connected) return true
    return reconnect().catch(() => false)
  }, [connected, reconnect])

  const purchase = useCallback(
    async (planCode: string) => {
      setError(null)
      setNotice(null)
      if (!loggedInRef.current) {
        router.push('/(auth)/login')
        return
      }
      if (!storePlatform) {
        setError(t('subscribe.unsupportedPlatform'))
        return
      }
      if (!storeConfigured) {
        setError(t('subscribe.storeNotConfigured'))
        return
      }
      const offer = plans.find((item) => item.plan.code === planCode)
      if (!offer) return
      setPurchasing(planCode)
      try {
        if (!(await ensureConnected())) throw new Error(t('subscribe.storeUnavailable'))
        if (!offer.available) throw new Error(t('subscribe.productUnavailable'))
        // The account token must belong to the signed-in user: a status left over from a
        // previous account would link the store purchase to that other account.
        const current = status && status.account_token === user?.id ? status : await loadStatus()
        const request = current ? buildSubscriptionRequest(offer, storePlatform, current.account_token) : null
        if (!request || !offer.productId) throw new Error(t('subscribe.productUnavailable'))

        interactiveRef.current = { productId: offer.productId }
        const result = await requestPurchase(request)
        const delivered = Array.isArray(result) ? result.length > 0 : Boolean(result)
        // Nothing delivered (e.g. "Ask to Buy"): stop the spinner; the listener handles it later.
        if (!delivered && interactiveRef.current?.productId === offer.productId && !inFlightRef.current.size) {
          interactiveRef.current = null
          setPurchasing(null)
        }
      } catch (purchaseError) {
        interactiveRef.current = null
        setPurchasing(null)
        if (!isUserCancelled(purchaseError)) setError(errorMessage(purchaseError, t('subscribe.purchaseFailed')))
      }
    },
    [storePlatform, storeConfigured, plans, ensureConnected, status, user?.id, loadStatus, requestPurchase, t],
  )

  const restore = useCallback(async () => {
    setError(null)
    setNotice(null)
    if (!loggedInRef.current) {
      router.push('/(auth)/login')
      return
    }
    if (!storePlatform || !storeConfigured) {
      setError(t(storePlatform ? 'subscribe.storeNotConfigured' : 'subscribe.unsupportedPlatform'))
      return
    }
    setRestoring(true)
    try {
      if (!(await ensureConnected())) throw new Error(t('subscribe.storeUnavailable'))
      await storeRestorePurchases().catch(() => undefined)
      const purchases = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true })
      const outcome = await restoreWithBackend(purchases, {
        platform: storePlatform,
        skus: new Set(skus),
        restore: async (proofs) => (await subscriptionsApi.restore(proofs)).data,
        finishTransaction: storeFinishTransaction,
      })
      if (outcome.entitlement) setEntitlement(outcome.entitlement)
      if (outcome.nothingToRestore) setNotice(t('subscribe.nothingToRestore'))
      else if (outcome.restored > 0) setNotice(t('subscribe.restored'))
      else if (outcome.alreadyLinked) setError(t('subscribe.alreadyLinked'))
      else setError(outcome.failures[0]?.message || t('subscribe.restoreFailed'))
      await loadStatus().catch(() => undefined)
    } catch (restoreError) {
      if (!isUserCancelled(restoreError)) setError(errorMessage(restoreError, t('subscribe.restoreFailed')))
    } finally {
      setRestoring(false)
    }
  }, [storePlatform, storeConfigured, ensureConnected, skus, setEntitlement, loadStatus, t])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([loadPlans().catch(() => undefined), loadStatus().catch(() => undefined)])
      if (connected && storeConfigured && skus.length > 0) await fetchProducts({ skus, type: 'subs' }).catch(() => undefined)
    } finally {
      setLoading(false)
    }
  }, [loadPlans, loadStatus, connected, storeConfigured, skus, fetchProducts])

  const manageUrl = useMemo(() => resolveManageUrl(status, storePlatform), [status, storePlatform])

  const openManageSubscription = useCallback(async () => {
    if (!manageUrl) return
    await Linking.openURL(manageUrl).catch(() => setError(t('common.error')))
  }, [manageUrl, t])

  const clearMessages = useCallback(() => {
    setError(null)
    setNotice(null)
  }, [])

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      plans,
      platforms: plansResponse?.platforms ?? null,
      storePlatform,
      storeConfigured,
      connected,
      entitlement,
      status,
      loading,
      purchasing,
      restoring,
      error,
      notice,
      manageUrl,
      purchase,
      restore,
      refresh,
      openManageSubscription,
      clearMessages,
    }),
    [
      plans,
      plansResponse,
      storePlatform,
      storeConfigured,
      connected,
      entitlement,
      status,
      loading,
      purchasing,
      restoring,
      error,
      notice,
      manageUrl,
      purchase,
      restore,
      refresh,
      openManageSubscription,
      clearMessages,
    ],
  )

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext)
  if (!ctx) throw new Error('useSubscription must be used within a SubscriptionProvider')
  return ctx
}
