import { View, Text, TextInput, type TextInputProps } from 'react-native'

export function FormField({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-sm font-medium text-surface-700 dark:text-surface-300">
        {label}
      </Text>
      <TextInput
        placeholderTextColor="#94a3b8"
        className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-3 text-base text-surface-900 dark:text-surface-50"
        {...props}
      />
      {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
    </View>
  )
}
