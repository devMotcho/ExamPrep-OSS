import { axiosInstance } from '@/api/axiosInstance';
import type { User, UserFormData } from '../types';

export const userService = {
  getAll: () =>
    axiosInstance.get<User[]>('/api/admin/users'),

  create: (data: UserFormData) =>
    axiosInstance.post<User>('/api/admin/users', data),

  update: (id: string, data: UserFormData) =>
    axiosInstance.put<User>(`/api/admin/users/${id}`, data),

  remove: (id: string) =>
    axiosInstance.delete(`/api/admin/users/${id}`),



  count: () =>
    axiosInstance.get<{ count: number }>('/api/admin/users/count'),

  resetPassword: (id: string, password: string) =>
    axiosInstance.post<{ message: string }>(`/api/admin/users/${id}/reset-password`, { password }),
} as const;
