import { Pressable, Text, ActivityIndicator, type PressableProps } from 'react-native'

export function PrimaryButton({
  label,
  loading,
  variant = 'primary',
  ...props
}: PressableProps & { label: string; loading?: boolean; variant?: 'primary' | 'ghost' }) {
  const base = 'flex-row items-center justify-center rounded-xl px-6 py-3.5'
  const styles =
    variant === 'primary'
      ? 'bg-brand-600 active:bg-brand-700'
      : 'bg-surface-200 dark:bg-surface-800 active:opacity-80'
  const textStyle =
    variant === 'primary' ? 'text-white' : 'text-surface-900 dark:text-surface-50'
  return (
    <Pressable
      {...props}
      className={`${base} ${styles} ${loading ? 'opacity-70' : ''}`}
      disabled={loading || !!props.disabled}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#ffffff' : '#2563eb'} />
      ) : (
        <Text className={`text-base font-semibold ${textStyle}`}>{label}</Text>
      )}
    </Pressable>
  )
}
