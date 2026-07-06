import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { apiPost } from '@/constants/api';
import { colors } from '@/theme/colors';
import type { Article } from '@/types';

/** Strip HTML tags, decode common entities, collapse whitespace. */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function ArticleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: article, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['article', id],
    queryFn: () =>
      apiPost<{ body: Article }>('getitem', { type: 'article', id }),
    select: (d) => d.body,
    enabled: !!id,
  });

  const thumbUri = article?.thumbnail
    ? encodeURI(`https://loikmon.org/webapis/uploads/thumbnails/${article.thumbnail}`)
    : null;

  const handleReadOnWeb = () => {
    Linking.openURL(`https://naisaikchan.github.io/mordren-loikmon/articles/${id}`);
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: '', headerLargeTitle: false }} />
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      </>
    );
  }

  if (isError || !article) {
    return (
      <>
        <Stack.Screen options={{ title: '', headerLargeTitle: false }} />
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <Text style={[styles.errorText, { color: colors.secondaryLabel }]}>
            {(error as Error)?.message ?? 'Failed to load article'}
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={[styles.retryButton, { backgroundColor: colors.brand }]}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </>
    );
  }

  const plainContent = article.content ? stripHtml(article.content) : '';

  return (
    <>
      <Stack.Screen options={{ title: '', headerLargeTitle: false }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.container}
      >
        {/* Hero thumbnail */}
        {thumbUri ? (
          <Image
            source={thumbUri}
            style={styles.heroImage}
            contentFit="cover"
          />
        ) : null}

        <View style={styles.body}>
          {/* Title */}
          <Text style={[styles.title, { color: colors.label }]}>
            {article.title ?? article.name ?? ''}
          </Text>

          {/* Meta row: author + date */}
          <View style={styles.metaRow}>
            {article.author ? (
              <Text style={[styles.author, { color: colors.secondaryLabel }]}>
                {article.author}
              </Text>
            ) : null}
            {article.createdate ? (
              <Text style={[styles.date, { color: colors.secondaryLabel }]}>
                {formatDate(article.createdate)}
              </Text>
            ) : null}
          </View>

          {/* Separator */}
          <View style={[styles.divider, { backgroundColor: colors.separator }]} />

          {/* Content */}
          {plainContent ? (
            <Text style={[styles.content, { color: colors.label }]}>
              {plainContent}
            </Text>
          ) : null}

          {/* Read on web */}
          <Pressable
            onPress={handleReadOnWeb}
            style={({ pressed }) => [
              styles.readWebButton,
              { backgroundColor: colors.brand, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Text style={styles.readWebButtonText}>Read on Website</Text>
          </Pressable>
        </View>
      </ScrollView>
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
  container: {
    paddingBottom: 48,
  },
  heroImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#e5e7eb',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  author: {
    fontSize: 14,
    fontWeight: '500',
  },
  date: {
    fontSize: 13,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 16,
  },
  content: {
    fontSize: 16,
    lineHeight: 26,
    marginBottom: 28,
  },
  readWebButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  readWebButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
