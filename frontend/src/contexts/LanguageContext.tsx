import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { authApi } from '../lib/api';


import homeFr from '../locales/fr/home.json';
import dashboardFr from '../locales/fr/dashboard.json';
import loginFr from '../locales/fr/login.json';
import registerFr from '../locales/fr/register.json';
import forgotFr from '../locales/fr/forgot-password.json';
import pendingFr from '../locales/fr/pending-verification.json';
import inventoryFr from '../locales/fr/inventory.json';
import linksFr from '../locales/fr/links.json';
import leadsFr from '../locales/fr/leads.json';
import walletFr from '../locales/fr/wallet.json';
import invoicesFr from '../locales/fr/invoices.json';
import marketplaceFr from '../locales/fr/marketplace.json';
import supportFr from '../locales/fr/support.json';
import chatFr from '../locales/fr/chat.json';
import verificationFr from '../locales/fr/verification.json';
import notificationsFr from '../locales/fr/notifications.json';
import callCenterFr from '../locales/fr/call-center.json';

import homeAr from '../locales/ar/home.json';
import dashboardAr from '../locales/ar/dashboard.json';
import loginAr from '../locales/ar/login.json';
import registerAr from '../locales/ar/register.json';
import forgotAr from '../locales/ar/forgot-password.json';
import pendingAr from '../locales/ar/pending-verification.json';
import inventoryAr from '../locales/ar/inventory.json';
import linksAr from '../locales/ar/links.json';
import leadsAr from '../locales/ar/leads.json';
import walletAr from '../locales/ar/wallet.json';
import invoicesAr from '../locales/ar/invoices.json';
import marketplaceAr from '../locales/ar/marketplace.json';
import supportAr from '../locales/ar/support.json';
import chatAr from '../locales/ar/chat.json';
import verificationAr from '../locales/ar/verification.json';
import notificationsAr from '../locales/ar/notifications.json';
import callCenterAr from '../locales/ar/call-center.json';

type LocaleDict = { [key: string]: any };
export type Namespaces = 
  | 'home' 
  | 'dashboard' 
  | 'login' 
  | 'register' 
  | 'forgot-password' 
  | 'pending-verification'
  | 'inventory'
  | 'links'
  | 'leads'
  | 'wallet'
  | 'invoices'
  | 'marketplace'
  | 'support'
  | 'chat'
  | 'verification'
  | 'notifications'
  | 'call-center';

/**
 * Dictionaries load one language at a time, on demand.
 *
 * All 51 JSON files were imported statically, which put ~424 KB of translations
 * into the entry chunk every visitor downloads — including the public offer
 * pages at /r/:code, whose copy is hardcoded and which read none of it. Each
 * language is now a single lazily-loaded chunk.
 */
const LOADERS: Record<string, () => Promise<{ default: Record<string, LocaleDict> }>> = {
  en: () => import('../locales/en'),
  fr: () => import('../locales/fr'),
  ar: () => import('../locales/ar'),
};

export const SUPPORTED_LANGUAGES = ['en', 'fr', 'ar'];

/**
 * Held at module scope rather than component state for two reasons: a language
 * already fetched is never fetched twice, and loadLanguage can fill this before
 * React renders — which is what lets the translate function stay synchronous.
 */
const loaded: Record<string, Record<string, LocaleDict>> = {};
const inFlight: Record<string, Promise<void>> = {};
// A language that failed is not retried. The translate function asks for a
// missing dictionary on every render, so without this a dead chunk would spin
// forever instead of quietly falling through to the key.
const failed = new Set<string>();

export function loadLanguage(lang: string): Promise<void> {
  if (loaded[lang] || !LOADERS[lang] || failed.has(lang)) return Promise.resolve();
  if (!inFlight[lang]) {
    inFlight[lang] = LOADERS[lang]()
      .then((m) => {
        loaded[lang] = m.default;
      })
      // A dictionary that fails to load must never take the page down: the
      // translate function falls back to English, then to the key itself.
      .catch(() => {
        failed.add(lang);
      })
      .finally(() => {
        delete inFlight[lang];
      });
  }
  return inFlight[lang];
}

/**
 * Which language to fetch before the app mounts. Mirrors the priority order in
 * the provider below, minus the signed-in preference — that only arrives with
 * the user object after mount, and switching then simply loads another chunk.
 */
export function initialLanguage(): string {
  try {
    const saved = localStorage.getItem('guest_lang');
    if (saved && SUPPORTED_LANGUAGES.includes(saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  const browser =
    typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : '';
  return SUPPORTED_LANGUAGES.includes(browser) ? browser : 'ar';
}

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => Promise<void>;
  t: (key: string, namespace?: Namespaces, fallbackValue?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshUser } = useAuth();
  // Seeded from the same resolver main.tsx preloads with, so the very first
  // render already matches the dictionary that was fetched. Starting at a hard
  // 'ar' meant a French visitor rendered Arabic for one frame.
  const [language, setLanguageState] = useState<string>(initialLanguage);

  // Bumped when a dictionary arrives, purely to re-render consumers: the
  // dictionaries themselves live at module scope, so nothing else would tell
  // React that a translated string has changed.
  const [dictVersion, setDictVersion] = useState(0);

  /**
   * Fetches a dictionary the moment something actually asks for a string from
   * it, and re-renders when it lands.
   *
   * Demand-driven rather than loaded on mount, because this provider wraps
   * every route including the public offer pages — and those carry hardcoded
   * copy, never call the translate function, and so must not pay for a
   * dictionary. Loading on mount would put one back on exactly the pages the
   * change exists to spare. It also means a screen reached by client-side
   * navigation is never stranded without its strings.
   */
  const ensureLoaded = (lang: string) => {
    if (loaded[lang] || failed.has(lang)) return;
    loadLanguage(lang).then(() => setDictVersion((v) => v + 1));
  };

  // Resolve language based on priorities
  useEffect(() => {
    // 1. Logged in User preference
    if (user?.language && ['en', 'fr', 'ar'].includes(user.language)) {
      setLanguageState(user.language);
      return;
    }

    // 2. Guest choice in localStorage
    const savedGuestLang = localStorage.getItem('guest_lang');
    if (savedGuestLang && ['en', 'fr', 'ar'].includes(savedGuestLang)) {
      setLanguageState(savedGuestLang);
      return;
    }

    // 3. Browser language fallback
    const browserLang = navigator.language.split('-')[0];
    if (['en', 'fr', 'ar'].includes(browserLang)) {
      setLanguageState(browserLang);
      return;
    }

    // 4. Absolute default
    setLanguageState('ar');
  }, [user?.language]);

  // Handle document attributes update whenever language changes
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', language);
    if (language === 'ar') {
      root.setAttribute('dir', 'rtl');
    } else {
      root.setAttribute('dir', 'ltr');
    }
  }, [language]);

  const setLanguage = async (newLang: string) => {
    if (!['en', 'fr', 'ar'].includes(newLang)) return;

    // Set state immediately for instant response
    setLanguageState(newLang);
    localStorage.setItem('guest_lang', newLang);

    if (user) {
      try {
        // Sync with backend database
        await authApi.updateLanguageSetting(newLang);
        await refreshUser();
      } catch (err) {
        console.error('Failed to sync language setting to database:', err);
      }
    }
  };

  // Translate function with fallback to English
  const t = (key: string, namespace: Namespaces = 'home', fallbackValue?: string): string => {
    const getNestedValue = (obj: any, path: string): any => {
      return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    };

    // Get string from selected language namespace
    ensureLoaded(language);
    const langDict = loaded[language]?.[namespace];
    const val = langDict ? getNestedValue(langDict, key) : undefined;
    if (val !== undefined) {
      return String(val);
    }

    // Fallback to English namespace. Fetched only once a lookup has actually
    // fallen through to it — a complete dictionary never pulls English at all.
    ensureLoaded('en');
    const fallbackDict = loaded['en']?.[namespace];
    const fallbackVal = fallbackDict ? getNestedValue(fallbackDict, key) : undefined;
    if (fallbackVal !== undefined) {
      return String(fallbackVal);
    }

    return fallbackValue !== undefined ? fallbackValue : key;
  };

  // Rebuilt when a dictionary lands so consumers re-read their strings; without
  // dictVersion in the dependencies a translated screen would keep the values it
  // resolved before the chunk arrived.
  const value = useMemo(
    () => ({ language, setLanguage, t }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language, dictVersion]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
