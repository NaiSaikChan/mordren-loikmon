import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack, Link } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { apiGet, apiPost } from '@/constants/api';
import { colors } from '@/theme/colors';
import type { Book, Article } from '@/types';

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.label }]}>{title}</Text>
      <Link href={href as any} style={[styles.seeAll, { color: colors.accent }]}>See All</Link>
    </View>
  );
}

function BookCard({ book }: { book: Book }) {
  const cover = book.thumbnail
    ? encodeURI(`https://loikmon.org/webapis/uploads/thumbnails/${book.thumbnail}`)
    : null;
  return (
    <Link href={`/book/${book.id}` as any} asChild>
      <Pressable style={styles.bookCard}>
        <Image source={cover ?? require('@/assets/images/placeholder.png')} style={styles.bookCover} contentFit="cover" />
        <Text style={[styles.bookTitle, { color: colors.label }]} numberOfLines={2}>
          {book.name ?? book.title}
        </Text>
        {(book.epub || book.epubfile) ? (
          <View style={[styles.badge, { backgroundColor: '#dbeafe' }]}>
            <Text style={{ color: '#1d4ed8', fontSize: 10, fontWeight: '600' }}>EPUB</Text>
          </View>
        ) : (book.pdf || book.pdffile) ? (
          <View style={[styles.badge, { backgroundColor: '#fee2e2' }]}>
            <Text style={{ color: '#b91c1c', fontSize: 10, fontWeight: '600' }}>PDF</Text>
          </View>
        ) : null}
      </Pressable>
    </Link>
  );
}

export default function HomeScreen() {
  const { data: booksData, isLoading: booksLoading } = useQuery({
    queryKey: ['books'],
    queryFn: () => apiGet<{ body: { books: Book[] } }>('fetchbooks'),
    select: (d) => d.body?.books?.slice(0, 8) ?? [],
  });

  const { data: articlesData, isLoading: articlesLoading } = useQuery({
    queryKey: ['articles'],
    queryFn: () => apiPost<{ body: { articles: Article[] } }>('fetcharticles', {}),
    select: (d) => d.body?.articles?.slice(0, 6) ?? [],
  });

  return (
    <>
      <Stack.Screen options={{ title: 'Loikmon' }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.container}
      >
        {/* Books Section */}
        <SectionHeader title="📚 Books" href="/(tabs)/(books)" />
        {booksLoading ? (
          <ActivityIndicator color={colors.brand} style={{ marginVertical: 20 }} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {booksData?.map((book) => <BookCard key={book.id} book={book} />)}
          </ScrollView>
        )}

        {/* Articles Section */}
        <SectionHeader title="📰 Articles" href="/(tabs)/(articles)" />
        {articlesLoading ? (
          <ActivityIndicator color={colors.brand} style={{ marginVertical: 20 }} />
        ) : (
          <View style={styles.articleList}>
            {articlesData?.map((article) => (
              <Link key={article.id} href={`/article/${article.id}` as any} asChild>
                <Pressable style={[styles.articleCard, { borderBottomColor: colors.separator }]}>
                  <Text style={[styles.articleTitle, { color: colors.label }]} numberOfLines={2}>
                    {article.title ?? article.name}
                  </Text>
                  <Text style={[styles.articleMeta, { color: colors.secondaryLabel }]}>
                    {article.author ?? ''}
                  </Text>
                </Pressable>
              </Link>
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 32, paddingTop: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 24, marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontWeight: '700' },
  seeAll: { fontSize: 14 },
  row: { paddingHorizontal: 12, gap: 12 },
  bookCard: { width: 120 },
  bookCover: { width: 120, height: 170, borderRadius: 8, backgroundColor: '#e5e7eb' },
  bookTitle: { fontSize: 12, marginTop: 6, lineHeight: 16 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  articleList: { paddingHorizontal: 16, gap: 0 },
  articleCard: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  articleTitle: { fontSize: 15, fontWeight: '500', lineHeight: 20 },
  articleMeta: { fontSize: 12, marginTop: 3 },
});
