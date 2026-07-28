import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Screen } from '@/components/Screen'
import { FormField } from '@/components/FormField'
import { PrimaryButton } from '@/components/PrimaryButton'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'


export default function ForgotPasswordScreen() {
  const { t } = useI18n()
  const { resetPassword, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async () => {
    setError(null)
    setMessage(null)
    try {
      const msg = await resetPassword(email.trim())
      setMessage(msg)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const { bodyTextStyle } = useTypography()
  const { headerTextStyle } = useTypography()

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'center' }}>
        <Text className="text-3xl text-surface-900 dark:text-surface-50 pt-safe" style={headerTextStyle}>
          {t('auth.resetPassword')}
        </Text>
        <Text className="mb-8 mt-1 text-surface-500 dark:text-surface-400" style={bodyTextStyle}>
          {t('auth.resetInstructions')}
        </Text>

        <FormField
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        {message ? <Text className="mb-3 text-sm text-emerald-600" style={bodyTextStyle}>{message}</Text> : null}
        {error ? <Text className="mb-3 text-sm text-red-500" style={bodyTextStyle}>{error}</Text> : null}

        <PrimaryButton label={t('auth.sendResetLink')} loading={loading} onPress={onSubmit} labelStyle={bodyTextStyle} />
        <View className="h-3" />
        <PrimaryButton
          label={t('auth.backToLogin')}
          variant="ghost"
          onPress={() => router.back()}
          labelStyle={bodyTextStyle}
        />
      </ScrollView>
    </Screen>
  )
}
