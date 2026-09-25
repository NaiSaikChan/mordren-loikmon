import { useEffect } from 'react'
import { useRouter, useSegments } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { LoadingSpinner } from '@/components/LoadingSpinner'

/**
 * Wrapper for screens that require authentication (e.g. the book reader or the
 * audio player). Unauthenticated users are redirected to the login screen.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, initializing } = useAuth()
  const router = useRouter()
  const segments = useSegments()
  const inAuthGroup = segments?.[0] === '(auth)'
  const needsAuth = !initializing && !isLoggedIn && !inAuthGroup

  useEffect(() => {
    if (needsAuth) {
      router.replace('/(auth)/login')
    }
  }, [needsAuth, router])

  if (initializing || needsAuth) {
    return <LoadingSpinner />
  }

  return <>{children}</>
}
