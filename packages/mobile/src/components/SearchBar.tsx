import { View, TextInput, Pressable, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

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
  return (
    <View className="flex-row items-center rounded-xl bg-white dark:bg-surface-800 px-3 py-2">
      <Ionicons name="search" size={18} color="#94a3b8" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        className="ml-2 flex-1 text-base text-surface-900 dark:text-surface-50"
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={8}>
          <Ionicons name="close-circle" size={18} color="#94a3b8" />
        </Pressable>
      ) : null}
    </View>
  )
}
