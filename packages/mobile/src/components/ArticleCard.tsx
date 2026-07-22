import { View, Text, Image, Pressable } from 'react-native'
import { Link } from 'expo-router'
import type { Article } from '@loikmon/api'
import { fixUrl } from '@/lib/url'
import { PriceBadge } from './PriceBadge'

/** Horizontal list-row card for an article. */
export function ArticleCard({ article }: { article: Article }) {
  const thumb = fixUrl(
    (article.thumbnail_url as string) ?? (article.thumbnail as string) ?? '',
  )
  const category = (article.category as string) ?? (article.cat as string) ?? ''
  return (
    <Link href={`/article/${article.id}`} asChild>
      <Pressable className="mb-3 flex-row rounded-xl bg-white dark:bg-surface-800 p-3">
        <View className="h-20 w-20 overflow-hidden rounded-lg bg-surface-200 dark:bg-surface-700">
          {thumb ? (
            <Image source={{ uri: thumb }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Text className="text-2xl">📰</Text>
            </View>
          )}
        </View>
        <View className="ml-3 flex-1 justify-center">
          {category ? (
            <Text className="text-[11px] font-medium uppercase text-brand-500">{category}</Text>
          ) : null}
          <Text
            numberOfLines={2}
            className="text-sm font-semibold text-surface-900 dark:text-surface-50"
          >
            {article.title}
          </Text>
          <View className="mt-1">
            <PriceBadge item={article as unknown as Record<string, unknown>} />
          </View>
        </View>
      </Pressable>
    </Link>
  )
}
