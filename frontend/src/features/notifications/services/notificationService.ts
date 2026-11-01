import { axiosInstance } from '@/api/axiosInstance';
import type { ContactMessage, ContactMessageStatus } from '../types';

export const notificationService = {
  getAll: () =>
    axiosInstance.get<ContactMessage[]>('/api/admin/contact-messages'),

  markAsRead: (id: string, read: boolean) =>
    axiosInstance.put<ContactMessage>(`/api/admin/contact-messages/${id}/read`, null, {
      params: { read }
    }),

  remove: (id: string) =>
    axiosInstance.delete(`/api/admin/contact-messages/${id}`),

  getStatuses: () =>
    axiosInstance.get<ContactMessageStatus[]>('/api/admin/contact-messages/statuses'),

  createStatus: (name: string, color: string) =>
    axiosInstance.post<ContactMessageStatus>('/api/admin/contact-messages/statuses', { name, color }),

  deleteStatus: (id: string) =>
    axiosInstance.delete(`/api/admin/contact-messages/statuses/${id}`),

  updateStatus: (id: string, statusId: string | null) =>
    axiosInstance.put(`/api/admin/contact-messages/${id}/status`, { statusId }),

  replyToMessage: (id: string, replyMessage: string) =>
    axiosInstance.post(`/api/admin/contact-messages/${id}/reply`, { replyMessage }),
} as const;
