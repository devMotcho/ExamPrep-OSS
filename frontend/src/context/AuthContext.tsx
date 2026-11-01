import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { authService } from '../features/auth/services/authService';
import { useOnline } from '../lib/online';

interface UserProfile {
  id: number;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  isConfirmed: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  role: string | null;
  user: UserProfile | null;
  loading: boolean;
  login: () => void;
  logout: () => void;
  refreshUser: () => Promise<UserProfile | undefined>;
}

const FOCUS_REFRESH_INTERVAL_MS = 60_000;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─────────────────────────────────────────────────────────────────────────────
// OAuth2 token storage helpers (localStorage, used when cookies cannot work
// cross-site, e.g. frontend and API deployed on separate public-suffix domains).
// Standard email/password login continues to use httpOnly cookies exclusively.
// ─────────────────────────────────────────────────────────────────────────────

function parseOAuthHash(): { accessToken: string; refreshToken: string; expiresIn: number } | null {
  try {
    const hash = window.location.hash.slice(1); // strip leading '#'
    if (!hash) return null;
    const params = new URLSearchParams(hash);
    const accessToken  = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const expiresIn    = Number(params.get('expires_in') ?? '0');
    if (accessToken && refreshToken) {
      return { accessToken, refreshToken, expiresIn };
    }
  } catch {
    // malformed hash — ignore
  }
  return null;
}

function storeOAuthTokens(accessToken: string, refreshToken: string, expiresIn: number) {
  localStorage.setItem('oauth_access_token', accessToken);
  localStorage.setItem('oauth_refresh_token', refreshToken);
  localStorage.setItem('oauth_token_expires_at', String(Date.now() + expiresIn * 1000));
}

function clearOAuthTokens() {
  localStorage.removeItem('oauth_access_token');
  localStorage.removeItem('oauth_refresh_token');
  localStorage.removeItem('oauth_token_expires_at');
}

// ─────────────────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Determine initial state synchronously:
  // - True if localStorage flag is set (standard login OR previous OAuth session).
  // - The real source of truth is always validated on mount via /auth/me.
  const oauthHashOnLoad = useRef(parseOAuthHash());
  const hasOAuthHashOnLoad = oauthHashOnLoad.current !== null;

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    // If there is an OAuth hash fragment on the URL, we know auth just succeeded —
    // start as false and let the mount effect establish the session.
    if (hasOAuthHashOnLoad) return false;
    return localStorage.getItem('isAuthenticated') === 'true';
  });
  const [role, setRole]   = useState<string | null>(null);
  const [user, setUser]   = useState<UserProfile | null>(null);
  // Hold loading=true whenever we know we need to do an async auth check on mount,
  // so PrivateRoute never flashes a redirect before the check completes.
  const [loading, setLoading] = useState<boolean>(() => {
    return hasOAuthHashOnLoad || localStorage.getItem('isAuthenticated') === 'true';
  });

  // ── Mount effect: handle OAuth2 hash fragment handoff ──────────────────────
  useEffect(() => {
    const oauthTokens = oauthHashOnLoad.current;
    if (!oauthTokens) return;

    // Immediately clean the fragment from the URL bar (tokens must not sit in history)
    window.history.replaceState(null, '', window.location.pathname);

    // Persist tokens so the Axios request interceptor can inject them
    storeOAuthTokens(oauthTokens.accessToken, oauthTokens.refreshToken, oauthTokens.expiresIn);

    // Now call /auth/me — the Axios interceptor will attach Authorization: Bearer automatically
    authService.me()
      .then((res) => {
        localStorage.setItem('isAuthenticated', 'true');
        setRole(res.data.role);
        setUser(res.data);
        setIsAuthenticated(true);
      })
      .catch(() => {
        // Hash tokens were invalid — clean up entirely
        clearOAuthTokens();
        localStorage.removeItem('isAuthenticated');
        setIsAuthenticated(false);
      })
      .finally(() => {
        setLoading(false);
      });
   
  }, []);

  // ── Effect: fetch user profile when isAuthenticated flips to true ──────────
  useEffect(() => {
    // Skip if we are currently in the middle of the OAuth hash mount effect
    if (hasOAuthHashOnLoad) return;

    if (isAuthenticated) {
      if (user) {
        // Profile already loaded (e.g. after login() call) — just unset loading
        Promise.resolve().then(() => setLoading(false));
        return;
      }
      Promise.resolve().then(() => setLoading(true));
      authService.me()
        .then((res) => {
          setRole(res.data.role);
          setUser(res.data);
        })
        .catch((err) => {
          if (err?.response?.status === 401 || err?.response?.status === 403) {
            logout();
          }
        })
        .finally(() => setLoading(false));
    } else {
      Promise.resolve().then(() => setLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // ── Opened without a connection: fetch the profile as soon as it returns ───
  const online = useOnline();
  useEffect(() => {
    if (!online || !isAuthenticated || user || hasOAuthHashOnLoad) return;
    authService.me()
      .then((res) => {
        setRole(res.data.role);
        setUser(res.data);
      })
      .catch(() => undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  // ── Global logout event (fired by Axios interceptor on failed refresh) ──────
  useEffect(() => {
    const handleAuthLogout = () => {
      localStorage.removeItem('isAuthenticated');
      clearOAuthTokens();
      setIsAuthenticated(false);
      setRole(null);
      setUser(null);
      setLoading(false);
    };
    window.addEventListener('auth-logout', handleAuthLogout);
    return () => window.removeEventListener('auth-logout', handleAuthLogout);
  }, []);

  // ── Coming back to the tab: the account may have changed elsewhere ─
  const lastRefresh = useRef(0);
  useEffect(() => {
    if (!isAuthenticated) return;
    const refreshIfStale = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      if (Date.now() - lastRefresh.current < FOCUS_REFRESH_INTERVAL_MS) return;
      lastRefresh.current = Date.now();
      authService.me()
        .then((res) => {
          setRole(res.data.role);
          setUser(res.data);
        })
        .catch(() => undefined); // Expired sessions are handled by the Axios interceptor.
    };
    window.addEventListener('focus', refreshIfStale);
    document.addEventListener('visibilitychange', refreshIfStale);
    return () => {
      window.removeEventListener('focus', refreshIfStale);
      document.removeEventListener('visibilitychange', refreshIfStale);
    };
  }, [isAuthenticated]);

  // ── login() — called after successful email/password POST /auth/login ───────
  // The server has already set the httpOnly cookie; we just fetch the profile.
  const login = async () => {
    localStorage.setItem('isAuthenticated', 'true');
    setLoading(true);
    try {
      const res = await authService.me();
      setRole(res.data.role);
      setUser(res.data);
      setIsAuthenticated(true);
    } catch {
      console.error('Failed to fetch user metadata after login');
    } finally {
      setLoading(false);
    }
  };

  async function logout() {
    setLoading(true);
    try {
      await authService.logout();
    } catch (e) {
      console.error('Logout failed', e);
    } finally {
      localStorage.removeItem('isAuthenticated');
      clearOAuthTokens();
      setIsAuthenticated(false);
      setRole(null);
      setUser(null);
      setLoading(false);
    }
  }

  async function refreshUser() {
    try {
      const res = await authService.me();
      setRole(res.data.role);
      setUser(res.data);
      return res.data;
    } catch (e: any) {
      console.error('Refresh user failed', e);
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        logout();
      }
      throw e;
    }
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, role, user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
