import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadGoogleAnalytics, loadMetaPixel } from '../utils/analyticsLoader';

const STORAGE_KEY = 'cookie_consent_v1';

export interface CookieConsent {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
}

interface StoredConsent extends CookieConsent {
  decidedAt: string;
}

interface CookieConsentContextType {
  consent: CookieConsent;
  hasDecided: boolean;
  showBanner: boolean;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  savePreferences: (analytics: boolean, marketing: boolean) => void;
  openPreferences: () => void;
  closePreferences: () => void;
}

const defaultConsent: CookieConsent = {
  necessary: true,
  analytics: false,
  marketing: false
};

const CookieConsentContext = createContext<CookieConsentContextType | undefined>(undefined);

export const CookieConsentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [consent, setConsent] = useState<CookieConsent>(defaultConsent);
  const [hasDecided, setHasDecided] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  // On mount: read any prior decision from localStorage. If one exists,
  // apply it silently (loaders run via the effect below) and keep the
  // banner hidden. If not, show the banner so the visitor can decide.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<StoredConsent>;
        setConsent({
          necessary: true,
          analytics: Boolean(parsed.analytics),
          marketing: Boolean(parsed.marketing)
        });
        setHasDecided(true);
        setShowBanner(false);
      } else {
        setShowBanner(true);
      }
    } catch {
      // Corrupt/unavailable localStorage — fail safe by asking again.
      setShowBanner(true);
    }
  }, []);

  const persist = (next: CookieConsent) => {
    setConsent(next);
    setHasDecided(true);
    setShowBanner(false);
    try {
      const toStore: StoredConsent = { ...next, decidedAt: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch {
      // localStorage unavailable (private mode, quota, etc.) — consent
      // still applies for this session via React state.
    }
  };

  // Reactively load the third-party scripts whenever consent is granted,
  // so acceptAll()/savePreferences() take effect immediately without a
  // page reload. The loaders are themselves idempotent/fail-closed.
  useEffect(() => {
    if (consent.analytics) {
      loadGoogleAnalytics((import.meta as any).env?.VITE_GA4_MEASUREMENT_ID);
    }
  }, [consent.analytics]);

  useEffect(() => {
    if (consent.marketing) {
      loadMetaPixel((import.meta as any).env?.VITE_META_PIXEL_ID);
    }
  }, [consent.marketing]);

  const acceptAll = () => {
    persist({ necessary: true, analytics: true, marketing: true });
  };

  const rejectNonEssential = () => {
    persist({ necessary: true, analytics: false, marketing: false });
  };

  const savePreferences = (analytics: boolean, marketing: boolean) => {
    persist({ necessary: true, analytics, marketing });
  };

  // Lets a visitor revisit their choice later (e.g. via a "Cookie
  // Preferences" footer link) even after a decision was already made.
  const openPreferences = () => {
    setShowBanner(true);
  };

  const closePreferences = () => {
    setShowBanner(false);
  };

  return (
    <CookieConsentContext.Provider
      value={{
        consent,
        hasDecided,
        showBanner,
        acceptAll,
        rejectNonEssential,
        savePreferences,
        openPreferences,
        closePreferences
      }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
};

export const useCookieConsent = () => {
  const context = useContext(CookieConsentContext);
  if (context === undefined) {
    throw new Error('useCookieConsent must be used within a CookieConsentProvider');
  }
  return context;
};
