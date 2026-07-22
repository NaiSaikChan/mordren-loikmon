import { useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { BookCard } from '@/components/BookCard'
import { ArticleCard } from '@/components/ArticleCard'
import { EmptyState } from '@/components/EmptyState'
import { useLibrary } from '@/context/LibraryContext'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'

type Tab = 'bookmarks' | 'purchased'

export default function LibraryScreen() {
  const { t } = useI18n()
  const { books, articles } = useLibrary()
  const { isLoggedIn } = useAuth()
  const [tab, setTab] = useState<Tab>('bookmarks')

  const empty = books.length === 0 && articles.length === 0

  return (
    <Screen>
      <View className="px-4 pt-2">
        <Text className="text-2xl font-bold text-surface-900 dark:text-surface-50">
          {t('nav.library')}
        </Text>
      </View>

      {/* Segmented control */}
      <View className="mx-4 mt-3 flex-row rounded-xl bg-surface-200 dark:bg-surface-800 p-1">
        {(['bookmarks', 'purchased'] as Tab[]).map((key) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            className={`flex-1 rounded-lg py-2 ${
              tab === key ? 'bg-white dark:bg-surface-700' : ''
            }`}
          >
            <Text
              className={`text-center text-sm font-medium ${
                tab === key
                  ? 'text-surface-900 dark:text-surface-50'
                  : 'text-surface-500 dark:text-surface-400'
              }`}
            >
              {t(key === 'bookmarks' ? 'library.bookmarks' : 'library.purchased')}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'purchased' ? (
        <PurchasedTab isLoggedIn={isLoggedIn} />
      ) : empty ? (
        <EmptyState icon="🔖" title={t('library.empty')} subtitle={t('library.emptyHint')} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          {books.length > 0 ? (
            <View className="flex-row flex-wrap px-2 pt-4">
              {books.map((book) => (
                <View key={String(book.id)} className="w-1/3 p-2">
                  <BookCard book={book} variant="grid" />
                </View>
              ))}
            </View>
          ) : null}
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

function PurchasedTab({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { t } = useI18n()
  if (!isLoggedIn) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <EmptyState icon="🔐" title={t('auth.login')} subtitle={t('purchases.noPurchases')} />
        <Pressable
          onPress={() => router.push('/(auth)/login')}
          className="mt-2 rounded-xl bg-brand-600 px-6 py-3"
        >
          <Text className="font-semibold text-white">{t('auth.signIn')}</Text>
        </Pressable>
      </View>
    )
  }
  return (
    <Pressable
      onPress={() => router.push('/purchases')}
      className="m-4 flex-row items-center justify-between rounded-xl bg-white dark:bg-surface-800 p-4"
    >
      <Text className="font-semibold text-surface-900 dark:text-surface-50">
        {t('purchases.title')}
      </Text>
      <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
    </Pressable>
  )
}
