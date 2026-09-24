import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import Animated, { FadeInDown, FadeInUp, useReducedMotion } from 'react-native-reanimated'
import { router } from 'expo-router'
import { errorMessage } from '@loikmon/api'
import { Screen } from '@/components/Screen'
import { FormField } from '@/components/FormField'
import { PrimaryButton } from '@/components/PrimaryButton'
import { AuthLogo } from '@/components/AuthLogo'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'

export default function ForgotPasswordScreen() {
  const { t } = useI18n()
  const { forgotPassword, loading } = useAuth()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const reduceMotion = useReducedMotion()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async () => {
    setError(null)
    setMessage(null)
    try {
      // The backend always answers the same way, whether or not the account exists.
      setMessage(await forgotPassword(email.trim()))
    } catch (err) {
      setError(errorMessage(err, t('common.error')))
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.duration(500)}
          style={{ alignItems: 'center', marginBottom: 28 }}
        >
          <AuthLogo size={96} />
          <Text
            className="mt-5 text-center text-3xl text-surface-900 dark:text-surface-50"
            style={headerTextStyle}
            accessibilityRole="header"
          >
            {t('auth.resetPassword')}
          </Text>
          <Text className="mt-1 text-center text-base text-surface-500 dark:text-surface-400" style={bodyTextStyle}>
            {t('auth.resetInstructions')}
          </Text>
        </Animated.View>

        <Animated.View entering={reduceMotion ? undefined : FadeInUp.duration(450).delay(80)}>
          <FormField
            label={t('auth.email')}
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={() => void onSubmit()}
          />

          {message ? (
            <Text
              className="mb-3 text-sm text-emerald-700 dark:text-emerald-400"
              style={bodyTextStyle}
              accessibilityLiveRegion="polite"
            >
              {message}
            </Text>
          ) : null}
          {error ? (
            <Text
              className="mb-3 text-sm text-red-600 dark:text-red-400"
              style={bodyTextStyle}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              {error}
            </Text>
          ) : null}

          <PrimaryButton label={t('auth.sendResetLink')} loading={loading} onPress={onSubmit} labelStyle={bodyTextStyle} />
          <View className="h-3" />
          <PrimaryButton label={t('auth.backToLogin')} variant="ghost" onPress={() => router.back()} labelStyle={bodyTextStyle} />
        </Animated.View>
      </ScrollView>
    </Screen>
  )
}
