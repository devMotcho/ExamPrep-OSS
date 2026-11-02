import { axiosInstance } from '@/api/axiosInstance';
import type { LoginForm, RegisterForm } from '../types';

export type CodePurpose = 'REGISTER' | 'PASSWORD_RESET' | 'PASSWORD_CHANGE' | 'EMAIL_CONFIRMATION' | 'CONTACT' | 'EMAIL_CHANGE' | 'ACCOUNT_DELETION';

export const authService = {
  login: (data: LoginForm) =>
    axiosInstance.post('/auth/login', data),

  register: (data: RegisterForm) =>
    axiosInstance.post('/auth/register', data),

  logout: () =>
    axiosInstance.post('/auth/logout'),

  me: async () => {
    return await axiosInstance.get<{ id: number; email: string; name: string; publicName?: string | null; oauthProvider?: string | null; role: string; isActive: boolean; isConfirmed: boolean }>('/auth/me');
  },

  refresh: () =>
    axiosInstance.post('/auth/refresh'),

  sendCode: (email: string, purpose: CodePurpose) =>
    axiosInstance.post('/auth/send-code', { email, purpose }),

  exchangeOAuthCode: (code: string) =>
    axiosInstance.post('/auth/oauth2/exchange', { code }),

  confirmEmail: (code: string) =>
    axiosInstance.post('/auth/confirm-email', { code }),

  resetPassword: (data: any) =>
    axiosInstance.post('/auth/reset-password', data),

  changePassword: (data: any) =>
    axiosInstance.post('/auth/change-password', data),

  updateProfile: (data: { name?: string; publicName?: string }) =>
    axiosInstance.patch<{ name: string; publicName: string }>('/auth/me', data),

  changeEmail: (data: { newEmail: string; password: string; code?: string }) =>
    axiosInstance.post<{ email: string }>('/auth/me/email', data),

  exportData: () =>
    axiosInstance.get<Blob>('/auth/me/export', { responseType: 'blob' }),

  deleteAccount: (data: { password?: string; code?: string }) =>
    axiosInstance.delete('/auth/me', { data }),

  logVisit: (deviceId: string) =>
    axiosInstance.post('/auth/telemetry/visit', { deviceId }),
} as const;
