import { View, Text } from 'react-native'
import { useI18n } from '@/context/I18nContext'
import { isFree } from '@/lib/normalize'
import { useTypography } from '@/context/TypographyContext'

/** Displays "Free" or the coin price for a book/articles/media record. */
export function PriceBadge({ item }: { item: Record<string, unknown> }) {
  const { t } = useI18n()
  const badgeContainerClass = 'self-start rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2.5 min-h-6 justify-center'
  const badgeTextClass = 'text-emerald-700 dark:text-emerald-300'
  const { bodyTextStyle } = useTypography()
  if (isFree(item)) {
    return (
      <View className={badgeContainerClass}>
        <Text
          className={badgeTextClass}
          style={[
            bodyTextStyle,
            {
              fontSize: 10.5,
              lineHeight: 14,
              paddingTop: 0,
              paddingBottom: 0,
              includeFontPadding: false,
              textAlignVertical: 'center',
            },
          ]}
        >
          {t('books.free')}
        </Text>
      </View>
    )
  }
  const price = item.amount ?? item.price
  return (
    <View className={badgeContainerClass}>
      <Text
        className={badgeTextClass}
        style={[
          bodyTextStyle,
          {
            fontSize: 10.5,
            lineHeight: 14,
            paddingTop: 0,
            paddingBottom: 0,
            includeFontPadding: false,
            textAlignVertical: 'center',
          },
        ]}
      >
        {String(price)} {t('purchases.coins')}
      </Text>
    </View>
  )
}
