import { axiosInstance } from '@/api/axiosInstance';
import type { LoginForm, RegisterForm } from '../types';

export const authService = {
  login: (data: LoginForm) =>
    axiosInstance.post('/auth/login', data),

  register: (data: RegisterForm) =>
    axiosInstance.post('/auth/register', data),

  logout: () =>
    axiosInstance.post('/auth/logout'),

  me: async () => {
    return await axiosInstance.get<{ id: number; email: string; name: string; role: string; isActive: boolean; isConfirmed: boolean }>('/auth/me');
  },

  refresh: () =>
    axiosInstance.post('/auth/refresh'),

  sendCode: (email: string) =>
    axiosInstance.post('/auth/send-code', { email }),

  confirmEmail: (code: string) =>
    axiosInstance.post('/auth/confirm-email', { code }),

  resetPassword: (data: any) =>
    axiosInstance.post('/auth/reset-password', data),

  changePassword: (data: any) =>
    axiosInstance.post('/auth/change-password', data),

  logVisit: (deviceId: string) =>
    axiosInstance.post('/auth/telemetry/visit', { deviceId }),
} as const;
