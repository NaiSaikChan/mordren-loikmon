import { create } from 'zustand';
import { authStorage, normaliseUser } from '@/lib/auth';
import { apiPost } from '@/constants/api';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restore: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,

  async restore() {
    const user = await authStorage.load();
    if (user) set({ user });
  },

  async login(email, password) {
    set({ loading: true, error: null });
    try {
      const res = await apiPost<{ status: string; user: Record<string, unknown> }>(
        'loginapp',
        { email, password }
      );
      if (res.status !== 'ok' || !res.user) throw new Error('Invalid credentials');
      const user = normaliseUser(res.user);
      await authStorage.save(user);
      set({ user, loading: false });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
      throw e;
    }
  },

  async logout() {
    await authStorage.clear();
    set({ user: null });
  },
}));
