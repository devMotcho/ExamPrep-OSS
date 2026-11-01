import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { authService } from '../features/auth/services/authService';
import { useOnline } from '../lib/online';
import { consumeOAuthCallback } from '../lib/oauthCallback';

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

// Read before the first render, and before the router sees the address.
let pendingOAuthCode = consumeOAuthCallback();

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Determine initial state synchronously: the flag only decides what to show first. The real source of truth
  // is the HttpOnly session cookie, checked on mount via /auth/me.
  const oauthCodeOnLoad = useRef(pendingOAuthCode !== null);
  const hasOAuthCodeOnLoad = oauthCodeOnLoad.current;

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (hasOAuthCodeOnLoad) return false;
    return localStorage.getItem('isAuthenticated') === 'true';
  });
  const [role, setRole]   = useState<string | null>(null);
  const [user, setUser]   = useState<UserProfile | null>(null);
  // Hold loading=true whenever we know we need to do an async auth check on mount,
  // so PrivateRoute never flashes a redirect before the check completes.
  const [loading, setLoading] = useState<boolean>(() => {
    return hasOAuthCodeOnLoad || localStorage.getItem('isAuthenticated') === 'true';
  });

  // ── Mount effect: finish a social sign-in ──────────────────────────────────
  useEffect(() => {
    const code = pendingOAuthCode;
    if (!code) return;
    pendingOAuthCode = null; // Single use: a second attempt could only fail.

    authService.exchangeOAuthCode(code)
      .then(() => authService.me())
      .then((res) => {
        localStorage.setItem('isAuthenticated', 'true');
        setRole(res.data.role);
        setUser(res.data);
        setIsAuthenticated(true);
      })
      .catch(() => {
        localStorage.removeItem('isAuthenticated');
        setIsAuthenticated(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // ── Effect: fetch user profile when isAuthenticated flips to true ──────────
  useEffect(() => {
    if (isAuthenticated) {
      if (user) {
        // Profile already loaded (e.g. after login() or the sign-in above) — just unset loading
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
    } else if (!hasOAuthCodeOnLoad) {
      Promise.resolve().then(() => setLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // ── Opened without a connection: fetch the profile as soon as it returns ───
  const online = useOnline();
  useEffect(() => {
    if (!online || !isAuthenticated || user) return;
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
