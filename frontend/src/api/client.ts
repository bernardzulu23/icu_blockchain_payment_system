import axios from 'axios';

/** Resolve API base; ignore placeholders / empty values baked from bad Vercel env. */
function resolveApiUrl(): string {
  const raw = (import.meta.env.VITE_API_URL || '').trim();
  // Placeholder from old docs accidentally set on Vercel → DNS fails.
  if (!raw || /your-backend-host|YOUR-BACKEND|example\.com/i.test(raw)) {
    return '/api';
  }
  return raw.replace(/\/$/, '');
}

const API_URL = resolveApiUrl();

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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
