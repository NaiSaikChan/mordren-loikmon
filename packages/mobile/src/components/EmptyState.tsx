import { View, Text } from 'react-native'

export function EmptyState({
  icon = '📭',
  title,
  subtitle,
}: {
  icon?: string
  title: string
  subtitle?: string
}) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <Text className="text-5xl mb-3">{icon}</Text>
      <Text className="text-base text-surface-800 dark:text-surface-100 text-center">
        {title}
      </Text>
      {subtitle ? (
        <Text className="mt-1 text-sm text-surface-500 dark:text-surface-400 text-center">
          {subtitle}
        </Text>
      ) : null}
    </View>
  )
}
