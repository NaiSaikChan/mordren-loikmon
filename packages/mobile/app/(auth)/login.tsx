import { useRef, useState } from 'react'
import { ScrollView, View, Text, Pressable, KeyboardAvoidingView, Platform, type TextInput } from 'react-native'
import Animated, { FadeInDown, FadeInUp, useReducedMotion } from 'react-native-reanimated'
import { router, Link } from 'expo-router'
import { errorCode, errorMessage } from '@loikmon/api'
import { Screen } from '@/components/Screen'
import { FormField } from '@/components/FormField'
import { PrimaryButton } from '@/components/PrimaryButton'
import { AuthLogo } from '@/components/AuthLogo'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'

export default function LoginScreen() {
  const { t } = useI18n()
  const { login, resendVerification, loading } = useAuth()
  const { headerTextStyle, bodyTextStyle } = useTypography()
  const reduceMotion = useReducedMotion()
  const passwordRef = useRef<TextInput>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [info, setInfo] = useState<string | null>(null)

  const onSubmit = async () => {
    setError(null)
    setInfo(null)
    setNeedsVerification(false)
    try {
      await login({ email: email.trim(), password })
      if (router.canGoBack()) router.back()
      else router.replace('/(tabs)')
    } catch (err) {
      const code = errorCode(err) === 'UNKNOWN' ? (err as { code?: string })?.code : errorCode(err)
      setNeedsVerification(code === 'EMAIL_NOT_VERIFIED')
      setError(errorMessage(err, t('common.error')))
    }
  }

  const onResend = async () => {
    await resendVerification(email.trim()).catch(() => undefined)
    setInfo(t('auth.verificationResent'))
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
          <Animated.View
            entering={reduceMotion ? undefined : FadeInDown.duration(500)}
            style={{ alignItems: 'center', marginBottom: 28 }}
          >
            <AuthLogo />
            <Text
              className="mt-5 text-center text-3xl text-surface-900 dark:text-surface-50"
              style={headerTextStyle}
              accessibilityRole="header"
            >
              {t('auth.welcomeBack')}
            </Text>
            <Text className="mt-1 text-center text-base text-surface-500 dark:text-surface-400" style={bodyTextStyle}>
              {t('auth.signIn')}
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
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <FormField
              ref={passwordRef}
              label={t('auth.password')}
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void onSubmit()}
            />

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
            {needsVerification && email.trim() ? (
              <Pressable
                onPress={onResend}
                className="mb-3 min-h-touch justify-center self-start active:opacity-60"
                accessibilityRole="button"
                accessibilityLabel={t('auth.resendVerification')}
              >
                <Text className="text-sm font-medium text-brand-600 dark:text-brand-400" style={bodyTextStyle}>
                  {t('auth.resendVerification')}
                </Text>
              </Pressable>
            ) : null}
            {info ? (
              <Text
                className="mb-3 text-sm text-emerald-700 dark:text-emerald-400"
                style={bodyTextStyle}
                accessibilityLiveRegion="polite"
              >
                {info}
              </Text>
            ) : null}

            <Link href="/(auth)/forgot-password" asChild>
              <Pressable
                className="mb-4 min-h-touch justify-center self-end active:opacity-60"
                accessibilityRole="link"
                accessibilityLabel={t('auth.forgotPassword')}
              >
                <Text className="text-sm font-medium text-brand-600 dark:text-brand-400" style={bodyTextStyle}>
                  {t('auth.forgotPassword')}
                </Text>
              </Pressable>
            </Link>

            <PrimaryButton label={t('auth.signIn')} loading={loading} onPress={onSubmit} labelStyle={bodyTextStyle} />

            <View className="mt-4 flex-row items-center justify-center">
              <Text className="text-sm text-surface-500 dark:text-surface-400" style={bodyTextStyle}>
                {t('auth.noAccount')}{' '}
              </Text>
              <Link href="/(auth)/register" asChild>
                <Pressable
                  className="min-h-touch justify-center active:opacity-60"
                  accessibilityRole="link"
                  accessibilityLabel={t('auth.signUp')}
                >
                  <Text className="text-sm text-brand-600 dark:text-brand-400" style={bodyTextStyle}>
                    {t('auth.signUp')}
                  </Text>
                </Pressable>
              </Link>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
