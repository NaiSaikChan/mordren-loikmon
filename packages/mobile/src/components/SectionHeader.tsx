import { View, Text, Pressable } from 'react-native'
import { useTypography } from '@/context/TypographyContext'

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string
  actionLabel?: string
  onAction?: () => void
}) {
  const { bodyTextStyle, headerTextStyle } = useTypography()
  return (
    <View className="mb-3 mt-5 flex-row items-center justify-between px-4">
      <Text className="text-lg font-bold text-surface-900 dark:text-surface-50" style={headerTextStyle}>
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text className="text-sm font-medium text-brand-600 dark:text-brand-400 pt-2" style={bodyTextStyle}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}
