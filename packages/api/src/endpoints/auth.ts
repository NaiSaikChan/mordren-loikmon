import type { ApiResponse, LoginPayload, RegisterPayload, AuthResult, User } from '../types.js'
import { getClient } from '../client.js'

export const auth = {
  login: (payload: LoginPayload) =>
    getClient().post<ApiResponse<AuthResult>>('/auth/loginapp', payload),

  register: (payload: RegisterPayload) =>
    getClient().post<ApiResponse<AuthResult>>('/auth/createaccount', payload),

  resetPassword: (email: string) =>
    getClient().post<ApiResponse<null>>('/auth/resetpassword', { email }),

  resendVerifyLink: (email: string) =>
    getClient().post<ApiResponse<null>>('/auth/resendVerificationMail', { email }),

  updateProfile: (data: Partial<User> & { password?: string }) =>
    getClient().post<ApiResponse<User>>('/auth/updateUserProfile', data),

  deleteAccount: () =>
    getClient().post<ApiResponse<null>>('/auth/deletemyaccount'),

  storeFcmToken: (token: string) =>
    getClient().post<ApiResponse<null>>('/auth/storefcmtoken', { token }),
}
