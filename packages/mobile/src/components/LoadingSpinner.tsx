import { View, ActivityIndicator, Text } from 'react-native'

export function LoadingSpinner({ label }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center py-10">
      <ActivityIndicator size="large" color="#2563eb" />
      {label ? <Text className="mt-3 text-surface-500 dark:text-surface-400">{label}</Text> : null}
    </View>
  )
}
