import { useState } from 'react'
import { ScrollView, View, Text, Image, Pressable, Alert, FlatList } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { purchases as purchasesApi } from '@loikmon/api'
import { Screen } from '@/components/Screen'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { BookCard } from '@/components/BookCard'
import { PrimaryButton } from '@/components/PrimaryButton'
import { useBookDetail } from '@/hooks/useBooks'
import { useAuth } from '@/context/AuthContext'
import { useLibrary } from '@/context/LibraryContext'
import { useI18n } from '@/context/I18nContext'
import { pickCover } from '@/lib/url'
import { isFree } from '@/lib/normalize'

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t } = useI18n()
  const { book, chapters, related, loading, error } = useBookDetail(id)
  const { user, isLoggedIn, refreshUser } = useAuth()
  const { isBookmarked, toggleBook } = useLibrary()
  const [purchasing, setPurchasing] = useState(false)

  if (loading) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title: '' }} />
        <LoadingSpinner />
      </Screen>
    )
  }

  if (error || !book) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title: '' }} />
        <EmptyState icon="⚠️" title={t('common.error')} />
      </Screen>
    )
  }

  const cover = pickCover(book as unknown as Record<string, unknown>)
  const author = (book.authorname as string) ?? (book.author as string) ?? ''
  const free = isFree(book as unknown as Record<string, unknown>)
  const source = (book.pdf as string) ?? (book.pdffile as string) ?? (book.epub as string) ?? ''
  const price = Number(book.amount ?? book.price ?? 0)
  const bookmarked = isBookmarked('book', book.id)

  const openReader = () => {
    if (!source) {
      Alert.alert(t('reader.notAvailable'))
      return
    }
    router.push({
      pathname: '/reader',
      params: { url: source, title: book.title },
    })
  }

  const onPurchase = async () => {
    if (!isLoggedIn || !user?.email) {
      router.push('/(auth)/login')
      return
    }
    setPurchasing(true)
    try {
      const res = await purchasesApi.purchaseBook(user.email, book.id, price)
      const body = res.data as Record<string, unknown>
      if (body.status === 'error' || body.status === 'fail') {
        Alert.alert(t('common.error'), String(body.message ?? ''))
      } else {
        const coinRes = await purchasesApi.getUserCoins(user.email).catch(() => ({ data: {} }))
        const coins = Number((coinRes.data as Record<string, unknown>).coins ?? user.coins ?? 0)
        await refreshUser({ ...user, coins })
        Alert.alert(t('purchases.approved'))
        openReader()
      }
    } catch {
      Alert.alert(t('common.error'))
    } finally {
      setPurchasing(false)
    }
  }

  return (
    <Screen edges={[]}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Pressable onPress={() => toggleBook(book)} hitSlop={8}>
              <Ionicons
                name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                size={22}
                color="#2563eb"
              />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row p-4">
          <View className="h-48 w-32 overflow-hidden rounded-xl bg-surface-200 dark:bg-surface-800">
            {cover ? (
              <Image source={{ uri: cover }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Text className="text-4xl">📚</Text>
              </View>
            )}
          </View>
          <View className="ml-4 flex-1 justify-center">
            <Text className="text-xl font-bold text-surface-900 dark:text-surface-50">
              {book.title}
            </Text>
            {author ? (
              <Text className="mt-1 text-surface-500 dark:text-surface-400">
                {t('common.by')} {author}
              </Text>
            ) : null}
            <View className="mt-2 flex-row items-center gap-3">
              {book.rating ? (
                <Text className="text-sm text-yellow-500">
                  ⭐ {Number(book.rating).toFixed(1)}
                </Text>
              ) : null}
              {book.pages || book.pagecount ? (
                <Text className="text-sm text-surface-400">
                  {String(book.pages ?? book.pagecount)} {t('books.pages')}
                </Text>
              ) : null}
            </View>
            <Text className="mt-2 text-base font-semibold text-brand-600 dark:text-brand-400">
              {free ? t('books.free') : `${price} ${t('purchases.coins')}`}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View className="px-4">
          {free ? (
            <PrimaryButton label={t('books.read')} onPress={openReader} />
          ) : (
            <PrimaryButton
              label={`${t('books.purchase')} · ${price} ${t('purchases.coins')}`}
              loading={purchasing}
              onPress={onPurchase}
            />
          )}
        </View>

        {/* Description */}
        {book.description || book.about ? (
          <View className="px-4 pt-6">
            <Text className="mb-2 text-lg font-bold text-surface-900 dark:text-surface-50">
              {t('books.title')}
            </Text>
            <Text className="leading-6 text-surface-600 dark:text-surface-300">
              {String(book.description ?? book.about)}
            </Text>
          </View>
        ) : null}

        {/* Chapters */}
        {chapters.length > 0 ? (
          <View className="px-4 pt-6">
            <Text className="mb-2 text-lg font-bold text-surface-900 dark:text-surface-50">
              {t('books.chapters')}
            </Text>
            {chapters.map((chapter, index) => (
              <View
                key={String(chapter.id)}
                className="flex-row items-center border-b border-surface-100 dark:border-surface-800 py-3"
              >
                <Text className="w-8 text-surface-400">{index + 1}</Text>
                <Text className="flex-1 text-surface-800 dark:text-surface-100">
                  {chapter.title}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Related */}
        {related.length > 0 ? (
          <View className="pt-6">
            <Text className="mb-3 px-4 text-lg font-bold text-surface-900 dark:text-surface-50">
              {t('books.related')}
            </Text>
            <FlatList
              horizontal
              data={related}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => <BookCard book={item} />}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  )
}
