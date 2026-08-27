import axios from 'axios';
import { ensureCsrfToken, getCsrfTokenFromCookie } from '../utils/csrf';

const BAD_HOST =
  /your-backend-host|YOUR-BACKEND|YOUR-API|YOUR-APP|example\.com|your-domain|yourdomain/i;

/** Resolve API base at runtime so bad Vercel build env cannot break login. */
function resolveApiUrl(): string {
  const raw = (import.meta.env.VITE_API_URL || '').trim();

  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;

    // Vercel production + preview — always same-origin serverless API
    if (hostname.endsWith('.vercel.app')) {
      return '/api';
    }

    // Local Vite dev — prefer proxy unless explicit override to backend port
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      if (!raw || BAD_HOST.test(raw)) return '/api';
      if (/^https?:\/\//i.test(raw)) {
        try {
          const host = new URL(raw).hostname;
          if (host === 'localhost' || host === '127.0.0.1') {
            return raw.replace(/\/$/, '');
          }
        } catch {
          return '/api';
        }
      }
      return raw.replace(/\/$/, '') || '/api';
    }

    // Custom domain in production — same-origin /api when env is missing or placeholder
    if (protocol === 'https:' && (!raw || BAD_HOST.test(raw))) {
      return '/api';
    }
  }

  if (!raw || BAD_HOST.test(raw)) {
    return '/api';
  }

  // Absolute URL with placeholder host baked at build time
  if (/^https?:\/\//i.test(raw)) {
    try {
      if (BAD_HOST.test(new URL(raw).hostname)) {
        return '/api';
      }
    } catch {
      return '/api';
    }
  }

  // Hostname without scheme (e.g. api.foo.com/api) → DNS failures
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(raw) && !raw.startsWith('/')) {
    return '/api';
  }

  return raw.replace(/\/$/, '');
}

const API_URL = resolveApiUrl();

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const method = (config.method || 'get').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    if (!getCsrfTokenFromCookie()) {
      await ensureCsrfToken(config.baseURL || API_URL);
    }
    const csrf = getCsrfTokenFromCookie();
    if (csrf) {
      config.headers['x-csrf-token'] = csrf;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
