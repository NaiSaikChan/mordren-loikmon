import { storage } from '@/services/storage'

const FIRST_AUTH_COMPLETED_KEY = 'first_auth_completed'

export async function hasCompletedFirstAuth(): Promise<boolean> {
  const value = await storage.get(FIRST_AUTH_COMPLETED_KEY)
  return value === 'true'
}

export async function markFirstAuthCompleted(): Promise<void> {
  await storage.set(FIRST_AUTH_COMPLETED_KEY, 'true')
}
