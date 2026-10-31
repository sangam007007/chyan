import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { emitPaywall } from '@/services/paywall';

/**
 * In-memory token storage (never persisted to localStorage/sessionStorage).
 * This prevents XSS-based token theft as per Requirement 7.4.
 */
let accessToken: string | null = null;
let csrfToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

/**
 * Fetch a CSRF token from the server on startup.
 * Stores it in memory for use in subsequent requests.
 */
export async function fetchCsrfToken(): Promise<void> {
  try {
    const response = await api.get('/api/auth/csrf-token');
    if (response.data?.data?.token) {
      setCsrfToken(response.data.data.token);
    }
  } catch {
    // CSRF fetch failures are non-fatal on startup;
    // the token will be retried on the next state-changing request.
  }
}

// --- Request queue for 401 retry logic ---

interface QueuedRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  config: InternalAxiosRequestConfig;
}

let isRefreshing = false;
let failedQueue: QueuedRequest[] = [];

function processQueue(error: unknown, token: string | null = null): void {
  failedQueue.forEach(({ resolve, reject, config }) => {
    if (error) {
      reject(error);
    } else {
      if (token && config.headers) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      resolve(api(config));
    }
  });
  failedQueue = [];
}

// --- Online/Offline event bus ---

export type OnlineStatusListener = (isOnline: boolean) => void;

const onlineStatusListeners: Set<OnlineStatusListener> = new Set();

export function subscribeOnlineStatus(listener: OnlineStatusListener): () => void {
  onlineStatusListeners.add(listener);
  return () => {
    onlineStatusListeners.delete(listener);
  };
}

export function emitOnlineStatus(isOnline: boolean): void {
  onlineStatusListeners.forEach((listener) => listener(isOnline));
}

// --- Axios instance ---

const REQUEST_TIMEOUT_MS = 30_000; // 30 seconds per Requirement 18.5

const api = axios.create({
  baseURL: '',
  timeout: REQUEST_TIMEOUT_MS,
  withCredentials: true, // Send HTTP-only cookies (refresh token)
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request Interceptor:
 * - Attaches access token in Authorization header
 * - Attaches CSRF token in X-CSRF-Token header for state-changing requests
 * - Sets up AbortController for timeout enforcement
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Attach access token if available
    if (accessToken && config.headers) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // Attach CSRF token for state-changing requests (POST, PATCH, PUT, DELETE)
    const method = config.method?.toUpperCase();
    if (csrfToken && config.headers && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method || '')) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }

    // Attach AbortController for timeout auto-cancel
    if (!config.signal) {
      const controller = new AbortController();
      config.signal = controller.signal;

      // Auto-cancel after timeout
      setTimeout(() => {
        controller.abort();
      }, REQUEST_TIMEOUT_MS);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response Interceptor:
 * - On 401: queue the failed request, attempt token refresh, retry queued requests
 * - On network error: emit offline status event
 * - Handles timeout errors
 */
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle network errors (offline detection)
    if (!error.response && error.code !== 'ECONNABORTED') {
      // Network error - likely offline
      if (!navigator.onLine) {
        emitOnlineStatus(false);
      }
      return Promise.reject(error);
    }

    // Handle timeout (AbortController abort or axios timeout)
    if (error.code === 'ECONNABORTED' || error.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }

    // 402 - the free trial / paid plan has ended: show the "buy a plan" popup
    if (error.response?.status === 402) {
      const code = (error.response.data as { error?: { code?: string } } | undefined)?.error?.code;
      if (code === 'SUBSCRIPTION_REQUIRED') emitPaywall();
      return Promise.reject(error);
    }

    // Handle 401 - Token expired, attempt refresh
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Don't retry refresh endpoint itself to avoid infinite loop
      if (originalRequest.url?.includes('/api/auth/token/refresh')) {
        // Refresh token is invalid/expired - clear everything
        setAccessToken(null);
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request to retry after refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, config: originalRequest });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await api.post('/api/auth/token/refresh');
        const newToken = response.data?.data?.accessToken;

        if (newToken) {
          setAccessToken(newToken);
          processQueue(null, newToken);

          // Retry the original request with new token
          if (originalRequest.headers) {
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          }
          return api(originalRequest);
        } else {
          processQueue(new Error('Refresh failed'), null);
          setAccessToken(null);
          return Promise.reject(error);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        setAccessToken(null);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Helper to create a request config with a custom AbortController.
 * Useful for components that want to cancel requests on unmount.
 */
export function createCancelableRequest(): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
  };
}

export type { AxiosRequestConfig };
export default api;
