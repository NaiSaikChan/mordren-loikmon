import { useEffect, type ReactNode } from 'react'
import { AppState, Platform, type AppStateStatus } from 'react-native'
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError } from '@loikmon/api'

/**
 * Shared React Query client: request caching, de-duplication and retry with
 * exponential backoff for every data hook.
 *
 * Retries are for transient failures only — a 4xx means the request itself is
 * wrong (or the session ended) and retrying just delays the error.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 3) return false
  if (error instanceof ApiError) {
    if (error.isNetworkError || error.status === 0) return true
    if (error.status === 408 || error.status === 429) return true
    return error.status >= 500
  }
  return true
}

/** 1s, 2s, 4s … capped at 15s, with ±20% jitter so clients don't retry in lockstep. */
export function retryDelay(attempt: number): number {
  const base = Math.min(1000 * 2 ** attempt, 15_000)
  return Math.round(base * (0.8 + Math.random() * 0.4))
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        retry: shouldRetry,
        retryDelay,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  })
}

export const queryClient = createQueryClient()

/** Stable cache keys, so screens that show the same data share one request. */
export const queryKeys = {
  home: (accessKey: string) => ['home', accessKey] as const,
  categories: () => ['categories'] as const,
  book: (id: number | string, accessKey: string) => ['book', String(id), accessKey] as const,
  relatedBooks: (id: number | string) => ['book', String(id), 'related'] as const,
  bookChapters: (id: number | string, accessKey: string) => ['book', String(id), 'chapters', accessKey] as const,
  article: (id: number | string, accessKey: string) => ['article', String(id), accessKey] as const,
  author: (id: number | string, accessKey: string) => ['author', String(id), accessKey] as const,
  reviews: (type: string, id: number | string, userId: string) => ['reviews', type, String(id), userId] as const,
}

function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') focusManager.setFocused(status === 'active')
}

/** Provides the client and refetches stale queries when the app returns to the foreground. */
export function QueryProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const sub = AppState.addEventListener('change', onAppStateChange)
    return () => sub.remove()
  }, [])
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
