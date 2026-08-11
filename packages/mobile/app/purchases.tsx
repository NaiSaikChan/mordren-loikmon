import { useState } from 'react'
import { ScrollView, View, Text, Pressable } from 'react-native'
import { Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { BookCard } from '@/components/BookCard'
import { ArticleCard } from '@/components/ArticleCard'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { BuyCoinsModal } from '@/components/BuyCoinsModal'
import { usePurchases, type CoinPackage } from '@/hooks/usePurchases'
import { useI18n } from '@/context/I18nContext'
import { useTypography } from '@/context/TypographyContext'

function toCompact(value: number): string {
  try {
    return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
  } catch {
    return String(value)
  }
}

function getPackageCoins(pkg: CoinPackage): string {
  return String(pkg.coins ?? pkg.amount ?? '')
}

function getPackagePrice(pkg: CoinPackage): string {
  return String((pkg as { price?: unknown; value?: unknown; amount?: unknown }).price
    ?? (pkg as { value?: unknown }).value
    ?? pkg.amount
    ?? '')
}

export default function PurchasesScreen() {
  const { t } = useI18n()
  const { bodyFontFamily, headerFontFamily } = useTypography()
  const {
    books, articles, coins, packages, loading,
    redeemCoinCoupon, buyCoins, buyLoading,
  } = usePurchases()

  const [selectedPkg, setSelectedPkg] = useState<CoinPackage | null>(null)
  const totalPurchases = books.length + articles.length
  const titleStyle = bodyFontFamily ? { fontFamily: bodyFontFamily } : undefined
  const bodyStyle = bodyFontFamily ? { fontFamily: bodyFontFamily } : undefined
  const headerPreviewStyle = headerFontFamily ? { fontFamily: headerFontFamily } : undefined

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: t('purchases.title') }} />
      {loading ? (
        <LoadingSpinner />
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 36 }}
        >
          {/* Balance */}
          <View className="rounded-3xl bg-brand-600 px-5 py-5">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-4">
                <Text className="text-sm text-brand-100" style={bodyStyle}>{t('purchases.balance', { amount: String(coins) })}</Text>
                <View className="mt-2 flex-row items-end">
                  <Text className="text-4xl font-extrabold text-white" style={headerPreviewStyle}>{toCompact(Number(coins))}</Text>
                  <Text className="ml-2 pb-1 text-white/90" style={bodyStyle}>{t('purchases.coins')}</Text>
                </View>
              </View>
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
                <Ionicons name="wallet-outline" size={22} color="#ffffff" />
              </View>
            </View>

            <View className="mt-4 flex-row gap-2">
              <View className="flex-1 rounded-2xl bg-white/15 px-3 py-2.5">
                <Text className="text-[11px] text-white/80" style={bodyStyle}>{t('purchases.packages')}</Text>
                <Text className="mt-0.5 text-base font-semibold text-white" style={titleStyle}>{packages.length}</Text>
              </View>
              <View className="flex-1 rounded-2xl bg-white/15 px-3 py-2.5">
                <Text className="text-[11px] text-white/80" style={bodyStyle}>{t('purchases.history')}</Text>
                <Text className="mt-0.5 text-base font-semibold text-white" style={titleStyle}>{totalPurchases}</Text>
              </View>
            </View>
          </View>

          {/* Coin packages */}
          {packages.length > 0 ? (
            <View className="mt-6">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-lg text-surface-900 dark:text-surface-50" style={titleStyle}>
                  {t('purchases.packages')}
                </Text>
                <Text className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-semibold text-surface-600 dark:bg-surface-800 dark:text-surface-300" style={bodyStyle}>
                  {packages.length}
                </Text>
              </View>

              <Text className="mb-3 text-xs text-surface-500 dark:text-surface-400" style={bodyStyle}>
                {t('purchases.buyCoins')}
              </Text>

              <View className="flex-row flex-wrap justify-between gap-y-3">
                {packages.map((pkg) => (
                  <View key={String(pkg.id)} className="w-[48.5%]">
                    <Pressable
                      onPress={() => setSelectedPkg(pkg)}
                      className="rounded-2xl border border-surface-200 bg-white px-4 py-4 active:opacity-85 dark:border-surface-700 dark:bg-surface-800"
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-900/25">
                          <Text className="text-base" style={bodyStyle}>🪙</Text>
                        </View>
                        {pkg.name ? (
                          <Text
                            className="max-w-[65%] text-right text-[11px] text-surface-400 dark:text-surface-500"
                            style={bodyStyle}
                            numberOfLines={1}
                          >
                            {pkg.name}
                          </Text>
                        ) : null}
                      </View>

                      <Text className="mt-3 text-2xl font-extrabold text-brand-600 dark:text-brand-400" style={headerPreviewStyle}>
                        {getPackageCoins(pkg)}
                      </Text>
                      <Text className="text-xs text-surface-500 dark:text-surface-400" style={bodyStyle}>{t('purchases.coins')}</Text>

                      <View className="mt-4 flex-row items-center justify-between rounded-xl bg-surface-50 px-3 py-2 dark:bg-surface-700/40">
                        <Text className="text-sm font-semibold text-surface-700 dark:text-surface-200" style={titleStyle}>
                          {getPackagePrice(pkg)} THB
                        </Text>
                        <Ionicons name="arrow-forward-circle" size={18} color="#6366f1" />
                      </View>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View className="mt-6 items-center rounded-2xl border border-dashed border-surface-300 px-4 py-8 dark:border-surface-600">
              <Ionicons name="wallet-outline" size={26} color="#94a3b8" />
              <Text className="mt-2 text-sm font-semibold text-surface-700 dark:text-surface-300" style={titleStyle}>
                {t('purchases.noPurchases')}
              </Text>
            </View>
          )}

          {/* Purchased books */}
          {books.length > 0 ? (
            <View className="mt-8">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-lg text-surface-900 dark:text-surface-50" style={titleStyle}>
                  {t('library.purchased')}
                </Text>
                <Text className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-semibold text-surface-600 dark:bg-surface-800 dark:text-surface-300" style={bodyStyle}>
                  {books.length}
                </Text>
              </View>
              <View className="flex-row flex-wrap">
                {books.map((book) => (
                  <View key={String(book.id)} className="w-1/3 px-1.5 py-2">
                    <BookCard book={book} variant="grid" />
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Purchased articles */}
          {articles.length > 0 ? (
            <View className="mt-6">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-lg text-surface-900 dark:text-surface-50" style={titleStyle}>
                  {t('articles.title')}
                </Text>
                <Text className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-semibold text-surface-600 dark:bg-surface-800 dark:text-surface-300" style={bodyStyle}>
                  {articles.length}
                </Text>
              </View>
              {articles.map((article) => (
                <ArticleCard key={String(article.id)} article={article} />
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}

      <BuyCoinsModal
        visible={!!selectedPkg}
        pkg={selectedPkg}
        onClose={() => setSelectedPkg(null)}
        redeemCoinCoupon={redeemCoinCoupon}
        buyCoins={buyCoins}
        buyLoading={buyLoading}
      />
    </Screen>
  )
}
