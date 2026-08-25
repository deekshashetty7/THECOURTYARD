import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { getAPI_BASE_URL } from '../lib/apiConfig';
import { clearAuthTokens, getAuthAccessToken, getStoredAccessToken, setAuthTokens } from '../lib/authToken';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  address?: string;
  role: 'user' | 'admin';
  emailVerified?: boolean;
  photoUrl?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, role?: 'user' | 'admin' | 'any') => Promise<User>;
  register: (name: string, email: string, phone: string, password: string) => Promise<'signed-in'>;
  resendVerificationEmail: (email: string) => Promise<void>;
  requestPasswordReset: (email: string, role: 'user' | 'admin') => Promise<void>;
  resetPasswordWithToken: (token: string, newPassword: string) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateProfile: (updates: { phone?: string; location?: string; photoUrl?: string }) => Promise<User>;
  uploadProfilePhoto: (file: File) => Promise<User>;
  refreshCurrentUser: () => Promise<User | null>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_STORAGE_KEY = 'tcy.auth.user.v1';

type BackendAuthPayload = {
  user?: User;
  accessToken?: string;
  refreshToken?: string;
};

const AUTH_REQUEST_TIMEOUT_MS = 12000;

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as User;
      if (!getStoredAccessToken()) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!user) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      clearAuthTokens();
      return;
    }

    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    let active = true;

    const bootstrapSession = async () => {
      const token = await getAuthAccessToken();
      if (!token) {
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetch(`${getAPI_BASE_URL()}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });

        if (!response.ok) {
          if (active) {
            setUser(null);
          }
          return;
        }

        const payload = await response.json();
        if (active && payload?.user) {
          setUser(payload.user as User);
        }
      } catch {
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void bootstrapSession();

    return () => {
      active = false;
    };
  }, []);

  const persistBackendAuth = (payload: BackendAuthPayload): User => {
    const nextUser = payload.user;
    if (!nextUser) {
      throw new Error('Unable to load user profile');
    }

    if (payload.accessToken) {
      setAuthTokens(payload.accessToken, payload.refreshToken);
    }

    setUser(nextUser);
    return nextUser;
  };

  const login = async (email: string, password: string, role: 'user' | 'admin' | 'any' = 'any'): Promise<User> => {
    const normalizedEmail = email.trim().toLowerCase();
    const response = await withTimeout(
      fetch(`${getAPI_BASE_URL()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password, role }),
        cache: 'no-store',
      }),
      AUTH_REQUEST_TIMEOUT_MS,
      'Login timed out. Please try again.'
    );

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || 'Invalid email or password');
    }

    const nextUser = persistBackendAuth(payload as BackendAuthPayload);

    if (role === 'admin' && nextUser.role !== 'admin') {
      clearAuthTokens();
      setUser(null);
      throw new Error('Admin access required for this portal');
    }

    if (role === 'user' && nextUser.role === 'admin') {
      clearAuthTokens();
      setUser(null);
      throw new Error('This email is registered for admin access');
    }

    return nextUser;
  };

  const register = async (name: string, email: string, phone: string, password: string): Promise<'signed-in'> => {
    const normalizedEmail = email.trim().toLowerCase();
    const response = await fetch(`${getAPI_BASE_URL()}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email: normalizedEmail, phone, password }),
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || 'Registration failed');
    }

    persistBackendAuth(payload as BackendAuthPayload);
    return 'signed-in';
  };

  const resendVerificationEmail = async (email: string) => {
    void email;
    return;
  };

  const requestPasswordReset = async (email: string, role: 'user' | 'admin') => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error('Email is required');
    }

    void role;

    const response = await fetch(`${getAPI_BASE_URL()}/auth/password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail }),
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || 'Unable to send reset link');
    }
  };

  const resetPasswordWithToken = async (token: string, newPassword: string) => {
    const response = await fetch(`${getAPI_BASE_URL()}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || 'Unable to update password');
    }
  };

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    const accessToken = await getAuthAccessToken();
    if (!accessToken) {
      throw new Error('Please sign in again');
    }

    const response = await fetch(`${getAPI_BASE_URL()}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || 'Unable to update password');
    }
  };

  const refreshCurrentUser = async () => {
    const accessToken = await getAuthAccessToken();
    if (!accessToken) {
      setUser(null);
      return null;
    }

    const response = await fetch(`${getAPI_BASE_URL()}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.user) {
      return null;
    }

    const nextUser = payload.user as User;
    setUser(nextUser);
    return nextUser;
  };

  const updateProfile = async (updates: { phone?: string; location?: string; photoUrl?: string }): Promise<User> => {
    if (!user) {
      throw new Error('Please sign in again');
    }

    const accessToken = await getAuthAccessToken();
    if (!accessToken) {
      throw new Error('Please sign in again');
    }

    const response = await fetch(`${getAPI_BASE_URL()}/auth/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(updates),
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || 'Failed to update profile');
    }

    const nextUser = payload?.user as User | undefined;
    if (!nextUser) {
      throw new Error('Unable to load updated profile');
    }

    setUser({ ...user, ...nextUser });
    return nextUser;
  };

  const uploadProfilePhoto = async (file: File): Promise<User> => {
    if (!file.type.startsWith('image/')) {
      throw new Error('Please choose an image file');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image must be smaller than 5 MB');
    }

    const imageDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read image file'));
      reader.readAsDataURL(file);
    });

    const accessToken = await getAuthAccessToken();
    if (!accessToken) {
      throw new Error('Please sign in again');
    }

    const response = await fetch(`${getAPI_BASE_URL()}/auth/profile/photo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ image: imageDataUrl }),
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error?.message || payload?.message || 'Failed to upload profile photo');
    }

    const nextUser = payload?.user as User | undefined;
    if (!nextUser) {
      throw new Error('Unable to load updated profile');
    }

    setUser({ ...user!, ...nextUser });
    return nextUser;
  };

  const logout = () => {
    const token = getStoredAccessToken();
    if (token) {
      void fetch(`${getAPI_BASE_URL()}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }).catch(() => {
        // Ignore logout errors
      });
    }

    clearAuthTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        resendVerificationEmail,
        requestPasswordReset,
        resetPasswordWithToken,
        updatePassword,
        updateProfile,
        uploadProfilePhoto,
        refreshCurrentUser,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
