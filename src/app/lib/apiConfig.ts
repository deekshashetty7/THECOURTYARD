const DEFAULT_REMOTE_API_BASE_URL = 'https://thecourtyard-api.onrender.com/api';

export const getApiBaseUrl = () => {
  const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  const isLocalhost =
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

  if (isLocalhost) {
    return '/api';
  }

  if (!rawBaseUrl || rawBaseUrl === '/api') {
    return DEFAULT_REMOTE_API_BASE_URL;
  }

  return rawBaseUrl.replace(/\/+$/, '');
};

// Evaluate at runtime, not build time
export const getAPI_BASE_URL = () => getApiBaseUrl();
