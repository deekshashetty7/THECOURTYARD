type CachedEntry<T> = {
  expiresAt: number;
  value: T;
};

const isWindowAvailable = () => typeof window !== 'undefined';

const readStorage = <T>(key: string): CachedEntry<T> | null => {
  if (!isWindowAvailable()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CachedEntry<T>;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.expiresAt !== 'number') {
      return null;
    }

    if (Date.now() > parsed.expiresAt) {
      window.localStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

export const readCachedJson = <T>(key: string): T | null => {
  const cached = readStorage<T>(key);
  return cached ? cached.value : null;
};

export const writeCachedJson = <T>(key: string, value: T, ttlMs: number) => {
  if (!isWindowAvailable()) {
    return;
  }

  try {
    const entry: CachedEntry<T> = {
      value,
      expiresAt: Date.now() + ttlMs,
    };
    window.localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Ignore storage write failures.
  }
};

export const invalidateCachedJson = (key: string) => {
  if (!isWindowAvailable()) {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage read/write failures.
  }
};

export const fetchJsonWithCache = async <T>(
  url: string,
  options?: {
    cacheKey?: string;
    ttlMs?: number;
    force?: boolean;
    init?: RequestInit;
  }
): Promise<T | null> => {
  const cacheKey = options?.cacheKey;
  const ttlMs = options?.ttlMs ?? 0;

  if (cacheKey && !options?.force) {
    const cached = readCachedJson<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  const response = await fetch(url, {
    ...options?.init,
    cache: options?.force ? 'no-store' : options?.init?.cache,
  });
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as T | null;
  if (payload !== null && cacheKey && ttlMs > 0) {
    writeCachedJson(cacheKey, payload, ttlMs);
  }

  return payload;
};