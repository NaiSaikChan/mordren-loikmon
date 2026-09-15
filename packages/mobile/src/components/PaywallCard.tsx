import { Text, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { PrimaryButton } from '@/components/PrimaryButton'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
import type { AccessAction } from '@/lib/access'

/**
 * Locked-content call to action: sign in (LOGIN_REQUIRED) or open the
 * paywall (SUBSCRIPTION_REQUIRED). `children` can show a preview (excerpt).
 */
export function PaywallCard({
  action,
  title,
  hint,
  children,
}: {
  action: Exclude<AccessAction, 'open'>
  title?: string
  hint?: string
  children?: React.ReactNode
}) {
  const { t } = useI18n()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const isLogin = action === 'login'

  return (
    <View className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/40 dark:bg-amber-900/10">
      {children}
      <View className="items-center">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
          <Ionicons name={isLogin ? 'person-circle-outline' : 'lock-closed'} size={24} color="#b45309" />
        </View>
        <Text className="mt-3 text-center text-base text-surface-900 dark:text-surface-50" style={headerTextStyle}>
          {title ?? (isLogin ? t('books.signInToRead') : t('books.lockedTitle'))}
        </Text>
        <Text className="mt-1 text-center text-sm text-surface-600 dark:text-surface-300" style={bodyTextStyle}>
          {hint ?? (isLogin ? t('books.loginHint') : t('books.lockedHint'))}
        </Text>
        <View className="mt-4 w-full">
          <PrimaryButton
            label={isLogin ? t('auth.signIn') : t('subscribe.subscribe')}
            onPress={() => router.push(isLogin ? '/(auth)/login' : '/subscribe')}
            labelStyle={headerTextStyle}
          />
        </View>
      </View>
    </View>
  )
}
