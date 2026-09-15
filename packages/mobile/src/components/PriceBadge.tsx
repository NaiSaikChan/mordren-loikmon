import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/context/I18nContext'
import { useAuth } from '@/context/AuthContext'
import { useTypography } from '@/context/TypographyContext'
import { accessBadge } from '@/lib/access'

const TEXT_STYLE = {
  fontSize: 10.5,
  lineHeight: 14,
  paddingTop: 0,
  paddingBottom: 0,
  includeFontPadding: false,
  textAlignVertical: 'center',
} as const

/**
 * "Free" or "Premium" badge for a book/article. Premium shows a lock until the
 * viewer's subscription unlocks it (display only — the server enforces access).
 */
export function PriceBadge({ item }: { item: { is_free?: boolean } }) {
  const { t } = useI18n()
  const { entitlement } = useAuth()
  const { bodyTextStyle } = useTypography()
  const kind = accessBadge(item, entitlement)

  if (kind === 'free') {
    return (
      <View className="self-start rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2.5 min-h-6 justify-center">
        <Text className="text-emerald-700 dark:text-emerald-300" style={[bodyTextStyle, TEXT_STYLE]}>
          {t('books.free')}
        </Text>
      </View>
    )
  }

  const locked = kind === 'premium-locked'
  return (
    <View className="self-start flex-row items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 min-h-6">
      <Ionicons name={locked ? 'lock-closed' : 'star'} size={10} color={locked ? '#b45309' : '#d97706'} />
      <Text className="text-amber-700 dark:text-amber-300" style={[bodyTextStyle, TEXT_STYLE]}>
        {t('books.premium')}
      </Text>
    </View>
  )
}
