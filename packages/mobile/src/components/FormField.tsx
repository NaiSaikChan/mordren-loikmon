import { useState } from 'react'
import { View, Text, TextInput, Pressable, type TextInputProps } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export function FormField({
  label,
  error,
  icon,
  secureTextEntry,
  ...props
}: TextInputProps & {
  label: string
  error?: string
  /** Optional leading Ionicons glyph, e.g. "mail-outline". */
  icon?: keyof typeof Ionicons.glyphMap
}) {
  const isPassword = !!secureTextEntry
  const [hidden, setHidden] = useState(isPassword)

  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-sm font-medium text-surface-700 dark:text-surface-300">
        {label}
      </Text>
      <View
        className={`flex-row items-center rounded-xl border bg-white dark:bg-surface-800 px-3.5 ${
          error ? 'border-red-400 dark:border-red-500' : 'border-surface-200 dark:border-surface-700'
        }`}
      >
        {icon ? <Ionicons name={icon} size={18} color="#94a3b8" style={{ marginRight: 8 }} /> : null}
        <TextInput
          placeholderTextColor="#94a3b8"
          className="flex-1 py-3 text-base text-surface-900 dark:text-surface-50"
          secureTextEntry={isPassword ? hidden : undefined}
          {...props}
        />
        {isPassword ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8} className="pl-2 py-1">
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={18} color="#94a3b8" />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
    </View>
  )
}
