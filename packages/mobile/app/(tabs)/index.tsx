import { ScrollView, View, Text, Pressable, FlatList } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { SectionHeader } from '@/components/SectionHeader'
import { BookCard } from '@/components/BookCard'
import { ArticleCard } from '@/components/ArticleCard'
import { AuthorCard } from '@/components/AuthorCard'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useBooks } from '@/hooks/useBooks'
import { useArticles } from '@/hooks/useArticles'
import { useAuthors } from '@/hooks/useAuthors'
import { useI18n } from '@/context/I18nContext'
import { useAuth } from '@/context/AuthContext'
import { useTypography } from '@/context/TypographyContext'


export default function HomeScreen() {
  const { t } = useI18n()
  const { user, isLoggedIn } = useAuth()
  const { bodyTextStyle, headerTextStyle } = useTypography()
  const books = useBooks()
  const audiobooks = useBooks({ type: 'audio' })
  const articles = useArticles()
  const authors = useAuthors()

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-1">
          <View>
            <Text className="text-sm text-surface-500 dark:text-surface-400 mb-3 px-4 pt-1" style={headerTextStyle}>
              {t('home.greeting')}
            </Text>
            <Text className="text-2xl font-bold text-surface-900 dark:text-surface-50" style={headerTextStyle}>
              {isLoggedIn ? (user?.name ?? 'Loikmon') : 'Loikmon'}
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            {isLoggedIn ? (
              <Pressable
                onPress={() => router.push('/purchases')}
                className="flex-row items-center rounded-full bg-brand-50 dark:bg-brand-900/30 px-3 py-1.5"
              >
                <Ionicons name="server-outline" size={16} color="#2563eb" />
                <Text className="ml-1 text-sm text-brand-600 dark:text-brand-300">
                  {Number(user?.coins ?? 0)}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push('/(auth)/login')}
                className="items-center justify-center rounded-full bg-brand-600 px-5 py-2"
              >
                <Text
                  className="text-sm font-normal text-white pt-1"
                  style={bodyTextStyle}
                >
                  {t('auth.login')}
                </Text>
              </Pressable>
            )}
            <Pressable onPress={() => router.push('/settings')} hitSlop={8}>
              <Ionicons name="settings-outline" size={24} color="#94a3b8" />
            </Pressable>
          </View>
        </View>

        {/* Latest books */}
        <SectionHeader
          title={t('home.latestBooks')}
          actionLabel={t('home.seeAll')}
          onAction={() => router.push('/books')}
        />
        {books.loading ? (
          <LoadingSpinner />
        ) : (
          <FlatList
            horizontal
            data={books.items.slice(0, 12)}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => <BookCard book={item} />}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          />
        )}

        {/* Audiobooks
        <SectionHeader
          title={t('home.audiobooks')}
          actionLabel={t('home.seeAll')}
          onAction={() => router.push('/audio')}
        />
        {audiobooks.loading ? (
          <LoadingSpinner />
        ) : (
          <FlatList
            horizontal
            data={audiobooks.items.slice(0, 12)}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => <BookCard book={item} />}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          />
        )} */}

        {/* Latest articles */}
        <SectionHeader
          title={t('home.latestArticles')}
          actionLabel={t('home.seeAll')}
          onAction={() => router.push('/articles')}
        />
        <View className="px-4">
          {articles.items.slice(0, 4).map((article) => (
            <ArticleCard key={String(article.id)} article={article} />
          ))}
        </View>

        {/* Popular authors */}
        <SectionHeader
          title={t('home.popularAuthors')}
          actionLabel={t('home.seeAll')}
          onAction={() => router.push('/authors')}
        />
        <View className="px-4">
          {authors.items.slice(0, 4).map((author) => (
            <AuthorCard key={String(author.id)} author={author} />
          ))}
        </View>
      </ScrollView>
    </Screen>
  )
}
