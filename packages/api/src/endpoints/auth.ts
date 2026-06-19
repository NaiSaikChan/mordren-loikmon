import type { ApiResponse, LoginPayload, RegisterPayload, User } from '../types.js'
import { getClient } from '../client.js'

// Real API response shape from loikmon.org (flat, not wrapped in data:{})
export interface RawAuthResponse {
  status: 'ok' | 'error'
  message?: string
  token?: string
  user?: User
  isadminuser?: number | string
}

export const auth = {
  login: (payload: LoginPayload) =>
    getClient().post<RawAuthResponse>('loginapp', payload),

  register: (payload: RegisterPayload) =>
    getClient().post<RawAuthResponse>('createaccount', payload),

  resetPassword: (email: string) =>
    getClient().post<RawAuthResponse>('resetpassword', { email }),

  resendVerifyLink: (email: string) =>
    getClient().post<RawAuthResponse>('resendVerificationMail', { email }),

  updateProfile: (data: Partial<User> & { password?: string }) =>
    getClient().post<RawAuthResponse>('updateUserProfile', data),

  deleteAccount: (email: string) =>
    getClient().post<RawAuthResponse>('deletemyaccount', { email }),

  storeFcmToken: (token: string) =>
    getClient().post<RawAuthResponse>('storefcmtoken', { token }),
}
