import { useSyncExternalStore } from 'react';

// Connection state for the whole app. navigator.onLine alone misses dead networks, so failed
// API requests also count as offline, and a probe decides when the connection is really back.
const PROBE_INTERVAL_MS = 5000;

let online = typeof navigator === 'undefined' ? true : navigator.onLine;
let probeTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

const setOnline = (value: boolean) => {
  if (online === value) return;
  online = value;
  listeners.forEach((l) => l());
};

const probeUrl = () => {
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  return `${base}/api/config/public?lang=pt`;
};

const probe = async () => {
  clearTimeout(probeTimer);
  if (!navigator.onLine) return;
  try {
    await fetch(probeUrl(), { cache: 'no-store', credentials: 'omit' });
    setOnline(true);
  } catch {
    probeTimer = setTimeout(probe, PROBE_INTERVAL_MS);
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => {
    clearTimeout(probeTimer);
    setOnline(false);
  });
  window.addEventListener('online', () => void probe());
}

/** Called by the API client when a request gets no response at all. */
export const reportNetworkFailure = () => {
  if (!online) return;
  setOnline(false);
  void probe();
};

export const isOnline = () => online;

export const checkConnection = () => probe();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useOnline = () => useSyncExternalStore(subscribe, isOnline);

/** True for errors where the request never got an answer from the server. */
export const isNetworkError = (err: unknown) => {
  const e = err as { response?: unknown; code?: string } | undefined;
  return !!e && !e.response && (e.code === 'ERR_NETWORK' || e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT');
};
