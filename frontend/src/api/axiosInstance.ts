import axios from 'axios';
import { isNetworkError, reportNetworkFailure } from '@/lib/online';

export const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true, // The session lives in HttpOnly cookies, on every sign-in path
  timeout: 15000, // Prevent infinite hangs
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

/** Another tab refreshing at the same moment (409) has renewed the shared cookies, so this tab is fine too. */
const refreshSession = async () => {
  try {
    await axiosInstance.post('/auth/refresh');
  } catch (error: any) {
    if (error?.response?.status !== 409) throw error;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
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
        await refreshSession();

        processQueue(null);
        isRefreshing = false;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        isRefreshing = false;

        // Full session expiry — clear everything and signal logout
        localStorage.removeItem('isAuthenticated');
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
