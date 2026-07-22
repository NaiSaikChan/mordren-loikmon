import { useState } from 'react'
import { ScrollView, View, Text, Pressable, KeyboardAvoidingView, Platform } from 'react-native'
import { router, Link } from 'expo-router'
import { Screen } from '@/components/Screen'
import { FormField } from '@/components/FormField'
import { PrimaryButton } from '@/components/PrimaryButton'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'

export default function LoginScreen() {
  const { t } = useI18n()
  const { login, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async () => {
    setError(null)
    try {
      await login({ email: email.trim(), password })
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
        <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'center' }}>
          <Text className="text-3xl font-bold text-surface-900 dark:text-surface-50">
            {t('auth.welcomeBack')}
          </Text>
          <Text className="mb-8 mt-1 text-surface-500 dark:text-surface-400">
            {t('auth.signIn')}
          </Text>

          <FormField
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <FormField
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />

          {error ? <Text className="mb-3 text-sm text-red-500">{error}</Text> : null}

          <Link href="/(auth)/forgot-password" asChild>
            <Pressable className="mb-6 self-end">
              <Text className="text-sm font-medium text-brand-600 dark:text-brand-400">
                {t('auth.forgotPassword')}
              </Text>
            </Pressable>
          </Link>

          <PrimaryButton label={t('auth.signIn')} loading={loading} onPress={onSubmit} />

          <View className="mt-6 flex-row justify-center">
            <Text className="text-surface-500 dark:text-surface-400">{t('auth.noAccount')} </Text>
            <Link href="/(auth)/register" asChild>
              <Pressable>
                <Text className="font-semibold text-brand-600 dark:text-brand-400">
                  {t('auth.signUp')}
                </Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
