import { useId, useState, type Ref } from 'react'
import { View, Text, TextInput, Pressable, type TextInputProps } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
import { useThemeColors } from '@/theme/colors'

export function FormField({
  label,
  error,
  icon,
  secureTextEntry,
  ref,
  ...props
}: TextInputProps & {
  label: string
  error?: string
  /** Optional leading Ionicons glyph, e.g. "mail-outline". */
  icon?: keyof typeof Ionicons.glyphMap
  /** Forwarded to the TextInput (React 19 ref-as-prop), e.g. to chain focus. */
  ref?: Ref<TextInput>
}) {
  const { t } = useI18n()
  const { bodyTextStyle } = useTypography()
  const colors = useThemeColors()
  const isPassword = !!secureTextEntry
  const [hidden, setHidden] = useState(isPassword)
  const labelId = `field-label-${useId().replace(/:/g, '')}`

  return (
    <View className="mb-4">
      <Text
        nativeID={labelId}
        className="mb-1.5 text-sm font-medium text-surface-700 dark:text-surface-300"
        style={bodyTextStyle}
      >
        {label}
      </Text>
      <View
        className={`min-h-[48px] flex-row items-center rounded-control border bg-white px-3.5 dark:bg-surface-800 ${
          error ? 'border-red-400 dark:border-red-500' : 'border-surface-200 dark:border-surface-700'
        }`}
      >
        {icon ? (
          <Ionicons name={icon} size={18} color={colors.placeholder} style={{ marginRight: 8 }} importantForAccessibility="no" />
        ) : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.placeholder}
          className="flex-1 py-3 text-base text-surface-900 dark:text-surface-50"
          style={bodyTextStyle}
          secureTextEntry={isPassword ? hidden : undefined}
          accessibilityLabel={label}
          accessibilityLabelledBy={labelId}
          accessibilityHint={error}
          {...props}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            className="-mr-2 min-h-touch min-w-touch items-center justify-center active:opacity-60"
            accessibilityRole="togglebutton"
            accessibilityLabel={t('a11y.showPassword')}
            accessibilityState={{ checked: !hidden }}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.placeholder} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text
          className="mt-1 text-xs text-red-600 dark:text-red-400"
          style={bodyTextStyle}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : null}
    </View>
  )
}
