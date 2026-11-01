import { useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'pwa_install_dismissed';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

// Registered on import, because the browser can fire this before React has mounted.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    emit();
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useCanPromptInstall = () => useSyncExternalStore(subscribe, () => !!deferredPrompt);

export const promptInstall = async () => {
  if (!deferredPrompt) return;
  const event = deferredPrompt;
  deferredPrompt = null;
  emit();
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === 'dismissed') rememberInstallDismissed();
};

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Safari on iOS has no install prompt, and only Safari can add apps to the home screen reliably. */
export const isIosSafari = () => {
  const ua = navigator.userAgent;
  const isIos = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isIos && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
};

export const wasInstallDismissed = () => {
  try {
    return !!localStorage.getItem(DISMISSED_KEY);
  } catch {
    return false;
  }
};

export const rememberInstallDismissed = () => {
  try {
    localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
  } catch {
    // Private mode: the prompt may come back next time, which is harmless.
  }
};
