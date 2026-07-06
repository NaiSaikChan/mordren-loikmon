import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  Linking,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { apiPost } from '@/constants/api';
import { colors } from '@/theme/colors';
import type { Book } from '@/types';

interface BookDetail extends Book {
  description?: string;
}

interface GetItemResponse {
  book: BookDetail;
}

// ─── Skeleton placeholder ──────────────────────────────────────────────────────

function SkeletonBlock({
  width,
  height,
  radius = 8,
  style,
}: {
  width: number | string;
  height: number;
  radius?: number;
  style?: object;
}) {
  return (
    <View
      style={[
        {
          width: width as any,
          height,
          borderRadius: radius,
          backgroundColor: '#e5e7eb',
        },
        style,
      ]}
    />
  );
}

function BookDetailSkeleton({ coverWidth }: { coverWidth: number }) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <SkeletonBlock width={coverWidth} height={coverWidth * 1.42} radius={12} />
      <View style={{ marginTop: 20, gap: 10 }}>
        <SkeletonBlock width="80%" height={24} radius={6} />
        <SkeletonBlock width="50%" height={16} radius={6} />
        <SkeletonBlock width={60} height={22} radius={6} style={{ marginTop: 4 }} />
        <SkeletonBlock width="100%" height={14} radius={6} style={{ marginTop: 12 }} />
        <SkeletonBlock width="95%" height={14} radius={6} />
        <SkeletonBlock width="90%" height={14} radius={6} />
        <SkeletonBlock width="70%" height={14} radius={6} />
      </View>
    </ScrollView>
  );
}

// ─── Format badge ─────────────────────────────────────────────────────────────

function FormatBadge({ book }: { book: BookDetail }) {
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

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const coverWidth = Math.min(width * 0.55, 260);

  const { data: book, isLoading, error, refetch } = useQuery({
    queryKey: ['book', id],
    queryFn: () =>
      apiPost<GetItemResponse>('getitem', { type: 'book', id }),
    select: (r) => r.book,
    enabled: !!id,
  });

  const coverUri =
    book?.thumbnail
      ? encodeURI(`https://loikmon.org/webapis/uploads/thumbnails/${book.thumbnail}`)
      : null;

  function handleRead() {
    const readUrl = `https://naisaikchan.github.io/mordren-loikmon/books/${id}`;
    Linking.openURL(readUrl);
  }

  // Loading state
  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: '', headerLargeTitle: false }} />
        <BookDetailSkeleton coverWidth={coverWidth} />
      </>
    );
  }

  // Error state
  if (error || !book) {
    return (
      <>
        <Stack.Screen options={{ title: '', headerLargeTitle: false }} />
        <View style={[styles.centered, { backgroundColor: colors.background }]}>
          <Text style={[styles.errorText, { color: colors.error }]}>
            {error ? 'Failed to load book.' : 'Book not found.'}
          </Text>
          {error && (
            <Pressable
              style={[styles.retryButton, { backgroundColor: colors.brand }]}
              onPress={() => refetch()}
            >
              <Text style={styles.retryLabel}>Try Again</Text>
            </Pressable>
          )}
        </View>
      </>
    );
  }

  const displayTitle = book.name ?? book.title ?? '';

  return (
    <>
      <Stack.Screen options={{ title: '', headerLargeTitle: false }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.container}
      >
        {/* Cover image — centred at top */}
        <View style={styles.coverContainer}>
          <Image
            source={coverUri ?? require('@/assets/icon.png')}
            style={[
              styles.coverImage,
              { width: coverWidth, height: coverWidth * 1.42 },
            ]}
            contentFit="cover"
            transition={300}
          />
        </View>

        {/* Metadata */}
        <View style={styles.meta}>
          <Text style={[styles.title, { color: colors.label }]}>{displayTitle}</Text>

          {book.author ? (
            <Text style={[styles.author, { color: colors.secondaryLabel }]}>
              {book.author}
            </Text>
          ) : null}

          <View style={styles.badgeRow}>
            <FormatBadge book={book} />
          </View>
        </View>

        {/* Read Now button */}
        <Pressable
          style={({ pressed }) => [
            styles.readButton,
            { backgroundColor: colors.brand, opacity: pressed ? 0.82 : 1 },
          ]}
          onPress={handleRead}
        >
          <Text style={styles.readButtonLabel}>Read Now</Text>
        </Pressable>

        {/* Description */}
        {book.description ? (
          <View
            style={[styles.descriptionCard, { borderColor: colors.separator }]}
          >
            <Text
              style={[styles.descriptionHeading, { color: colors.label }]}
            >
              About this book
            </Text>
            <Text
              style={[styles.descriptionText, { color: colors.secondaryLabel }]}
            >
              {book.description}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    paddingTop: 24,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  // Cover
  coverContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  coverImage: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  // Meta
  meta: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 28,
  },
  author: {
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 4,
  },
  badge: {
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeEpub: {
    backgroundColor: '#dbeafe',
  },
  badgePdf: {
    backgroundColor: '#fee2e2',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // Read button
  readButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 28,
  },
  readButtonLabel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  // Description
  descriptionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  descriptionHeading: {
    fontSize: 15,
    fontWeight: '600',
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
  },
  // Error / retry
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
});
