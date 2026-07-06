import { useState, useCallback } from 'react';
import { FlatList, View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { apiPost } from '@/constants/api';
import { colors } from '@/theme/colors';
import type { Article } from '@/types';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function ArticleRow({ article, onPress }: { article: Article; onPress: () => void }) {
  const thumbUri = article.thumbnail
    ? encodeURI(`https://loikmon.org/webapis/uploads/thumbnails/${article.thumbnail}`)
    : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Image
        source={thumbUri ?? require('@/assets/images/placeholder.png')}
        style={styles.thumbnail}
        contentFit="cover"
      />
      <View style={styles.rowContent}>
        <Text style={[styles.title, { color: colors.label }]} numberOfLines={2}>
          {article.title ?? article.name ?? ''}
        </Text>
        <View style={styles.meta}>
          {(article.author) ? (
            <Text style={[styles.metaText, { color: colors.secondaryLabel }]} numberOfLines={1}>
              {article.author}
            </Text>
          ) : null}
          {article.createdate ? (
            <Text style={[styles.metaText, { color: colors.secondaryLabel }]}>
              {formatDate(article.createdate)}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function ArticlesScreen() {
  const router = useRouter();
  const [searchText, setSearchText] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['articles'],
    queryFn: () => apiPost<{ body: { articles: Article[] } }>('fetcharticles', {}),
    select: (d) => d.body?.articles ?? [],
  });

  const filtered = searchText.trim()
    ? (data ?? []).filter((a) => {
        const q = searchText.toLowerCase();
        return (
          (a.title ?? a.name ?? '').toLowerCase().includes(q) ||
          (a.author ?? '').toLowerCase().includes(q)
        );
      })
    : (data ?? []);

  const handleSearch = useCallback((text: string) => {
    setSearchText(text);
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Articles',
          headerSearchBarOptions: {
            placeholder: 'Search articles…',
            onChangeText: (e) => handleSearch(e.nativeEvent.text),
            onCancelButtonPress: () => setSearchText(''),
            hideWhenScrolling: false,
          },
        }}
      />
      {isLoading ? (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : isError ? (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <Text style={[styles.errorText, { color: colors.secondaryLabel }]}>
            {(error as Error)?.message ?? 'Failed to load articles'}
          </Text>
          <Pressable onPress={() => refetch()} style={[styles.retryButton, { backgroundColor: colors.brand }]}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentInsetAdjustmentBehavior="automatic"
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.listContent}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.separator }]} />
          )}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.secondaryLabel }]}>
              {searchText ? 'No results found.' : 'No articles available.'}
            </Text>
          }
          renderItem={({ item }) => (
            <ArticleRow
              article={item}
              onPress={() => router.push(`/(tabs)/(articles)/${item.id}` as any)}
            />
          )}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  rowPressed: {
    opacity: 0.6,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  rowContent: {
    flex: 1,
    marginLeft: 12,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  meta: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 88, // 16 padding + 60 thumb + 12 gap
  },
});
