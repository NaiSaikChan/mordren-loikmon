import { getClient } from '../client.js'
import type { AuthResponse, LoginPayload, MeResponse, RegisterPayload, User } from '../types.js'

type Ok = { status: 'ok'; message?: string }

export const auth = {
  /** Returns a bearer token (unless email verification is required), the user and their entitlement. */
  register: (payload: RegisterPayload) => getClient().post<AuthResponse>('auth/register', payload),

  login: (payload: LoginPayload) => getClient().post<AuthResponse>('auth/login', payload),

  /** Revokes the current session on the server. */
  logout: () => getClient().post<Ok>('auth/logout'),

  /** Current user + entitlement. Use on app start to validate a stored token. */
  me: () => getClient().get<MeResponse>('auth/me'),

  /** Pass `null` to clear firstname / lastname / phone. */
  updateProfile: (data: { name?: string; firstname?: string | null; lastname?: string | null; phone?: string | null }) =>
    getClient().patch<{ status: 'ok'; user: User }>('auth/me', data),

  /** `file` must be a JPEG/PNG/WebP image (Blob/File on web, `{ uri, name, type }` on React Native). */
  uploadAvatar: (file: Blob | { uri: string; name: string; type: string }) => {
    const form = new FormData()
    form.append('file', file as Blob)
    return getClient().post<{ status: 'ok'; user: User }>('auth/me/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },

  /** Sends a reset link by email. Always succeeds (no account enumeration). */
  forgotPassword: (email: string) => getClient().post<Ok>('auth/password/forgot', { email }),

  /** @deprecated alias of forgotPassword kept for existing screens */
  resetPassword: (email: string) => getClient().post<Ok>('auth/password/forgot', { email }),

  /** Completes a reset with the token from the email link. */
  confirmPasswordReset: (token: string, newPassword: string) =>
    getClient().post<Ok>('auth/password/reset', { token, new_password: newPassword }),

  changePassword: (currentPassword: string, newPassword: string, revokeOtherSessions = true) =>
    getClient().post<Ok & { token: string | null }>('auth/password/change', {
      current_password: currentPassword,
      new_password: newPassword,
      revoke_other_sessions: revokeOtherSessions,
    }),

  resendVerifyLink: (email: string) => getClient().post<Ok>('auth/email/resend-verification', { email }),

  /**
   * Permanently deletes the account. Store subscriptions keep renewing until
   * cancelled in the store: `manage_store_subscription` tells which store.
   */
  deleteAccount: (password: string) =>
    getClient().delete<Ok & { manage_store_subscription: 'app_store' | 'google_play' | null }>('auth/me', { data: { password } }),
}
