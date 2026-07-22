import { useState } from 'react'
import { ScrollView, View, Text, Pressable, KeyboardAvoidingView, Platform } from 'react-native'
import { router, Link } from 'expo-router'
import { Screen } from '@/components/Screen'
import { FormField } from '@/components/FormField'
import { PrimaryButton } from '@/components/PrimaryButton'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'

export default function RegisterScreen() {
  const { t } = useI18n()
  const { register, loading } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async () => {
    setError(null)
    if (password !== confirm) {
      setError(t('auth.passwordMismatch'))
      return
    }
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        password_confirmation: confirm,
      })
      router.replace('/(tabs)')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 24 }}>
          <Text className="text-3xl font-bold text-surface-900 dark:text-surface-50">
            {t('auth.createAccount')}
          </Text>
          <Text className="mb-8 mt-1 text-surface-500 dark:text-surface-400">
            {t('auth.signUp')}
          </Text>

          <FormField label={t('auth.name')} value={name} onChangeText={setName} />
          <FormField
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <FormField
            label={t('auth.phone')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <FormField
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <FormField
            label={t('auth.passwordConfirmation')}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
          />

          {error ? <Text className="mb-3 text-sm text-red-500">{error}</Text> : null}

          <PrimaryButton label={t('auth.signUp')} loading={loading} onPress={onSubmit} />

          <View className="mt-6 flex-row justify-center">
            <Text className="text-surface-500 dark:text-surface-400">{t('auth.hasAccount')} </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text className="font-semibold text-brand-600 dark:text-brand-400">
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
