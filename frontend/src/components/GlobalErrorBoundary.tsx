import { captureException } from '../lib/config/sentry';
import { Component, ErrorInfo, ReactNode } from 'react';
import i18n from '../i18n';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in application boundary:', error, errorInfo);
    captureException(error);
    
    const msg = (error?.message || error?.toString() || '').toLowerCase();
    const isChunkError = 
      msg.includes('dynamically imported module') ||
      msg.includes('disallowed mime type') ||
      msg.includes('loading chunk') ||
      msg.includes('failed to fetch') ||
      msg.includes('importing a module script failed') ||
      msg.includes('text/html');

    const refreshed = window.sessionStorage.getItem('page-force-refreshed');
    if (isChunkError && refreshed !== 'true') {
      window.sessionStorage.setItem('page-force-refreshed', 'true');
      const url = new URL(window.location.href);
      url.searchParams.set('v', Date.now().toString());
      window.location.replace(url.toString());
    }
  }

  private handleReload = () => {
    window.sessionStorage.removeItem('page-force-refreshed');
    const url = new URL(window.location.href);
    url.searchParams.set('v', Date.now().toString());
    window.location.replace(url.toString());
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center z-50 relative">
          <div className="max-w-md w-full bg-card border border-border/60 rounded-3xl p-8 shadow-2xl flex flex-col items-center space-y-6 backdrop-blur-md">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black tracking-tight">{i18n.t('errorBoundary.title', 'App updated or connection interrupted')}</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {i18n.t('errorBoundary.description', 'A new version has been released, or a network error occurred while loading the app.')}
              </p>
            </div>
            <button
              type="button"
              onClick={this.handleReload}
              className="w-full py-3.5 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25 hover:opacity-95 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              {i18n.t('errorBoundary.reload', 'Reload page')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
