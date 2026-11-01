import { axiosInstance } from '@/api/axiosInstance';
import type { DashboardStats } from '../types';

export const dashboardApi = {
  fetchStats: async (): Promise<DashboardStats> => {
    const { data } = await axiosInstance.get('/api/admin/dashboard/stats');
    if (data && data.recentMessages) {
      data.recentMessages = data.recentMessages.map((m: any) => ({
        ...m,
        isRead: m.isRead !== undefined ? m.isRead : (m.read !== undefined ? m.read : false)
      }));
    }
    return data;
  },

  markMessageAsRead: async (messageId: string): Promise<void> => {
    await axiosInstance.put(`/api/admin/contact-messages/${messageId}/read`, null, {
      params: { read: true }
    });
  },

  fetchMessage: async (messageId: string): Promise<any> => {
    const { data } = await axiosInstance.get(`/api/admin/contact-messages/${messageId}`);
    return {
      ...data,
      isRead: data.isRead !== undefined ? data.isRead : (data.read !== undefined ? data.read : false)
    };
  }
};
