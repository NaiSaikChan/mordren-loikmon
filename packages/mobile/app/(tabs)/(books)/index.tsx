import {
  FlatList,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState, useMemo } from 'react';
import { apiGet } from '@/constants/api';
import { colors } from '@/theme/colors';
import type { Book } from '@/types';

const CARD_WIDTH = 160;
const COVER_HEIGHT = 220;
const COLUMN_COUNT = 2;

function FormatBadge({ book }: { book: Book }) {
  if (book.epub || book.epubfile) {
    return (
      <View style={[styles.badge, styles.badgeEpub]}>
        <Text style={[styles.badgeText, { color: '#1d4ed8' }]}>EPUB</Text>
      </View>
    );
  }
  if (book.pdf || book.pdffile) {
    return (
      <View style={[styles.badge, styles.badgePdf]}>
        <Text style={[styles.badgeText, { color: '#b91c1c' }]}>PDF</Text>
      </View>
    );
  }
  return null;
}

function BookCard({ book }: { book: Book }) {
  const router = useRouter();
  const coverUri = book.thumbnail
    ? encodeURI(`https://loikmon.org/webapis/uploads/thumbnails/${book.thumbnail}`)
    : null;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.75 : 1 }]}
      onPress={() => router.push(`/(tabs)/(books)/${book.id}` as any)}
    >
      <Image
        source={coverUri ?? require('@/assets/icon.png')}
        style={styles.cover}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.label }]} numberOfLines={2}>
          {book.name ?? book.title}
        </Text>
        <FormatBadge book={book} />
      </View>
    </Pressable>
  );
}

export default function BooksScreen() {
  const [searchText, setSearchText] = useState('');
  const { width } = useWindowDimensions();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['books'],
    queryFn: () => apiGet<{ body: { books: Book[] } }>('fetchbooks'),
    select: (d) => d.body?.books ?? [],
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = searchText.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (b) =>
        (b.name ?? b.title ?? '').toLowerCase().includes(q) ||
        (b.author ?? '').toLowerCase().includes(q),
    );
  }, [data, searchText]);

  // Derive responsive card width so two columns fit the screen with gutters
  const gutterH = 16;
  const gap = 12;
  const cardWidth = (width - gutterH * 2 - gap) / COLUMN_COUNT;

  const renderItem = ({ item }: { item: Book }) => <BookCard book={item} />;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Books',
          headerSearchBarOptions: {
            placeholder: 'Search books…',
            onChangeText: (e) => setSearchText(e.nativeEvent.text),
            onCancelButtonPress: () => setSearchText(''),
            hideWhenScrolling: false,
          },
        }}
      />

      {isLoading ? (
        <View style={[styles.centered, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : error ? (
        <View style={[styles.centered, { backgroundColor: colors.background }]}>
          <Text style={[styles.errorText, { color: colors.error }]}>
            Failed to load books.
          </Text>
          <Pressable
            style={[styles.retryButton, { backgroundColor: colors.brand }]}
            onPress={() => refetch()}
          >
            <Text style={styles.retryLabel}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          numColumns={COLUMN_COUNT}
          key={`cols-${COLUMN_COUNT}`}
          contentInsetAdjustmentBehavior="automatic"
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={[
            styles.listContent,
            { paddingHorizontal: gutterH },
          ]}
          columnWrapperStyle={{ gap }}
          ItemSeparatorComponent={() => <View style={{ height: gap }} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={[styles.emptyText, { color: colors.secondaryLabel }]}>
                No books found.
              </Text>
            </View>
          }
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  listContent: {
    paddingTop: 16,
    paddingBottom: 40,
  },
  card: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  cover: {
    width: '100%',
    aspectRatio: CARD_WIDTH / COVER_HEIGHT,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
  },
  cardBody: {
    paddingTop: 6,
    paddingHorizontal: 2,
    paddingBottom: 4,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeEpub: {
    backgroundColor: '#dbeafe',
  },
  badgePdf: {
    backgroundColor: '#fee2e2',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  errorText: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
  },
});
