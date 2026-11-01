import React from 'react';
import { useOAuthProviders } from '../hooks/useOAuthProviders';
import { useTranslation } from 'react-i18next';

// ── SVG icons ────────────────────────────────────────────────────────────────

const GoogleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const MicrosoftIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="10.5" height="10.5" fill="#F25022"/>
    <rect x="12.5" y="1" width="10.5" height="10.5" fill="#7FBA00"/>
    <rect x="1" y="12.5" width="10.5" height="10.5" fill="#00A4EF"/>
    <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900"/>
  </svg>
);

// ── Config ────────────────────────────────────────────────────────────────────

/** Base URL of the backend API (e.g. http://localhost:8080/api) */
const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

const providerConfig = {
  google: {
    label: 'Continue with Google',
    Icon: GoogleIcon,
    // The Spring Security OAuth2 authorization endpoint path
    href: `${API_BASE}/auth/oauth2/authorize/google`,
  },
  microsoft: {
    label: 'Continue with Microsoft',
    Icon: MicrosoftIcon,
    href: `${API_BASE}/auth/oauth2/authorize/microsoft`,
  },
} as const;

// ── Component ─────────────────────────────────────────────────────────────────

interface OAuthButtonsProps {
  /** Whether this is shown in a login or register context (cosmetic only). */
  context?: 'login' | 'register';
}

/**
 * Renders "Continue with Google" and/or "Continue with Microsoft" buttons
 * based on the active provider list from {@link useOAuthProviders}.
 *
 * If no providers are active the component renders nothing, so it can be
 * placed unconditionally in Login and Register pages.
 *
 * Clicking a button performs a full-page navigation to the Spring Security
 * OAuth2 authorization endpoint which starts the browser-redirect flow.
 */
export const OAuthButtons: React.FC<OAuthButtonsProps> = ({ context = 'login' }) => {
  const { t } = useTranslation();
  const { providers, loading } = useOAuthProviders();

  if (loading || providers.length === 0) return null;

  const dividerLabel = context === 'login'
    ? t('auth.oauth.dividerLogin', 'or sign in with')
    : t('auth.oauth.dividerRegister', 'or sign up with');

  return (
    <div className="w-full space-y-3">
      {/* Divider */}
      <div className="relative flex items-center gap-3">
        <div className="flex-1 h-px bg-border/60" />
        <span className="text-xs text-muted-foreground select-none">{dividerLabel}</span>
        <div className="flex-1 h-px bg-border/60" />
      </div>

      {/* Provider buttons */}
      <div className="flex flex-col gap-2">
        {providers.map((provider) => {
          const { label, Icon, href } = providerConfig[provider];
          return (
            <a
              key={provider}
              id={`oauth-btn-${provider}`}
              href={href}
              className={[
                'flex items-center justify-center gap-3 w-full px-4 py-2.5 rounded-xl',
                'border border-border/60 bg-card/60 backdrop-blur-sm',
                'text-sm font-medium text-foreground',
                'transition-all duration-200',
                'hover:bg-muted/60 hover:border-border hover:shadow-sm hover:scale-[1.01]',
                'active:scale-[0.99]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              ].join(' ')}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
};
