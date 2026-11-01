import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './styles/globals.css';
import './i18n'; // Initialize i18n synchronously
import { ConfigProvider } from './lib/config/ConfigContext';
import { ThemeProvider } from './context/ThemeContext';
import { HelmetProvider } from 'react-helmet-async';
import { isExamRoute, registerServiceWorker } from './pwa/serviceWorker';
import './pwa/install'; // Catches beforeinstallprompt as early as possible

// Global handler for dynamic import chunk load failures and MIME type errors after deployment
const handleChunkError = (msg: string) => {
  const lower = msg.toLowerCase();
  // Being offline is not a stale deploy, and an exam must never reload by itself.
  if (!navigator.onLine || isExamRoute()) return false;
  if (
    lower.includes('dynamically imported module') ||
    lower.includes('disallowed mime type') ||
    lower.includes('loading chunk') ||
    lower.includes('failed to fetch') ||
    lower.includes('importing a module script failed') ||
    lower.includes('text/html')
  ) {
    const refreshed = window.sessionStorage.getItem('page-force-refreshed');
    if (refreshed !== 'true') {
      window.sessionStorage.setItem('page-force-refreshed', 'true');
      window.location.reload();
      return true;
    }
  }
  return false;
};

window.addEventListener('error', (event) => {
  const msg = (event.message || event.error?.message || '').toString();
  handleChunkError(msg);
});

window.addEventListener('unhandledrejection', (event) => {
  const msg = (event.reason?.message || event.reason || '').toString();
  handleChunkError(msg);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <ConfigProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </ConfigProvider>
    </HelmetProvider>
  </React.StrictMode>,
);

registerServiceWorker();
