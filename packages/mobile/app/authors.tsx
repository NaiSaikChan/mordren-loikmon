import { FlatList } from 'react-native'
import { Stack } from 'expo-router'
import { Screen } from '@/components/Screen'
import { AuthorCard } from '@/components/AuthorCard'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EmptyState } from '@/components/EmptyState'
import { useAuthors } from '@/hooks/useAuthors'
import { useI18n } from '@/context/I18nContext'

export default function AuthorsScreen() {
  const { t } = useI18n()
  const { items, loading } = useAuthors()

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: t('nav.authors') }} />
      {loading ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <AuthorCard author={item} />}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<EmptyState icon="👤" title={t('authors.noAuthors')} />}
        />
      )}
    </Screen>
  )
}
