import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { authApi } from '../lib/api';

// Static imports of dictionary translations
import homeEn from '../locales/en/home.json';
import dashboardEn from '../locales/en/dashboard.json';
import loginEn from '../locales/en/login.json';
import registerEn from '../locales/en/register.json';
import forgotEn from '../locales/en/forgot-password.json';
import pendingEn from '../locales/en/pending-verification.json';
import inventoryEn from '../locales/en/inventory.json';
import linksEn from '../locales/en/links.json';
import leadsEn from '../locales/en/leads.json';
import walletEn from '../locales/en/wallet.json';
import invoicesEn from '../locales/en/invoices.json';
import marketplaceEn from '../locales/en/marketplace.json';
import supportEn from '../locales/en/support.json';
import chatEn from '../locales/en/chat.json';
import verificationEn from '../locales/en/verification.json';
import notificationsEn from '../locales/en/notifications.json';
import callCenterEn from '../locales/en/call-center.json';

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

const translations: Record<string, Record<Namespaces, LocaleDict>> = {
  en: { 
    home: homeEn as LocaleDict, 
    dashboard: dashboardEn as LocaleDict,
    login: loginEn as LocaleDict,
    register: registerEn as LocaleDict,
    'forgot-password': forgotEn as LocaleDict,
    'pending-verification': pendingEn as LocaleDict,
    inventory: inventoryEn as LocaleDict,
    links: linksEn as LocaleDict,
    leads: leadsEn as LocaleDict,
    wallet: walletEn as LocaleDict,
    invoices: invoicesEn as LocaleDict,
    marketplace: marketplaceEn as LocaleDict,
    support: supportEn as LocaleDict,
    chat: chatEn as LocaleDict,
    verification: verificationEn as LocaleDict,
    notifications: notificationsEn as LocaleDict,
    'call-center': callCenterEn as LocaleDict
  },
  fr: { 
    home: homeFr as LocaleDict, 
    dashboard: dashboardFr as LocaleDict,
    login: loginFr as LocaleDict,
    register: registerFr as LocaleDict,
    'forgot-password': forgotFr as LocaleDict,
    'pending-verification': pendingFr as LocaleDict,
    inventory: inventoryFr as LocaleDict,
    links: linksFr as LocaleDict,
    leads: leadsFr as LocaleDict,
    wallet: walletFr as LocaleDict,
    invoices: invoicesFr as LocaleDict,
    marketplace: marketplaceFr as LocaleDict,
    support: supportFr as LocaleDict,
    chat: chatFr as LocaleDict,
    verification: verificationFr as LocaleDict,
    notifications: notificationsFr as LocaleDict,
    'call-center': callCenterFr as LocaleDict
  },
  ar: { 
    home: homeAr as LocaleDict, 
    dashboard: dashboardAr as LocaleDict,
    login: loginAr as LocaleDict,
    register: registerAr as LocaleDict,
    'forgot-password': forgotAr as LocaleDict,
    'pending-verification': pendingAr as LocaleDict,
    inventory: inventoryAr as LocaleDict,
    links: linksAr as LocaleDict,
    leads: leadsAr as LocaleDict,
    wallet: walletAr as LocaleDict,
    invoices: invoicesAr as LocaleDict,
    marketplace: marketplaceAr as LocaleDict,
    support: supportAr as LocaleDict,
    chat: chatAr as LocaleDict,
    verification: verificationAr as LocaleDict,
    notifications: notificationsAr as LocaleDict,
    'call-center': callCenterAr as LocaleDict
  },
};

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => Promise<void>;
  t: (key: string, namespace?: Namespaces, fallbackValue?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshUser } = useAuth();
  const [language, setLanguageState] = useState<string>('ar');

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
    const langDict = translations[language]?.[namespace];
    const val = langDict ? getNestedValue(langDict, key) : undefined;
    if (val !== undefined) {
      return String(val);
    }

    // Fallback to English namespace
    const fallbackDict = translations['en']?.[namespace];
    const fallbackVal = fallbackDict ? getNestedValue(fallbackDict, key) : undefined;
    if (fallbackVal !== undefined) {
      return String(fallbackVal);
    }

    return fallbackValue !== undefined ? fallbackValue : key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
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
