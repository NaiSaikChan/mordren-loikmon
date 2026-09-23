import { useState } from 'react'
import { ScrollView, View, Text, Pressable, KeyboardAvoidingView, Platform } from 'react-native'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
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
          <Animated.View entering={FadeInDown.duration(500)} style={{ alignItems: 'center', marginBottom: 28 }}>
            <AuthLogo />
            <Text className="text-3xl mt-5 text-center text-surface-900 dark:text-surface-50" style={headerTextStyle}>
              {t('auth.welcomeBack')}
            </Text>
            <Text className="mt-1 text-center text-surface-500 dark:text-surface-400 text-base" style={bodyTextStyle}>
              {t('auth.signIn')}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(450).delay(80)}>
            <FormField
              label={t('auth.email')}
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <FormField
              label={t('auth.password')}
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />

            {error ? <Text className="mb-3 text-sm text-red-500" style={bodyTextStyle}>{error}</Text> : null}
            {needsVerification && email.trim() ? (
              <Pressable onPress={onResend} className="mb-3 self-start">
                <Text className="text-sm font-medium text-brand-600 dark:text-brand-400" style={bodyTextStyle}>
                  {t('auth.resendVerification')}
                </Text>
              </Pressable>
            ) : null}
            {info ? <Text className="mb-3 text-sm text-emerald-600" style={bodyTextStyle}>{info}</Text> : null}

            <Link href="/(auth)/forgot-password" asChild>
              <Pressable className="mb-6 self-end">
                <Text className="text-sm font-medium text-brand-600 dark:text-brand-400" style={bodyTextStyle}>
                  {t('auth.forgotPassword')}
                </Text>
              </Pressable>
            </Link>

            <PrimaryButton label={t('auth.signIn')} loading={loading} onPress={onSubmit} labelStyle={bodyTextStyle} />

            <View className="mt-6 flex-row justify-center">
              <Text className="text-surface-500 dark:text-surface-400" style={bodyTextStyle}>{t('auth.noAccount')} </Text>
              <Link href="/(auth)/register" asChild>
                <Pressable>
                  <Text className="text-brand-600 dark:text-brand-400" style={bodyTextStyle}>
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
