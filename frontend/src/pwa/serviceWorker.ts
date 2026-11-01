import { useSyncExternalStore } from 'react';
import { isOnline } from '@/lib/online';

/**
 * Registers the service worker and runs the update flow. Written directly on the browser API
 * because the rule "never reload during an exam" has to hold even when another tab applies
 * the update.
 *
 * A new version waits until the user accepts the prompt, or until the next time the app is
 * opened outside an exam, so a dismissed prompt cannot leave anyone on an old version.
 */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const AUTO_APPLY_KEY = 'sw-auto-applied';
const APPLY_TIMEOUT_MS = 4000;

export const isExamRoute = (pathname = window.location.pathname) => /^\/[^/]+\/exam\/[^/]+\/?$/.test(pathname);

let registration: ServiceWorkerRegistration | null = null;
let needRefresh = false;
let reloadRequested = false;
const listeners = new Set<() => void>();

const setNeedRefresh = () => {
  if (needRefresh) return;
  needRefresh = true;
  listeners.forEach((l) => l());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useUpdateAvailable = () => useSyncExternalStore(subscribe, () => needRefresh);

export const applyUpdate = () => {
  if (isExamRoute()) return;
  const waiting = registration?.waiting;
  if (waiting) {
    reloadRequested = true;
    waiting.postMessage({ type: 'SKIP_WAITING' });
    // The browser can delay the swap while another tab is busy. Don't leave the button looking dead:
    // the new version then takes over as soon as that tab is done.
    setTimeout(() => window.location.reload(), APPLY_TIMEOUT_MS);
  } else {
    // Another tab already activated the new version: this page only needs fresh assets.
    window.location.reload();
  }
};

const checkForUpdate = () => {
  if (isOnline()) registration?.update().catch(() => undefined);
};

const start = async () => {
  let hadController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // The very first install takes control of the page; nothing changed for the user.
    if (!hadController) {
      hadController = true;
      return;
    }
    if (reloadRequested && !isExamRoute()) {
      window.location.reload();
    } else {
      // Applied from another tab: don't interrupt this one, offer the reload here too.
      setNeedRefresh();
    }
  });

  registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });

  if (registration.waiting && navigator.serviceWorker.controller) {
    // The app has only just opened, so there is no work to lose. Once per tab session, in case
    // the swap fails and we would otherwise reload in a loop.
    setNeedRefresh();
    if (!isExamRoute() && !sessionStorage.getItem(AUTO_APPLY_KEY)) {
      sessionStorage.setItem(AUTO_APPLY_KEY, '1');
      applyUpdate();
    }
  }

  registration.addEventListener('updatefound', () => {
    const installing = registration?.installing;
    installing?.addEventListener('statechange', () => {
      if (installing.state === 'installed' && navigator.serviceWorker.controller) setNeedRefresh();
    });
  });

  setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
};

export const registerServiceWorker = () => {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const run = () => start().catch((err) => console.error('Service worker registration failed', err));
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
};
