import { axiosInstance } from '@/api/axiosInstance';

export const configService = {
  getPublic: () =>
    axiosInstance.get('/api/config/public'),

  getAll: () =>
    axiosInstance.get('/api/config'),

  bulkSave: (updates: Record<string, string>) =>
    axiosInstance.post('/api/config/bulk', updates),
} as const;
