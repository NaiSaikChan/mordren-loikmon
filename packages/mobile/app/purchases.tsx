import { useState } from 'react'
import { ScrollView, View, Text, Pressable, TextInput, Alert } from 'react-native'
import { Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { BookCard } from '@/components/BookCard'
import { ArticleCard } from '@/components/ArticleCard'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PrimaryButton } from '@/components/PrimaryButton'
import { usePurchases } from '@/hooks/usePurchases'
import { useI18n } from '@/context/I18nContext'

export default function PurchasesScreen() {
  const { t } = useI18n()
  const { books, articles, coins, packages, loading } = usePurchases()
  const [coupon, setCoupon] = useState('')

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: t('purchases.title') }} />
      {loading ? (
        <LoadingSpinner />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          {/* Balance */}
          <View className="m-4 rounded-2xl bg-brand-600 p-5">
            <Text className="text-sm text-brand-100">{t('purchases.balance')}</Text>
            <View className="mt-1 flex-row items-center">
              <Ionicons name="server" size={22} color="#ffffff" />
              <Text className="ml-2 text-3xl font-bold text-white">{coins}</Text>
              <Text className="ml-1 text-white">{t('purchases.coins')}</Text>
            </View>
          </View>

          {/* Coin packages */}
          {packages.length > 0 ? (
            <View className="px-4">
              <Text className="mb-2 text-lg font-bold text-surface-900 dark:text-surface-50">
                {t('purchases.packages')}
              </Text>
              <View className="flex-row flex-wrap">
                {packages.map((pkg) => (
                  <Pressable
                    key={String(pkg.id)}
                    onPress={() => Alert.alert(t('purchases.paymentInstructions'))}
                    className="mb-3 mr-3 rounded-xl bg-white dark:bg-surface-800 px-5 py-4"
                  >
                    <Text className="text-lg font-bold text-brand-600 dark:text-brand-400">
                      {String(pkg.coins ?? pkg.amount ?? '')} {t('purchases.coins')}
                    </Text>
                    <Text className="text-sm text-surface-500 dark:text-surface-400">
                      {String(pkg.price ?? pkg.amount ?? '')}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {/* Redeem coupon */}
          <View className="px-4 pt-2">
            <Text className="mb-2 text-lg font-bold text-surface-900 dark:text-surface-50">
              {t('purchases.redeemCoupon')}
            </Text>
            <View className="flex-row items-center">
              <TextInput
                value={coupon}
                onChangeText={setCoupon}
                placeholder="CODE"
                autoCapitalize="characters"
                placeholderTextColor="#94a3b8"
                className="mr-2 flex-1 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-3 text-surface-900 dark:text-surface-50"
              />
              <View className="w-28">
                <PrimaryButton
                  label={t('common.submit')}
                  onPress={() => Alert.alert(t('purchases.redeemCoupon'), coupon)}
                />
              </View>
            </View>
          </View>

          {/* Purchased books */}
          {books.length > 0 ? (
            <View className="pt-4">
              <Text className="mb-2 px-4 text-lg font-bold text-surface-900 dark:text-surface-50">
                {t('library.purchased')}
              </Text>
              <View className="flex-row flex-wrap px-2">
                {books.map((book) => (
                  <View key={String(book.id)} className="w-1/3 p-2">
                    <BookCard book={book} variant="grid" />
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Purchased articles */}
          {articles.length > 0 ? (
            <View className="px-4 pt-2">
              {articles.map((article) => (
                <ArticleCard key={String(article.id)} article={article} />
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  )
}
