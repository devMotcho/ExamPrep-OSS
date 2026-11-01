import { useState, useCallback, useEffect } from 'react';
import { dashboardApi } from '../api';
import type { DashboardStats, MessageActivity } from '../types';
import { useTranslation } from 'react-i18next';

export const useDashboardStats = (enabled = true) => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = useCallback(async (isManual = false) => {
    if (!enabled) return;
    if (isManual) setIsRefreshing(true);
    try {
      const data = await dashboardApi.fetchStats();
      setStats(data);
      setError(null);
    } catch (err) {
      console.error("Failed to load admin stats payload", err);
      setError(t('dashboard.error.telemetrySyncFailed', "Unable to communicate with the Spring server telemetry. Please verify connection status."));
    } finally {
      setLoading(false);
      if (isManual) {
        setTimeout(() => setIsRefreshing(false), 600);
      }
    }
  }, [t, enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    fetchStats();
    const interval = setInterval(() => fetchStats(false), 20000);
    return () => clearInterval(interval);
  }, [fetchStats, enabled]);

  const markMessageRead = useCallback(async (msg: MessageActivity) => {
    if (!msg.isRead) {
      try {
        await dashboardApi.markMessageAsRead(msg.id);
        setStats(prev => {
          if (!prev) return null;
          return {
            ...prev,
            unreadMessages: Math.max(0, prev.unreadMessages - 1),
            recentMessages: prev.recentMessages.map(m => m.id === msg.id ? { ...m, isRead: true } : m)
          };
        });
      } catch (err) {
        console.error("Failed to mark message as read on telemetry layer", err);
      }
    }
  }, []);

  const refreshMessage = useCallback(async (messageId: string) => {
    try {
      const refreshedMsg = await dashboardApi.fetchMessage(messageId);
      setStats(prev => {
        if (!prev) return prev;
        const messages = prev.recentMessages || [];
        const msgIdx = messages.findIndex(m => m.id === refreshedMsg.id);
        if (msgIdx !== -1) {
          const updatedMessages = [...messages];
          updatedMessages[msgIdx] = refreshedMsg;
          return { ...prev, recentMessages: updatedMessages };
        }
        return prev;
      });
      return refreshedMsg;
    } catch (err) {
      console.error("Failed to refresh message", err);
      return null;
    }
  }, []);

  return {
    stats,
    loading,
    error,
    isRefreshing,
    fetchStats,
    markMessageRead,
    refreshMessage
  };
};
