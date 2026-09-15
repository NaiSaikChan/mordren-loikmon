import { useState } from 'react'
import { ScrollView, View, Text, Pressable, KeyboardAvoidingView, Platform } from 'react-native'
import { router, Link } from 'expo-router'
import { errorMessage } from '@loikmon/api'
import { Screen } from '@/components/Screen'
import { FormField } from '@/components/FormField'
import { PrimaryButton } from '@/components/PrimaryButton'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'

const MIN_PASSWORD_LENGTH = 8

export default function RegisterScreen() {
  const { t } = useI18n()
  const { register, loading } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [verificationSent, setVerificationSent] = useState(false)
  const { headerTextStyle, bodyTextStyle } = useTypography()

  const onSubmit = async () => {
    setError(null)
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('auth.passwordTooShort'))
      return
    }
    if (password !== confirm) {
      setError(t('auth.passwordMismatch'))
      return
    }
    try {
      const { requiresEmailVerification } = await register({
        name: name.trim() || undefined,
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
      })
      if (requiresEmailVerification) {
        setVerificationSent(true)
        return
      }
      router.replace('/(tabs)')
    } catch (err) {
      setError(errorMessage(err, t('common.error')))
    }
  }

  if (verificationSent) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
          <Text className="text-5xl text-center">📧</Text>
          <Text className="mt-4 text-center text-base text-surface-700 dark:text-surface-200" style={bodyTextStyle}>
            {t('auth.verifyEmailSent')}
          </Text>
          <View className="mt-6">
            <PrimaryButton label={t('auth.backToLogin')} onPress={() => router.replace('/(auth)/login')} labelStyle={bodyTextStyle} />
          </View>
        </View>
      </Screen>
    )
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
          <Text className="text-3xl text-surface-900 dark:text-surface-50 pt-safe" style={headerTextStyle}>
            {t('auth.createAccount')}
          </Text>
          <Text className="mb-8 mt-1 text-surface-500 dark:text-surface-400" style={bodyTextStyle}>
            {t('auth.signUp')}
          </Text>

          <FormField label={t('auth.name')} value={name} onChangeText={setName} autoComplete="name" />
          <FormField
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <FormField label={`${t('auth.phone')} (${t('common.optional')})`} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <FormField label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
          <FormField label={t('auth.passwordConfirmation')} value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />

          {error ? <Text className="mb-3 text-sm text-red-500" style={bodyTextStyle}>{error}</Text> : null}

          <PrimaryButton label={t('auth.signUp')} loading={loading} onPress={onSubmit} labelStyle={bodyTextStyle} />

          <View className="mt-6 flex-row justify-center">
            <Text className="text-surface-500 dark:text-surface-400" style={bodyTextStyle}>{t('auth.hasAccount')} </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text className="text-brand-600 dark:text-brand-400" style={bodyTextStyle}>
                  {t('auth.signIn')}
                </Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
