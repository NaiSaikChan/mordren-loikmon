import { getClient } from '../client.js'

export interface RawAuthResponse {
  status: string
  message?: string
  token?: string
  user?: Record<string, unknown>
  isadminuser?: number
}

export const auth = {
  login: (payload: { email: string; password: string }) =>
    getClient().post<RawAuthResponse>('loginapp', payload),

  register: (payload: { email: string; password: string; name: string; phone?: string }) =>
    getClient().post<RawAuthResponse>('createaccount', payload),

  resetPassword: (email: string) =>
    getClient().post<RawAuthResponse>('resetpassword', { email }),

  resendVerifyLink: (email: string) =>
    getClient().post<RawAuthResponse>('resendVerificationMail', { email }),

  deleteAccount: (email: string) =>
    getClient().post<RawAuthResponse>('deletemyaccount', { email }),

  updateProfile: (data: Record<string, unknown>) =>
    getClient().post<RawAuthResponse>('updateprofile', data),
}
