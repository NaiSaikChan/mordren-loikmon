import { View, TextInput, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'
import { useThemeColors } from '@/theme/colors'

export function SearchBar({
  value,
  onChangeText,
  onSubmit,
  placeholder,
}: {
  value: string
  onChangeText: (text: string) => void
  onSubmit?: () => void
  placeholder?: string
}) {
  const colors = useThemeColors()
  const { t } = useI18n()
  const { bodyTextStyle } = useTypography()
  return (
    <View className="min-h-[48px] flex-row items-center rounded-control bg-white px-3 dark:bg-surface-800">
      <Ionicons name="search" size={18} color={colors.placeholder} importantForAccessibility="no" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityRole="search"
        accessibilityLabel={placeholder ?? t('nav.search')}
        className="ml-2 flex-1 py-2 text-base text-surface-900 dark:text-surface-50"
        style={bodyTextStyle}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={13}
          className="active:opacity-60"
          accessibilityRole="button"
          accessibilityLabel={t('a11y.clearSearch')}
        >
          <Ionicons name="close-circle" size={18} color={colors.placeholder} />
        </Pressable>
      ) : null}
    </View>
  )
}
