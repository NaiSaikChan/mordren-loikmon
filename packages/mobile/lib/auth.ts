import * as SecureStore from 'expo-secure-store';
import type { User } from '@/types';

const SESSION_KEY = 'loikmon_session';

export const authStorage = {
  async save(user: User) {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(user));
  },
  async load(): Promise<User | null> {
    try {
      const raw = await SecureStore.getItemAsync(SESSION_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  },
  async clear() {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  },
};

export function normaliseUser(raw: Record<string, unknown>): User {
  return {
    id: raw.id as number,
    firstname: (raw.firstname as string) ?? '',
    lastname: (raw.lastname as string) ?? '',
    name: `${raw.firstname ?? ''} ${raw.lastname ?? ''}`.trim(),
    email: raw.email as string,
    thumbnail: raw.thumbnail as string | undefined,
    avatar: raw.thumbnail
      ? encodeURI(`https://loikmon.org/webapis/uploads/thumbnails/${raw.thumbnail}`)
      : undefined,
    coins: Number(raw.coins ?? 0),
    isadminuser: raw.isadminuser as string,
    device_limit: Number(raw.device_limit ?? 2),
    devices_in_use: Number(raw.devices_in_use ?? 0),
  };
}
