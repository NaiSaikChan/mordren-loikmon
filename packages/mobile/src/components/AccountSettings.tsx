import { useState } from 'react'
import { Alert, Linking, Pressable, Text, View, type StyleProp, type TextStyle } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { errorMessage } from '@loikmon/api'
import { FormField } from '@/components/FormField'
import { PrimaryButton } from '@/components/PrimaryButton'
import { useAuth, type StoreName } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { useSubscription } from '@/context/SubscriptionContext'
import { STORE_MANAGE_URLS } from '@/lib/iap'
import { useThemeColors } from '@/theme/colors'

type Panel = 'none' | 'password' | 'delete'

/** Signed-in account card: subscription, change password, delete account, logout. */
export function AccountSettings({ textStyle }: { textStyle?: StyleProp<TextStyle> }) {
  const { t } = useI18n()
  const { user, entitlement, logout, changePassword, deleteAccount } = useAuth()
  const { status } = useSubscription()
  const colors = useThemeColors()
  const [panel, setPanel] = useState<Panel>('none')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const togglePanel = (next: Panel) => {
    setMessage(null)
    setPanel((prev) => (prev === next ? 'none' : next))
  }

  const storeLabel = (store: StoreName) => (store === 'app_store' ? t('subscribe.appStore') : t('subscribe.googlePlay'))

  const onChangePassword = async () => {
    setMessage(null)
    if (newPassword.length < 8) return setMessage({ ok: false, text: t('auth.passwordTooShort') })
    if (newPassword !== confirmPassword) return setMessage({ ok: false, text: t('auth.passwordMismatch') })
    setBusy(true)
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage({ ok: true, text: t('settings.passwordChanged') })
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err, t('common.error')) })
    } finally {
      setBusy(false)
    }
  }

  const performDelete = async () => {
    setBusy(true)
    setMessage(null)
    // Capture the manage links before the session (and status) are cleared.
    const manageUrls = status?.manage_urls
    try {
      const { manageStoreSubscription } = await deleteAccount(deletePassword)
      setDeletePassword('')
      router.replace('/(tabs)')
      if (manageStoreSubscription) {
        const store = storeLabel(manageStoreSubscription)
        const url = manageUrls?.[manageStoreSubscription] || STORE_MANAGE_URLS[manageStoreSubscription]
        Alert.alert(t('settings.accountDeleted'), t('settings.cancelStoreSubscription', { store }), [
          { text: t('common.close'), style: 'cancel' },
          { text: t('subscribe.manage'), onPress: () => void Linking.openURL(url) },
        ])
      } else {
        Alert.alert(t('settings.accountDeleted'))
      }
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err, t('common.error')) })
    } finally {
      setBusy(false)
    }
  }

  const onDelete = () => {
    if (!deletePassword) return
    Alert.alert(t('settings.deleteAccountConfirmTitle'), t('settings.deleteAccountConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void performDelete() },
    ])
  }

  return (
    <View className="rounded-card border border-surface-200 bg-surface-50 p-4 dark:border-surface-700 dark:bg-surface-900/40">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-4">
          <Text className="text-base font-semibold text-surface-900 dark:text-surface-50" style={textStyle}>
            {user?.name}
          </Text>
          <Text className="mt-0.5 text-sm text-surface-500 dark:text-surface-400" style={textStyle}>
            {user?.email}
          </Text>
        </View>
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
          <Ionicons name="checkmark-done" size={16} color={colors.success} />
        </View>
      </View>

      {/* Subscription */}
      {/* <Pressable
        onPress={() => router.push('/subscribe')}
        disabled
        className="mt-4 min-h-touch flex-row items-center justify-between rounded-control bg-white px-3 py-3 active:opacity-70 dark:bg-surface-800"
        accessibilityRole="button"
        accessibilityLabel={`${t('settings.subscription')}, ${entitlement?.active ? t('subscribe.statusActive') : t('home.goPremium')}`}
        accessibilityState={{ disabled: true }}
      >
        <View className="flex-row items-center gap-2">
          <Ionicons name={entitlement?.active ? 'star' : 'diamond-outline'} size={16} color={entitlement?.active ? colors.premium : colors.brand} />
          <Text className="text-sm font-semibold text-surface-900 dark:text-surface-50" style={textStyle}>
            {t('settings.subscription')}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Text className="text-xs text-surface-500 dark:text-surface-400" style={textStyle}>
            {entitlement?.active ? t('subscribe.statusActive') : t('home.goPremium')}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedText} />
        </View>
      </Pressable> */}

      {/* Change password */}
      <Pressable
        onPress={() => togglePanel('password')}
        className="mt-2 min-h-touch flex-row items-center justify-between rounded-control bg-white px-3 py-3 active:opacity-70 dark:bg-surface-800"
        accessibilityRole="button"
        accessibilityLabel={t('settings.changePassword')}
        accessibilityState={{ expanded: panel === 'password' }}
      >
        <View className="flex-row items-center gap-2">
          <Ionicons name="key-outline" size={16} color={colors.brand} />
          <Text className="text-sm font-semibold text-surface-900 dark:text-surface-50" style={textStyle}>
            {t('settings.changePassword')}
          </Text>
        </View>
        <Ionicons name={panel === 'password' ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedText} />
      </Pressable>
      {panel === 'password' ? (
        <View className="mt-3">
          <FormField label={t('auth.currentPassword')} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry autoComplete="current-password" textContentType="password" />
          <FormField label={t('auth.newPassword')} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
          <FormField label={t('auth.passwordConfirmation')} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
          <PrimaryButton label={t('common.save')} loading={busy} onPress={onChangePassword} labelStyle={textStyle} />
        </View>
      ) : null}

      {message && panel !== 'none' ? (
        <Text
          className={`mt-3 text-sm ${message.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
          style={textStyle}
          accessibilityLiveRegion="polite"
        >
          {message.text}
        </Text>
      ) : null}

      <Pressable
        onPress={() => {
          void logout()
          router.replace('/(tabs)')
        }}
        className="mt-4 min-h-touch flex-row items-center justify-center rounded-control border border-red-200 bg-red-50 py-2.5 active:opacity-70 dark:border-red-900/30 dark:bg-red-900/20"
        accessibilityRole="button"
        accessibilityLabel={t('nav.logout')}
      >
        <Ionicons name="log-out-outline" size={17} color={colors.danger} />
        <Text className="ml-2 text-sm font-semibold text-red-600 dark:text-red-400" style={textStyle}>
          {t('nav.logout')}
        </Text>
      </Pressable>

      {/* Delete account (required by the App Store for apps with account creation) */}
      <Pressable
        onPress={() => togglePanel('delete')}
        className="mt-3 min-h-touch flex-row items-center justify-center py-2 active:opacity-60"
        accessibilityRole="button"
        accessibilityLabel={t('settings.deleteAccount')}
        accessibilityState={{ expanded: panel === 'delete' }}
      >
        <Ionicons name="trash-outline" size={15} color={colors.mutedText} />
        <Text className="ml-1.5 text-sm text-surface-500 dark:text-surface-400" style={textStyle}>
          {t('settings.deleteAccount')}
        </Text>
      </Pressable>
      {panel === 'delete' ? (
        <View className="mt-2 rounded-xl border border-red-200 p-3 dark:border-red-900/40">
          <Text className="mb-3 text-sm text-surface-600 dark:text-surface-300" style={textStyle}>
            {t('settings.deleteAccountHint')}
          </Text>
          <FormField label={t('auth.password')} value={deletePassword} onChangeText={setDeletePassword} secureTextEntry autoComplete="current-password" textContentType="password" />
          <Pressable
            onPress={onDelete}
            disabled={!deletePassword || busy}
            className={`min-h-[48px] flex-row items-center justify-center rounded-control bg-red-600 py-3 active:opacity-80 ${!deletePassword || busy ? 'opacity-50' : ''}`}
            accessibilityRole="button"
            accessibilityLabel={t('settings.deleteAccount')}
            accessibilityState={{ disabled: !deletePassword || busy, busy }}
          >
            <Text className="text-base font-semibold text-white" style={textStyle}>
              {t('settings.deleteAccount')}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}
