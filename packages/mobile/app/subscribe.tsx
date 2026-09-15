import { useEffect } from 'react'
import { Linking, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { Stack, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PrimaryButton } from '@/components/PrimaryButton'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { useSubscription } from '@/context/SubscriptionContext'
import { useTypography } from '@/context/TypographyContext'
import type { PlanOffer } from '@/lib/iap'
import { PRIVACY_URL, TERMS_URL, describeSubscription, formatDate } from '@/lib/subscriptionStatus'

type T = ReturnType<typeof useI18n>['t']

function periodLabel(months: number, t: T): string {
  if (months === 12) return t('subscribe.periodYear')
  if (months === 1) return t('subscribe.periodMonth')
  return t('subscribe.periodMonths', { count: months })
}

function Banner({ tone, text }: { tone: 'error' | 'info' | 'warning'; text: string }) {
  const { bodyTextStyle } = useTypography()
  const styles = {
    error: { box: 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', icon: 'alert-circle' as const, color: '#dc2626' },
    warning: { box: 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/20', text: 'text-amber-800 dark:text-amber-200', icon: 'warning' as const, color: '#d97706' },
    info: { box: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-900/20', text: 'text-emerald-800 dark:text-emerald-200', icon: 'checkmark-circle' as const, color: '#059669' },
  }[tone]
  return (
    <View className={`mt-3 flex-row items-start gap-2 rounded-2xl border p-3 ${styles.box}`}>
      <Ionicons name={styles.icon} size={18} color={styles.color} />
      <Text className={`flex-1 text-sm ${styles.text}`} style={bodyTextStyle}>
        {text}
      </Text>
    </View>
  )
}

function PlanCard({
  offer,
  isCurrent,
  disabled,
  loading,
  buttonLabel,
  onPress,
}: {
  offer: PlanOffer
  isCurrent: boolean
  disabled: boolean
  loading: boolean
  buttonLabel: string
  onPress: () => void
}) {
  const { t } = useI18n()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const { plan } = offer
  const highlighted = offer.bestValue || isCurrent

  return (
    <View
      className={`mt-3 rounded-3xl border-2 bg-white p-4 dark:bg-surface-800 ${
        highlighted ? 'border-brand-500' : 'border-surface-200 dark:border-surface-700'
      }`}
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-lg text-surface-900 dark:text-surface-50" style={headerTextStyle}>
            {plan.name}
          </Text>
          {plan.description ? (
            <Text className="mt-0.5 text-xs text-surface-500 dark:text-surface-400" style={bodyTextStyle}>
              {plan.description}
            </Text>
          ) : null}
        </View>
        <View className="items-end gap-1">
          {offer.bestValue ? (
            <View className="rounded-full bg-brand-600 px-2.5 py-1">
              <Text className="text-[11px] font-semibold text-white" style={bodyTextStyle}>
                {t('subscribe.bestValue')}
              </Text>
            </View>
          ) : null}
          {plan.savings_percent > 0 ? (
            <View className="rounded-full bg-emerald-100 px-2.5 py-1 dark:bg-emerald-900/40">
              <Text className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300" style={bodyTextStyle}>
                {t('subscribe.save', { percent: plan.savings_percent })}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View className="mt-3 flex-row items-end">
        <Text className="text-3xl font-extrabold text-surface-900 dark:text-surface-50">{offer.displayPrice}</Text>
        <Text className="mb-1 ml-1 text-sm text-surface-500 dark:text-surface-400" style={bodyTextStyle}>
          / {periodLabel(plan.period_months, t)}
        </Text>
      </View>

      <View className="mt-4">
        <PrimaryButton
          label={buttonLabel}
          variant={highlighted ? 'primary' : 'ghost'}
          loading={loading}
          disabled={disabled}
          onPress={onPress}
          labelStyle={headerTextStyle}
        />
      </View>
    </View>
  )
}

export default function SubscribeScreen() {
  const { t } = useI18n()
  const { isLoggedIn } = useAuth()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const subscription = useSubscription()
  const {
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
  } = subscription

  useEffect(() => {
    void refresh()
    return clearMessages
    // Refresh plans/status each time the paywall opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const state = describeSubscription(entitlement, status?.subscriptions)
  const date = formatDate(state.date)
  const storeName = (store: 'app_store' | 'google_play' | null) =>
    store === 'google_play' ? t('subscribe.googlePlay') : t('subscribe.appStore')
  const deviceStore = storePlatform === 'android' ? 'google_play' : storePlatform === 'ios' ? 'app_store' : null
  const boughtInOtherStore = Boolean(state.store && deviceStore && state.store !== deviceStore)
  // Plan changes for an existing store subscription happen in the store's subscription settings.
  const storeSubscriptionActive = Boolean(entitlement?.active && state.storeManaged)

  const statusText: string | null = (() => {
    if (!isLoggedIn) return null
    switch (state.kind) {
      case 'active_renewing':
        return date ? t('subscribe.renewsOn', { date }) : t('subscribe.statusActive')
      case 'active_canceled':
        return t('subscribe.canceled', { date })
      case 'billing_issue':
        return t('subscribe.billingIssue', { store: storeName(state.store ?? deviceStore) })
      case 'granted':
        return date ? `${t('subscribe.granted')} ${t('subscribe.activeUntil', { date })}` : t('subscribe.granted')
      case 'paused':
        return t('subscribe.paused')
      case 'pending':
        return t('subscribe.pending')
      case 'expired':
        return t('subscribe.expired')
      default:
        return t('subscribe.notSubscribed')
    }
  })()

  const buttonFor = (offer: PlanOffer) => {
    const isCurrent = Boolean(entitlement?.active && state.planCode === offer.plan.code)
    if (!isLoggedIn) {
      return { isCurrent, label: t('subscribe.signInToSubscribe'), disabled: false, onPress: () => router.push('/(auth)/login') }
    }
    if (isCurrent) return { isCurrent, label: t('subscribe.currentPlan'), disabled: true, onPress: () => undefined }
    return {
      isCurrent,
      label: t('subscribe.subscribe'),
      disabled:
        storeSubscriptionActive ||
        !storePlatform ||
        !storeConfigured ||
        purchasing !== null ||
        restoring ||
        (connected && !offer.available),
      onPress: () => void purchase(offer.plan.code),
    }
  }

  const disclosure = Platform.OS === 'ios' ? t('subscribe.disclosureIos') : t('subscribe.disclosureAndroid')

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: t('subscribe.title') }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
      >
        {/* Hero */}
        <View className="rounded-3xl bg-brand-600 px-5 py-5">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
              <Ionicons name="diamond-outline" size={22} color="#ffffff" />
            </View>
            <Text className="flex-1 text-xl text-white" style={headerTextStyle}>
              {t('subscribe.title')}
            </Text>
          </View>
          <Text className="mt-3 text-sm text-brand-100" style={bodyTextStyle}>
            {t('subscribe.subtitle')}
          </Text>
          {[t('subscribe.benefitBooks'), t('subscribe.benefitArticles'), t('subscribe.benefitAudio')].map((benefit) => (
            <View key={benefit} className="mt-2 flex-row items-center gap-2">
              <Ionicons name="checkmark-circle" size={16} color="#bfdbfe" />
              <Text className="flex-1 text-sm text-white" style={bodyTextStyle}>
                {benefit}
              </Text>
            </View>
          ))}
        </View>

        {/* Current status */}
        {statusText ? (
          <View className="mt-4 rounded-2xl border border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-800">
            <View className="flex-row items-center gap-2">
              <Ionicons
                name={entitlement?.active ? 'star' : state.kind === 'billing_issue' ? 'warning' : 'information-circle-outline'}
                size={18}
                color={entitlement?.active ? '#d97706' : state.kind === 'billing_issue' ? '#dc2626' : '#64748b'}
              />
              <Text className="text-base text-surface-900 dark:text-surface-50" style={headerTextStyle}>
                {entitlement?.active ? t('subscribe.statusActive') : t('settings.subscription')}
              </Text>
            </View>
            <Text
              className={`mt-1 text-sm ${state.kind === 'billing_issue' ? 'text-red-600 dark:text-red-400' : 'text-surface-600 dark:text-surface-300'}`}
              style={bodyTextStyle}
            >
              {statusText}
            </Text>
            {boughtInOtherStore ? (
              <Text className="mt-1 text-sm text-surface-500 dark:text-surface-400" style={bodyTextStyle}>
                {t('subscribe.otherStore', { store: storeName(state.store) })}
              </Text>
            ) : null}
            {manageUrl && state.storeManaged && state.kind !== 'expired' ? (
              <View className="mt-3">
                <PrimaryButton
                  label={t('subscribe.manage')}
                  variant={state.kind === 'billing_issue' ? 'primary' : 'ghost'}
                  onPress={() => void openManageSubscription()}
                  labelStyle={headerTextStyle}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Messages */}
        {error ? <Banner tone="error" text={error} /> : null}
        {notice ? <Banner tone="info" text={notice} /> : null}
        {!storePlatform ? (
          <Banner tone="warning" text={t('subscribe.unsupportedPlatform')} />
        ) : platforms && !storeConfigured ? (
          <Banner tone="warning" text={t('subscribe.storeNotConfigured')} />
        ) : null}

        {/* Plans */}
        {plans.length === 0 ? (
          loading ? <LoadingSpinner /> : null
        ) : (
          plans.map((offer) => {
            const button = buttonFor(offer)
            return (
              <PlanCard
                key={offer.plan.code}
                offer={offer}
                isCurrent={button.isCurrent}
                disabled={button.disabled}
                loading={purchasing === offer.plan.code}
                buttonLabel={button.label}
                onPress={button.onPress}
              />
            )
          })
        )}

        {/* Restore / manage */}
        {storePlatform ? (
          <View className="mt-5 flex-row flex-wrap justify-center gap-x-6 gap-y-2">
            <Pressable onPress={() => void restore()} disabled={restoring || purchasing !== null} hitSlop={8}>
              <Text className={`text-sm font-semibold text-brand-600 dark:text-brand-400 ${restoring ? 'opacity-50' : ''}`} style={bodyTextStyle}>
                {restoring ? `${t('subscribe.restore')}…` : t('subscribe.restore')}
              </Text>
            </Pressable>
            {isLoggedIn && manageUrl ? (
              <Pressable onPress={() => void openManageSubscription()} hitSlop={8}>
                <Text className="text-sm font-semibold text-brand-600 dark:text-brand-400" style={bodyTextStyle}>
                  {t('subscribe.manage')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Store-required disclosure */}
        <Text className="mt-6 text-xs leading-5 text-surface-500 dark:text-surface-400" style={bodyTextStyle}>
          {disclosure}
        </Text>
        <View className="mt-3 flex-row justify-center gap-6">
          <Pressable onPress={() => void Linking.openURL(TERMS_URL)} hitSlop={8}>
            <Text className="text-xs font-semibold text-brand-600 underline dark:text-brand-400" style={bodyTextStyle}>
              {t('subscribe.terms')}
            </Text>
          </Pressable>
          <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)} hitSlop={8}>
            <Text className="text-xs font-semibold text-brand-600 underline dark:text-brand-400" style={bodyTextStyle}>
              {t('subscribe.privacy')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  )
}
