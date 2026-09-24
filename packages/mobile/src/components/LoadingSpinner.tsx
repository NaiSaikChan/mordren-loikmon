import { View, ActivityIndicator, Text } from 'react-native'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
import { useThemeColors } from '@/theme/colors'

export function LoadingSpinner({ label }: { label?: string }) {
  const colors = useThemeColors()
  const { t } = useI18n()
  const { bodyTextStyle } = useTypography()
  return (
    <View
      className="flex-1 items-center justify-center py-10"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? t('a11y.loading')}
      accessibilityState={{ busy: true }}
    >
      <ActivityIndicator size="large" color={colors.brand} />
      {label ? (
        <Text className="mt-3 text-sm text-surface-500 dark:text-surface-400" style={bodyTextStyle}>
          {label}
        </Text>
      ) : null}
    </View>
  )
}
