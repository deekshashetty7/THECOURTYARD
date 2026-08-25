import { getAPI_BASE_URL } from './apiConfig';

const AUTH_ACCESS_TOKEN_KEY = 'tcy.auth.accessToken.v1';
const AUTH_REFRESH_TOKEN_KEY = 'tcy.auth.refreshToken.v1';

type JwtPayload = {
  exp?: number;
};

let refreshPromise: Promise<string | null> | null = null;

const decodeJwtPayload = (token: string): JwtPayload | null => {
  try {
    const payload = token.split('.')[1];
    if (!payload) {
      return null;
    }

    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload;
  } catch {
    return null;
  }
};

const isAccessTokenExpired = (token: string, bufferSeconds = 60) => {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) {
    return false;
  }

  return Date.now() >= payload.exp * 1000 - bufferSeconds * 1000;
};

export const getStoredAccessToken = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(AUTH_ACCESS_TOKEN_KEY);
};

export const getStoredRefreshToken = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(AUTH_REFRESH_TOKEN_KEY);
};

export const setAuthTokens = (accessToken: string, refreshToken?: string | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(AUTH_ACCESS_TOKEN_KEY, accessToken);

  if (refreshToken) {
    window.localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, refreshToken);
  }
};

export const clearAuthTokens = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(AUTH_ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
};

const refreshAccessToken = async () => {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    clearAuthTokens();
    return null;
  }

  const response = await fetch(`${getAPI_BASE_URL()}/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.accessToken) {
    clearAuthTokens();
    return null;
  }

  setAuthTokens(payload.accessToken, payload.refreshToken);
  return payload.accessToken as string;
};

export const getAuthAccessToken = async () => {
  let accessToken = getStoredAccessToken();
  if (!accessToken) {
    return null;
  }

  if (!isAccessTokenExpired(accessToken)) {
    return accessToken;
  }

  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }

  accessToken = await refreshPromise;
  return accessToken;
};
