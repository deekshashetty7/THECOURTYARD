import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getAuthAccessToken } from '../lib/authToken';
import { getAPI_BASE_URL } from '../lib/apiConfig';
import { showErrorToast } from '../utils/notificationHelpers';
import { fetchJsonWithCache, invalidateCachedJson, writeCachedJson } from '../lib/responseCache';

export interface LandingPageContent {
  // Hero Section
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  heroCTA: string;
  heroSecondaryButton: string;
  heroImage: string;

  // Features Section
  features: {
    id: string;
    icon: string;
    title: string;
    description: string;
  }[];

  // Stats Section
  stats: {
    id: string;
    value: string;
    label: string;
  }[];

  // About Section
  aboutTitle: string;
  aboutDescription: string;
  aboutImage: string;

  // Gallery Section
  galleryTitle: string;
  gallerySubtitle: string;
  gallery: {
    id: string;
    url: string;
    caption: string;
  }[];

  // Venue / contact content shared across public pages
  venueName?: string;
  venueAddress?: string;
  venuePhone?: string;
  venueEmail?: string;
  venueOperatingHoursText?: string;
  venueRating?: number;
  venueRatingCount?: number;

  // Contact page content
  contactQuickActions?: {
    id: string;
    icon: string;
    title: string;
    description: string;
    actionType: string;
    actionValue: string;
    color: string;
  }[];
  contactFaqs?: {
    id: string;
    question: string;
    answer: string;
  }[];

  // User home social proof
  reviews?: {
    id: string;
    name: string;
    rating: number;
    comment: string;
    date: string;
    adminReply?: string | null;
    adminReplyBy?: string | null;
    adminReplyAt?: string | null;
  }[];
}

interface LandingPageContextType {
  content: LandingPageContent;
  updateContent: (content: Partial<LandingPageContent>) => Promise<void>;
}

const LandingPageContext = createContext<LandingPageContextType | undefined>(undefined);

const EMPTY_LANDING_CONTENT: LandingPageContent = {
  heroTitle: '',
  heroSubtitle: '',
  heroDescription: '',
  heroCTA: '',
  heroSecondaryButton: '',
  heroImage: '',
  features: [],
  stats: [],
  aboutTitle: '',
  aboutDescription: '',
  aboutImage: '',
  galleryTitle: '',
  gallerySubtitle: '',
  gallery: [],
  contactQuickActions: [],
  contactFaqs: [],
  reviews: [],
};

const normalizeLandingContent = (content: Partial<LandingPageContent> | null | undefined): LandingPageContent => {
  const nextContent = { ...EMPTY_LANDING_CONTENT, ...(content || {}) };

  return {
    ...nextContent,
    features: Array.isArray(content?.features) ? content.features : [],
    stats: Array.isArray(content?.stats) ? content.stats : [],
    gallery: Array.isArray(content?.gallery) ? content.gallery : [],
    contactQuickActions: Array.isArray(content?.contactQuickActions) ? content.contactQuickActions : [],
    contactFaqs: Array.isArray(content?.contactFaqs) ? content.contactFaqs : [],
    reviews: Array.isArray(content?.reviews) ? content.reviews : [],
  };
};

export const LandingPageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [content, setContent] = useState<LandingPageContent>(EMPTY_LANDING_CONTENT);
  const CACHE_KEY = 'tcy.landing.content.v1';
  const CACHE_TTL_MS = 5 * 60 * 1000;

  useEffect(() => {
    let active = true;

    const loadRemoteContent = async (force = false) => {
      try {
        const [settingsPayload, galleryPayload, reviewsPayload] = await Promise.all([
          fetchJsonWithCache<{ settings?: { landing?: Partial<LandingPageContent> } }>(`${getAPI_BASE_URL()}/settings`, {
            cacheKey: CACHE_KEY,
            ttlMs: CACHE_TTL_MS,
            force,
          }),
          fetchJsonWithCache<{ gallery?: LandingPageContent['gallery'] }>(`${getAPI_BASE_URL()}/gallery`, {
            cacheKey: `${CACHE_KEY}:gallery`,
            ttlMs: CACHE_TTL_MS,
            force: true,
          }),
          fetchJsonWithCache<{ reviews?: LandingPageContent['reviews'] }>(`${getAPI_BASE_URL()}/reviews`, {
            cacheKey: `${CACHE_KEY}:reviews`,
            ttlMs: CACHE_TTL_MS,
            force,
          }),
        ]);

        const remoteContent = settingsPayload?.settings?.landing;
        const remoteGallery = Array.isArray(galleryPayload?.gallery) ? galleryPayload.gallery : [];
        const remoteReviews = Array.isArray(reviewsPayload?.reviews) ? reviewsPayload.reviews : [];

        if (!active || !remoteContent || typeof remoteContent !== 'object') {
          return;
        }

        const normalized = normalizeLandingContent({
          ...(remoteContent as Partial<LandingPageContent>),
          gallery: remoteGallery,
          reviews: remoteReviews,
        });

        setContent(normalized);

        try {
          writeCachedJson(CACHE_KEY, { settings: { landing: normalized } }, CACHE_TTL_MS);
          writeCachedJson(`${CACHE_KEY}:gallery`, { gallery: remoteGallery }, CACHE_TTL_MS);
          writeCachedJson(`${CACHE_KEY}:reviews`, { reviews: remoteReviews }, CACHE_TTL_MS);
        } catch {
          // Ignore cache write failures.
        }
      } catch {
        // Keep the empty state if the backend is temporarily unavailable.
      }
    };

    void loadRemoteContent();

    const handleSettingsUpdated = () => {
      invalidateCachedJson(CACHE_KEY);
      invalidateCachedJson(`${CACHE_KEY}:gallery`);
      invalidateCachedJson(`${CACHE_KEY}:reviews`);
      void loadRemoteContent(true);
    };

    const handleStorageEvent = (ev: StorageEvent) => {
      if (ev.key === 'tcy:settings-updated') {
        handleSettingsUpdated();
      }
    };

    const pollTimer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      void loadRemoteContent();
    }, 30000);

    window.addEventListener('tcy:settings-updated', handleSettingsUpdated);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      active = false;
      window.clearInterval(pollTimer);
      window.removeEventListener('tcy:settings-updated', handleSettingsUpdated);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, []);

  const updateContent = async (newContent: Partial<LandingPageContent>) => {
    const { gallery: _gallery, ...rest } = newContent;
    const nextContent = normalizeLandingContent({ ...content, ...rest, gallery: content.gallery });
    setContent(nextContent);

    try {
      const token = await getAuthAccessToken();
      if (!token) {
        throw new Error('Please sign in again and retry.');
      }

      const response = await fetch(`${getAPI_BASE_URL()}/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ landing: nextContent }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message || 'Unable to sync landing content to server');
      }

      window.dispatchEvent(new CustomEvent('tcy:settings-updated'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sync landing content to server';
      showErrorToast('Save failed', message);
      throw error;
    }
  };

  return (
    <LandingPageContext.Provider value={{ content, updateContent }}>
      {children}
    </LandingPageContext.Provider>
  );
};

export const useLandingPage = () => {
  const context = useContext(LandingPageContext);
  if (!context) {
    throw new Error('useLandingPage must be used within LandingPageProvider');
  }
  return context;
};
