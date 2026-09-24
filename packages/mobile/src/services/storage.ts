import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'

/**
 * Thin storage abstraction.
 *  - Non-sensitive prefs (theme, locale, bookmarks) → AsyncStorage.
 *  - Sensitive session data (token, user) → SecureStore (Keychain / Keystore).
 *    Only on web, where SecureStore does not exist, does it use AsyncStorage
 *    (localStorage). On iOS/Android a SecureStore failure is surfaced to the
 *    caller — secrets are never silently written to plaintext storage.
 */

export const storage = {
  async get(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key)
  },
  async set(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value)
  },
  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key)
  },
  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await AsyncStorage.getItem(key)
    if (!raw) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  },
  async setJSON(key: string, value: unknown): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value))
  },
}

export class SecureStorageUnavailableError extends Error {
  override name = 'SecureStorageUnavailableError'
  constructor() {
    super('Secure storage is not available on this device')
  }
}

/** Where builds before this change could have written secrets in plaintext. */
const legacyKey = (key: string) => `secure_${key}`

const usesWebFallback = () => Platform.OS === 'web'

let availability: Promise<boolean> | null = null

/** SecureStore availability, checked once per app run. */
function secureAvailable(): Promise<boolean> {
  availability ??= usesWebFallback()
    ? Promise.resolve(false)
    : SecureStore.isAvailableAsync().then(Boolean, () => false)
  return availability
}

/** Test hook: forget the cached availability. */
export function resetSecureStorageForTests(): void {
  availability = null
}

async function requireSecureStore(): Promise<boolean> {
  if (await secureAvailable()) return true
  if (usesWebFallback()) return false
  throw new SecureStorageUnavailableError()
}

export const secureStorage = {
  /** Rejects with `SecureStorageUnavailableError` (or SecureStore's error) on native when the keystore fails. */
  async get(key: string): Promise<string | null> {
    if (!(await requireSecureStore())) return AsyncStorage.getItem(legacyKey(key))
    const value = await SecureStore.getItemAsync(key)
    if (value != null) return value
    // One-time migration of a secret an older build stored in plaintext.
    const legacy = await AsyncStorage.getItem(legacyKey(key)).catch(() => null)
    if (legacy == null) return null
    await SecureStore.setItemAsync(key, legacy)
    await AsyncStorage.removeItem(legacyKey(key)).catch(() => undefined)
    return legacy
  },
  async set(key: string, value: string): Promise<void> {
    if (!(await requireSecureStore())) {
      await AsyncStorage.setItem(legacyKey(key), value)
      return
    }
    await SecureStore.setItemAsync(key, value)
  },
  async remove(key: string): Promise<void> {
    // Always drop any plaintext copy, even when the keystore is unusable.
    await AsyncStorage.removeItem(legacyKey(key)).catch(() => undefined)
    if (!(await requireSecureStore())) return
    await SecureStore.deleteItemAsync(key)
  },
}
