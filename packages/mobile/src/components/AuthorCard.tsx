import { View, Text, Image, Pressable } from 'react-native'
import { Link } from 'expo-router'
import type { Author } from '@loikmon/api'
import { fixUrl } from '@/lib/url'

export function AuthorCard({ author }: { author: Author }) {
  const avatar = fixUrl((author.avatar_url as string) ?? (author.avatar as string) ?? '')
  return (
    <Link href={`/author/${author.id}`} asChild>
      <Pressable className="mb-3 flex-row items-center rounded-xl bg-white dark:bg-surface-800 p-3">
        <View className="h-14 w-14 overflow-hidden rounded-full bg-surface-200 dark:bg-surface-700">
          {avatar ? (
            <Image source={{ uri: avatar }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Text className="text-xl">👤</Text>
            </View>
          )}
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-sm font-semibold text-surface-900 dark:text-surface-50">
            {author.name}
          </Text>
          {author.bio ? (
            <Text numberOfLines={1} className="text-xs text-surface-400">
              {author.bio}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Link>
  )
}
