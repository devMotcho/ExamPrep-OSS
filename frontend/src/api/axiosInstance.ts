import axios from 'axios';
import { isNetworkError, reportNetworkFailure } from '@/lib/online';

export const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true, // Required for httpOnly cookie path (standard login)
  timeout: 15000, // Prevent infinite hangs
});

// ── Request interceptor — inject Bearer token when present ────────────────────
//
// The OAuth2 login path stores the access token in localStorage and uses
// Authorization: Bearer headers instead of cookies, because cross-site
// httpOnly cookies cannot be sent when the frontend and backend are on
// separate public-suffix domains (e.g. frontend and API on separate hosting subdomains).
//
// The standard email/password login path continues to use httpOnly cookies
// transparently — withCredentials: true handles that automatically.
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('oauth_access_token');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor — transparent token refresh ─────────────────────────

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve();
    }
  });
  failedQueue = [];
};

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Prevent infinite loop on auth endpoints
    const isAuthPath =
      originalRequest?.url?.endsWith('/auth/refresh') ||
      originalRequest?.url?.endsWith('/auth/login');

    if (error.response?.status === 401 && !originalRequest?.headers?.['X-Retry'] && !isAuthPath) {
      if (originalRequest) {
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers['X-Retry'] = 'true';
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => axiosInstance(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;

      try {
        // Try to refresh. Works for both paths:
        //   • Cookie path  — refresh_token cookie is sent automatically via withCredentials
        //   • Bearer path  — send stored refresh_token in the request body
        const oauthRefreshToken = localStorage.getItem('oauth_refresh_token');

        let refreshResponse;
        if (oauthRefreshToken) {
          // Bearer / OAuth2 path: send refresh token in body
          refreshResponse = await axiosInstance.post('/auth/refresh', {
            refresh_token: oauthRefreshToken,
          });
          // Backend returns new tokens in JSON body for the Bearer path
          const { access_token, refresh_token, expires_in } = refreshResponse.data;
          if (access_token) {
            localStorage.setItem('oauth_access_token', access_token);
            localStorage.setItem('oauth_token_expires_at', String(Date.now() + expires_in * 1000));
          }
          if (refresh_token) {
            localStorage.setItem('oauth_refresh_token', refresh_token);
          }
        } else {
          // Cookie path: refresh token sent automatically
          await axiosInstance.post('/auth/refresh');
        }

        processQueue(null);
        isRefreshing = false;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        isRefreshing = false;

        // Full session expiry — clear everything and signal logout
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('oauth_access_token');
        localStorage.removeItem('oauth_refresh_token');
        localStorage.removeItem('oauth_token_expires_at');
        window.dispatchEvent(new Event('auth-logout'));

        return Promise.reject(refreshError);
      }
    }

    // A slow or dropped connection is not a logout: the session is still valid.
    if (isNetworkError(error)) {
      reportNetworkFailure();
    }

    return Promise.reject(error);
  }
);
