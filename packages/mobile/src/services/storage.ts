import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'

/**
 * Thin storage abstraction.
 *  - Non-sensitive prefs (theme, locale, bookmarks) → AsyncStorage.
 *  - Sensitive session data (token, user) → SecureStore when available,
 *    with an AsyncStorage fallback for platforms where SecureStore is absent
 *    (e.g. web during development).
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

async function secureAvailable(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync()
  } catch {
    return false
  }
}

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    if (await secureAvailable()) {
      try {
        return await SecureStore.getItemAsync(key)
      } catch {
        /* fall through */
      }
    }
    return AsyncStorage.getItem(`secure_${key}`)
  },
  async set(key: string, value: string): Promise<void> {
    if (await secureAvailable()) {
      try {
        await SecureStore.setItemAsync(key, value)
        return
      } catch {
        /* fall through */
      }
    }
    await AsyncStorage.setItem(`secure_${key}`, value)
  },
  async remove(key: string): Promise<void> {
    if (await secureAvailable()) {
      try {
        await SecureStore.deleteItemAsync(key)
      } catch {
        /* ignore */
      }
    }
    await AsyncStorage.removeItem(`secure_${key}`)
  },
}
