import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { AppState, Linking, Platform } from 'react-native'
import { router } from 'expo-router'
import {
  finishTransaction as storeFinishTransaction,
  getAvailablePurchases,
  restorePurchases as storeRestorePurchases,
  useIAP,
  type Purchase,
} from 'expo-iap'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { errorMessage, storeSkus, subscriptions as subscriptionsApi } from '@loikmon/api'
import type { Entitlement, PlansResponse, SubscriptionStatusResponse } from '@loikmon/api'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { storage } from '@/services/storage'
import {
  backedOffKeys,
  buildSubscriptionRequest,
  isBackedOff,
  isUserCancelled,
  mergePlansWithProducts,
  processPurchase,
  pruneRejections,
  purchaseKey,
  recordRejection,
  resolveManageUrl,
  restoreWithBackend,
  selectRetryCandidates,
  storePlatformOf,
  type PlanOffer,
  type PurchaseOutcome,
  type RejectionLog,
  type StorePlatform,
} from '@/lib/iap'

/** Purchases whose backend verification failed transiently (retried on launch / foreground). */
const PENDING_VERIFICATION_KEY = 'iap_pending_verification'
/** Purchases the backend rejected, with their background-retry back-off. */
const REJECTED_PURCHASES_KEY = 'iap_rejected_purchases'

/** Signed-in users connect to the store this long after start-up interactions settle. */
const STORE_CONNECT_DELAY_MS = 3000
/** How long a purchase/restore waits for the lazily started store connection. */
const STORE_CONNECT_TIMEOUT_MS = 10_000
const PLANS_STALE_TIME = 5 * 60_000

const plansKey = ['subscription', 'plans'] as const
const statusKey = (userId: string) => ['subscription', 'status', userId] as const

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
  /** Loads plans + status and connects to the store (call when the paywall opens). */
  refresh: () => Promise<void>
  openManageSubscription: () => Promise<void>
  clearMessages: () => void
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined)

// ── Lazily mounted store connection ────────────────────────────────────────

type UseIapResult = ReturnType<typeof useIAP>
type PurchaseError = Parameters<NonNullable<NonNullable<Parameters<typeof useIAP>[0]>['onPurchaseError']>>[0]
type StoreFns = Pick<UseIapResult, 'fetchProducts' | 'requestPurchase' | 'reconnect'>
interface StoreState {
  connected: boolean
  products: UseIapResult['subscriptions']
}
interface StoreHandlers {
  onPurchaseSuccess: (purchase: Purchase) => void
  onPurchaseError: (error: PurchaseError) => void
}

const DISCONNECTED: StoreState = { connected: false, products: [] }

/**
 * Owns the single `useIAP` instance (and thus the only purchase listener).
 * `useIAP` opens the StoreKit / Play Billing connection on mount, so this is
 * only rendered once the store is actually needed.
 */
function StoreConnection({
  handlers,
  fnsRef,
  onState,
}: {
  handlers: RefObject<StoreHandlers>
  fnsRef: RefObject<StoreFns | null>
  onState: (state: StoreState) => void
}) {
  const { connected, subscriptions, fetchProducts, requestPurchase, reconnect } = useIAP({
    onPurchaseSuccess: (purchase) => handlers.current.onPurchaseSuccess(purchase),
    onPurchaseError: (purchaseError) => handlers.current.onPurchaseError(purchaseError),
    onError: (storeError) => {
      if (__DEV__) console.warn('[subscriptions] store error:', storeError.message)
    },
  })

  useEffect(() => {
    fnsRef.current = { fetchProducts, requestPurchase, reconnect }
  }, [fnsRef, fetchProducts, requestPurchase, reconnect])

  useEffect(() => {
    onState({ connected, products: subscriptions })
  }, [onState, connected, subscriptions])

  useEffect(
    () => () => {
      fnsRef.current = null
      onState(DISCONNECTED)
    },
    [fnsRef, onState],
  )

  return null
}

/**
 * App-wide subscription state: purchase → backend verification → finishTransaction.
 *
 * Start-up cost is deferred: plans are only fetched and the store is only
 * connected when the paywall opens / a purchase or restore needs it, or — for
 * signed-in users, so unfinished transactions are still recovered — shortly
 * after the app becomes interactive.
 */
export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n()
  const { isLoggedIn, user, entitlement, setEntitlement } = useAuth()
  const queryClient = useQueryClient()
  const storePlatform = storePlatformOf(Platform.OS)
  const userId = isLoggedIn ? (user?.id ?? null) : null

  const [storeWanted, setStoreWanted] = useState(false)
  const [plansWanted, setPlansWanted] = useState(false)
  const [store, setStore] = useState<StoreState>(DISCONNECTED)
  const [loading, setLoading] = useState(false)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Messages belong to the account they were shown for.
  const [messagesOwner, setMessagesOwner] = useState(userId)
  if (messagesOwner !== userId) {
    setMessagesOwner(userId)
    setError(null)
    setNotice(null)
  }

  const tRef = useRef(t)
  const loggedInRef = useRef(isLoggedIn)
  const userIdRef = useRef(userId)
  const connectedRef = useRef(false)
  useEffect(() => {
    tRef.current = t
    loggedInRef.current = isLoggedIn
    userIdRef.current = userId
    connectedRef.current = store.connected
  })

  const storeFnsRef = useRef<StoreFns | null>(null)
  const connectWaitersRef = useRef(new Set<(connected: boolean) => void>())
  /** Product the user is buying right now (drives success/error UI). */
  const interactiveRef = useRef<{ productId: string } | null>(null)
  const inFlightRef = useRef(new Set<string>())
  /** Purchases delivered while signed out; verified once a session exists. */
  const deferredRef = useRef(new Map<string, Purchase>())
  const pendingKeysRef = useRef(new Set<string>())
  const rejectionsRef = useRef<RejectionLog>({})

  // ── Backend data ─────────────────────────────────────────────────────────

  const plansQuery = useQuery({
    queryKey: plansKey,
    queryFn: async () => (await subscriptionsApi.fetchPlans()).data,
    enabled: plansWanted || storeWanted,
    staleTime: PLANS_STALE_TIME,
  })
  const plansResponse = plansQuery.data ?? null

  const fetchStatus = useCallback(async (): Promise<SubscriptionStatusResponse | null> => {
    const owner = userIdRef.current
    if (!owner) return null
    const { data } = await subscriptionsApi.getStatus()
    // Signed out / switched account while the request was in flight.
    if (userIdRef.current !== owner) return null
    setEntitlement(data.entitlement)
    return data
  }, [setEntitlement])

  const statusQuery = useQuery({
    queryKey: statusKey(userId ?? ''),
    queryFn: fetchStatus,
    enabled: Boolean(userId),
  })
  const status = userId ? (statusQuery.data ?? null) : null

  /** Fresh status from the backend (also updates the entitlement). */
  const loadStatus = useCallback(async (): Promise<SubscriptionStatusResponse | null> => {
    const owner = userIdRef.current
    if (!owner) return null
    return queryClient.fetchQuery({ queryKey: statusKey(owner), queryFn: fetchStatus, staleTime: 0 })
  }, [queryClient, fetchStatus])

  // ── Persisted purchase bookkeeping ───────────────────────────────────────

  useEffect(() => {
    storage
      .getJSON<string[]>(PENDING_VERIFICATION_KEY)
      .then((keys) => {
        for (const key of keys ?? []) pendingKeysRef.current.add(key)
      })
      .catch(() => undefined)
    storage
      .getJSON<RejectionLog>(REJECTED_PURCHASES_KEY)
      .then((log) => {
        if (log && typeof log === 'object') rejectionsRef.current = { ...log, ...rejectionsRef.current }
      })
      .catch(() => undefined)
  }, [])

  const persistPendingKeys = useCallback(() => storage.setJSON(PENDING_VERIFICATION_KEY, [...pendingKeysRef.current]).catch(() => undefined), [])
  const persistRejections = useCallback(() => storage.setJSON(REJECTED_PURCHASES_KEY, rejectionsRef.current).catch(() => undefined), [])

  // Signing out forgets per-account purchase bookkeeping: a purchase rejected for one
  // account may be valid for the next, and pending retries belong to the old session.
  const wasLoggedIn = useRef(isLoggedIn)
  useEffect(() => {
    if (wasLoggedIn.current && !isLoggedIn) {
      pendingKeysRef.current.clear()
      rejectionsRef.current = {}
      void storage.remove(PENDING_VERIFICATION_KEY).catch(() => undefined)
      void storage.remove(REJECTED_PURCHASES_KEY).catch(() => undefined)
    }
    wasLoggedIn.current = isLoggedIn
  }, [isLoggedIn])

  // ── Store connection ─────────────────────────────────────────────────────

  const skuKey = plansResponse && storePlatform ? storeSkus(plansResponse.plans, storePlatform).join(',') : ''
  // Stable identity while the product ids stay the same (plans are re-fetched on every paywall visit).
  const skus = useMemo(() => (skuKey ? skuKey.split(',') : []), [skuKey])
  const storeConfigured = Boolean(storePlatform && plansResponse?.platforms[storePlatform])
  const { connected, products: storeProducts } = store

  const plans = useMemo(
    () => mergePlansWithProducts(plansResponse?.plans ?? [], storeProducts, storePlatform),
    [plansResponse, storeProducts, storePlatform],
  )

  const onStoreState = useCallback((next: StoreState) => {
    setStore((prev) => (prev.connected === next.connected && prev.products === next.products ? prev : next))
    if (next.connected) {
      for (const resolve of connectWaitersRef.current) resolve(true)
      connectWaitersRef.current.clear()
    }
  }, [setStore])

  // Signed-in users: connect once the app is interactive, to recover unfinished transactions.
  useEffect(() => {
    if (!isLoggedIn || storeWanted || !storePlatform) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const idle = requestIdleCallback(() => {
      timer = setTimeout(() => setStoreWanted(true), STORE_CONNECT_DELAY_MS)
    })
    return () => {
      cancelIdleCallback(idle)
      if (timer) clearTimeout(timer)
    }
  }, [isLoggedIn, storeWanted, storePlatform])

  /** Starts the store connection if needed and waits (bounded) for it. */
  const ensureConnected = useCallback(async (): Promise<boolean> => {
    if (!storePlatform) return false
    setStoreWanted(true)
    if (connectedRef.current) return true
    const connectedInTime = await new Promise<boolean>((resolve) => {
      const waiter = (value: boolean) => {
        clearTimeout(timer)
        resolve(value)
      }
      const timer = setTimeout(() => {
        connectWaitersRef.current.delete(waiter)
        resolve(false)
      }, STORE_CONNECT_TIMEOUT_MS)
      connectWaitersRef.current.add(waiter)
    })
    if (connectedInTime) return true
    return (await storeFnsRef.current?.reconnect().catch(() => false)) ?? false
  }, [storePlatform])

  useEffect(() => {
    if (!connected || !storeConfigured || skus.length === 0) return
    storeFnsRef.current?.fetchProducts({ skus, type: 'subs' }).catch(() => undefined)
  }, [connected, storeConfigured, skus])

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
      const interactive = interactiveRef.current?.productId === purchase.productId
      // Background re-delivery of a purchase the backend recently rejected: wait for its back-off.
      if (!interactive && isBackedOff(rejectionsRef.current, key, Date.now())) {
        deferredRef.current.delete(key)
        return
      }
      inFlightRef.current.add(key)

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

      const tr = tRef.current
      deferredRef.current.delete(key)
      switch (outcome.status) {
        case 'verified':
          setEntitlement(outcome.entitlement)
          if (pendingKeysRef.current.delete(key)) void persistPendingKeys()
          if (rejectionsRef.current[key]) {
            rejectionsRef.current = pruneRejections(rejectionsRef.current, (k) => k !== key)
            void persistRejections()
          }
          if (interactive) setNotice(tr('subscribe.success'))
          loadStatus().catch(() => undefined)
          break
        case 'pending':
          if (interactive) setNotice(tr('subscribe.pendingPayment'))
          break
        case 'retry':
          // Keep the store transaction unfinished; verify again later.
          pendingKeysRef.current.add(key)
          void persistPendingKeys()
          if (interactive) setNotice(tr('subscribe.verifyLater'))
          break
        case 'rejected':
          if (pendingKeysRef.current.delete(key)) void persistPendingKeys()
          rejectionsRef.current = recordRejection(rejectionsRef.current, key, Date.now())
          void persistRejections()
          // Only surface errors for purchases the user is making right now; background
          // re-deliveries (e.g. on every launch) must not show a message each time.
          if (!interactive) break
          if (outcome.code === 'PURCHASE_ALREADY_LINKED') setError(tr('subscribe.alreadyLinked'))
          else setError(errorMessage(outcome.error, tr('subscribe.verifyFailed')))
          break
      }
    },
    [storePlatform, setEntitlement, persistPendingKeys, persistRejections, loadStatus, setError, setNotice, setPurchasing],
  )

  const handlersRef = useRef<StoreHandlers>({ onPurchaseSuccess: () => undefined, onPurchaseError: () => undefined })
  useEffect(() => {
    handlersRef.current = {
      onPurchaseSuccess: (purchase) => void handlePurchase(purchase),
      onPurchaseError: (purchaseError) => {
        if (!interactiveRef.current) return
        interactiveRef.current = null
        setPurchasing(null)
        if (isUserCancelled(purchaseError)) return
        const tr = tRef.current
        if (purchaseError.code === 'already-owned') setError(tr('subscribe.alreadyOwned'))
        else if (purchaseError.code === 'deferred-payment' || purchaseError.code === 'pending') setNotice(tr('subscribe.pendingPayment'))
        else setError(tr('subscribe.purchaseFailed'))
      },
    }
  }, [handlePurchase])

  /** Verify purchases that are still unfinished (after a network/store outage, or bought while signed out). */
  const retryUnfinished = useCallback(async () => {
    if (!storePlatform || !connectedRef.current || !loggedInRef.current || !storeConfigured || skus.length === 0) return
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
    const now = Date.now()
    const skip = backedOffKeys(rejectionsRef.current, now)
    const candidates = selectRetryCandidates(purchases, pendingKeysRef.current, storePlatform, new Set(skus), skip)
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
    const pruned = pruneRejections(rejectionsRef.current, (key) => present.has(key))
    if (pruned !== rejectionsRef.current) {
      rejectionsRef.current = pruned
      void persistRejections()
    }
  }, [storePlatform, storeConfigured, skus, handlePurchase, persistPendingKeys, persistRejections])

  // Store connected + session restored …
  useEffect(() => {
    if (connected && isLoggedIn && storeConfigured) void retryUnfinished()
  }, [connected, isLoggedIn, storeConfigured, retryUnfinished])

  // … and every return to the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !loggedInRef.current) return
      loadStatus().catch(() => undefined)
      void retryUnfinished()
    })
    return () => subscription.remove()
  }, [loadStatus, retryUnfinished])

  // ── Actions ──────────────────────────────────────────────────────────────

  const purchase = useCallback(
    async (planCode: string) => {
      const tr = tRef.current
      setError(null)
      setNotice(null)
      if (!loggedInRef.current) {
        router.push('/(auth)/login')
        return
      }
      if (!storePlatform) {
        setError(tr('subscribe.unsupportedPlatform'))
        return
      }
      if (!storeConfigured) {
        setError(tr('subscribe.storeNotConfigured'))
        return
      }
      const offer = plans.find((item) => item.plan.code === planCode)
      if (!offer) return
      setPurchasing(planCode)
      try {
        if (!(await ensureConnected())) throw new Error(tr('subscribe.storeUnavailable'))
        if (!offer.available) throw new Error(tr('subscribe.productUnavailable'))
        // The account token must belong to the signed-in user: a status left over from a
        // previous account would link the store purchase to that other account.
        const current = status && status.account_token === userIdRef.current ? status : await loadStatus()
        const request = current ? buildSubscriptionRequest(offer, storePlatform, current.account_token) : null
        const requestPurchase = storeFnsRef.current?.requestPurchase
        if (!request || !offer.productId || !requestPurchase) throw new Error(tr('subscribe.productUnavailable'))

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
        if (!isUserCancelled(purchaseError)) setError(errorMessage(purchaseError, tr('subscribe.purchaseFailed')))
      }
    },
    [storePlatform, storeConfigured, plans, ensureConnected, status, loadStatus, setError, setNotice, setPurchasing],
  )

  const restore = useCallback(async () => {
    const tr = tRef.current
    setError(null)
    setNotice(null)
    if (!loggedInRef.current) {
      router.push('/(auth)/login')
      return
    }
    if (!storePlatform || !storeConfigured) {
      setError(tr(storePlatform ? 'subscribe.storeNotConfigured' : 'subscribe.unsupportedPlatform'))
      return
    }
    setRestoring(true)
    try {
      if (!(await ensureConnected())) throw new Error(tr('subscribe.storeUnavailable'))
      await storeRestorePurchases().catch(() => undefined)
      const purchases = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true })
      const outcome = await restoreWithBackend(purchases, {
        platform: storePlatform,
        skus: new Set(skus),
        restore: async (proofs) => (await subscriptionsApi.restore(proofs)).data,
        finishTransaction: storeFinishTransaction,
      })
      if (outcome.entitlement) setEntitlement(outcome.entitlement)
      if (outcome.nothingToRestore) setNotice(tr('subscribe.nothingToRestore'))
      else if (outcome.restored > 0) setNotice(tr('subscribe.restored'))
      else if (outcome.alreadyLinked) setError(tr('subscribe.alreadyLinked'))
      else setError(outcome.failures[0]?.message || tr('subscribe.restoreFailed'))
      // An explicit restore is a fresh attempt for every purchase.
      if (Object.keys(rejectionsRef.current).length > 0) {
        rejectionsRef.current = {}
        void persistRejections()
      }
      await loadStatus().catch(() => undefined)
    } catch (restoreError) {
      if (!isUserCancelled(restoreError)) setError(errorMessage(restoreError, tr('subscribe.restoreFailed')))
    } finally {
      setRestoring(false)
    }
  }, [storePlatform, storeConfigured, ensureConnected, skus, setEntitlement, loadStatus, persistRejections, setError, setNotice, setRestoring])

  const refresh = useCallback(async () => {
    setLoading(true)
    setPlansWanted(true)
    if (storePlatform) setStoreWanted(true)
    try {
      await Promise.all([
        queryClient.fetchQuery({ queryKey: plansKey, queryFn: async () => (await subscriptionsApi.fetchPlans()).data, staleTime: 0 }).catch(() => undefined),
        loadStatus().catch(() => undefined),
      ])
      // Store products are (re)loaded by the effect above once connected and plans are known.
    } finally {
      setLoading(false)
    }
  }, [queryClient, loadStatus, storePlatform])

  const manageUrl = useMemo(() => resolveManageUrl(status, storePlatform), [status, storePlatform])

  const openManageSubscription = useCallback(async () => {
    if (!manageUrl) return
    await Linking.openURL(manageUrl).catch(() => setError(tRef.current('common.error')))
  }, [manageUrl, setError])

  const clearMessages = useCallback(() => {
    setError(null)
    setNotice(null)
  }, [setError, setNotice])

  const platforms = plansResponse?.platforms ?? null
  const value = useMemo<SubscriptionContextValue>(
    () => ({
      plans,
      platforms,
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
      platforms,
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

  return (
    <SubscriptionContext.Provider value={value}>
      {storeWanted && storePlatform ? <StoreConnection handlers={handlersRef} fnsRef={storeFnsRef} onState={onStoreState} /> : null}
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext)
  if (!ctx) throw new Error('useSubscription must be used within a SubscriptionProvider')
  return ctx
}
