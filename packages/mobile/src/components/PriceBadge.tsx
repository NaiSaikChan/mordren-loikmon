import { View, Text } from 'react-native'
import { useI18n } from '@/context/I18nContext'
import { isFree } from '@/lib/normalize'

/** Displays "Free" or the coin price for a book/article/media record. */
export function PriceBadge({ item }: { item: Record<string, unknown> }) {
  const { t } = useI18n()
  if (isFree(item)) {
    return (
      <View className="self-start rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5">
        <Text className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          {t('books.free')}
        </Text>
      </View>
    )
  }
  const price = item.amount ?? item.price
  return (
    <Text className="text-xs font-semibold text-brand-600 dark:text-brand-400">
      {String(price)} {t('purchases.coins')}
    </Text>
  )
}
