import {
  Pressable,
  Text,
  ActivityIndicator,
  type PressableProps,
  type StyleProp,
  type TextStyle,
} from 'react-native'
import { useThemeColors } from '@/theme/colors'

export function PrimaryButton({
  label,
  loading,
  variant = 'primary',
  labelClassName,
  labelStyle,
  ...props
}: PressableProps & {
  label: string
  loading?: boolean
  variant?: 'primary' | 'ghost'
  labelClassName?: string
  labelStyle?: StyleProp<TextStyle>
}) {
  const colors = useThemeColors()
  const disabled = Boolean(loading || props.disabled)
  const base = 'min-h-[48px] flex-row items-center justify-center rounded-control px-6 py-3'
  const styles =
    variant === 'primary'
      ? 'bg-brand-600 active:bg-brand-700 active:opacity-90'
      : 'bg-surface-200 dark:bg-surface-800 active:opacity-80'
  const textStyle =
    variant === 'primary' ? 'text-white' : 'text-surface-900 dark:text-surface-50'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      {...props}
      accessibilityState={{ ...props.accessibilityState, disabled, busy: Boolean(loading) }}
      className={`${base} ${styles} ${disabled ? 'opacity-60' : ''}`}
      disabled={disabled}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onBrand : colors.brand} />
      ) : (
        <Text
          className={`text-center text-base ${textStyle} ${labelClassName ?? ''}`}
          style={labelStyle}
          maxFontSizeMultiplier={1.6}
        >
          {label}
        </Text>
      )}
    </Pressable>
  )
}
