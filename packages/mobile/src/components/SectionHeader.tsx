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
    <View className="mb-2 mt-5 flex-row items-center justify-between px-4">
      <Text
        className="flex-1 text-lg text-surface-900 dark:text-surface-50"
        style={headerTextStyle}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          className="min-h-touch justify-center pl-3 active:opacity-60"
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}: ${title}`}
        >
          <Text className="text-sm font-medium text-brand-600 dark:text-brand-400" style={bodyTextStyle}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}
