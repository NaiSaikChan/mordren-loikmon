import { View, Text } from 'react-native'
import { useTypography } from '@/context/TypographyContext'

export function EmptyState({
  icon = '📭',
  title,
  subtitle,
}: {
  icon?: string
  title: string
  subtitle?: string
}) {
  const { bodyTextStyle, headerTextStyle } = useTypography()
  return (
    <View className="flex-1 items-center justify-center px-8 py-16" accessible accessibilityRole="text">
      <Text className="mb-3 text-5xl" importantForAccessibility="no" accessibilityElementsHidden>
        {icon}
      </Text>
      <Text className="text-center text-base text-surface-800 dark:text-surface-100" style={headerTextStyle}>
        {title}
      </Text>
      {subtitle ? (
        <Text className="mt-1 text-center text-sm text-surface-500 dark:text-surface-400" style={bodyTextStyle}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  )
}
