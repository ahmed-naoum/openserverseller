import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { storePublicApi } from '../lib/api';

export interface StoreCollection {
  id: number;
  nameFr: string;
  nameAr: string | null;
  slug: string;
  description: string | null;
  imageUrl: string | null;
}

/**
 * A shop category. Its own tree, belonging to this shop and driving its
 * navigation — unrelated to the platform-wide categories on the marketplace
 * catalogue, which storefronts never see.
 */
export interface StoreCategorySummary {
  id: number;
  nameFr: string;
  nameAr: string | null;
  slug: string;
  imageUrl: string | null;
  productsCount: number;
  children: StoreCategorySummary[];
}

export interface StorePageSummary {
  id: number;
  title: string;
  slug: string;
}

export interface StoreData {
  id: number;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  faviconUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  whatsappNumber: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  tiktokUrl: string | null;
  themeName: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  headerStyle: string;
  footerStyle: string;
  announcementText: string | null;
  announcementActive: boolean;
  customCss: string | null;
  homeStructure: any;
  navigationMenu: Array<{ label: string; url: string }> | null;
  footerMenu: Array<{ label: string; url: string }> | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImageUrl: string | null;
  currency: string;
  enableCod: boolean;
  freeShippingThreshold: number | null;
  standardShippingFee: number;
  status: string;
  isPublished: boolean;
  collections: StoreCollection[];
  categories: StoreCategorySummary[];
  customPages: StorePageSummary[];
  /** Documents built in Studio, rendered on every page. Null when unset. */
  globalSections?: { header: any; footer: any };
}

export interface StoreVendor {
  id: number;
  uuid: string;
  subdomain: string | null;
  customDomain: string | null;
  customDomainStatus: string;
}

export interface StorePixel {
  id?: number;
  platform: string;
  pixelId: string;
  conversionEvent?: string;
  testEventCode?: string | null;
}

interface StoreContextType {
  store: StoreData | null;
  vendor: StoreVendor | null;
  pixels: StorePixel[];
  isStorefront: boolean;
  loading: boolean;
  error: string | null;
  refreshStore: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType>({
  store: null,
  vendor: null,
  pixels: [],
  isStorefront: false,
  loading: true,
  error: null,
  refreshStore: async () => {},
});

export const useStore = () => useContext(StoreContext);

/**
 * The platform's own domain: where the marketing site, sign-in and every
 * dashboard live. Everything else that reaches this app is a candidate
 * storefront.
 *
 * Configured, not hardcoded. The backend derives the same value from
 * FRONTEND_URL (utils/subdomain.ts), and a literal here meant the two
 * disagreed the moment either moved — which reads to a seller as their whole
 * shop disappearing.
 */
export const PLATFORM_DOMAIN = String(
  (import.meta.env as any).VITE_PLATFORM_DOMAIN || 'silacod.com'
)
  .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
  .replace(/^www\./i, '')
  .replace(/[/:].*$/, '')
  .toLowerCase();

/** Where to send someone who wants the platform, not a shop. */
export const PLATFORM_ORIGIN = `https://${PLATFORM_DOMAIN}`;

/**
 * Subdomains that are infrastructure, never a seller. A seller cannot register
 * these as their subdomain, so nothing is lost by refusing to treat them as a
 * shop.
 */
const RESERVED_SUBDOMAINS = new Set(['app', 'api', 'admin', 'custom', 'www', 'staging', 'preview', 'dev']);

/**
 * Whether this host COULD be a storefront — not whether it is one.
 *
 * Deciding that needs the server: only it knows which domains have a published
 * store behind them. This is the cheap synchronous filter that says "worth
 * asking", so the platform's own domain never pays for a resolve request. A
 * true answer here starts a lookup; it does not by itself put the visitor in a
 * shop. See StorefrontGate in App.tsx.
 */
export function detectStoreHost(): { isStore: boolean; explicitSlug?: string } {
  if (typeof window === 'undefined') return { isStore: false };

  const hostname = window.location.hostname.toLowerCase().replace(/^www\./, '');
  const searchParams = new URLSearchParams(window.location.search);
  const previewSlug = searchParams.get('__store') || undefined;

  if (previewSlug) {
    return { isStore: true, explicitSlug: previewSlug };
  }

  // Local development: seller.localhost
  if (hostname.endsWith('.localhost')) {
    const parts = hostname.split('.');
    if (parts.length > 1 && parts[0] !== 'localhost' && !RESERVED_SUBDOMAINS.has(parts[0])) {
      return { isStore: true };
    }
    return { isStore: false };
  }

  if (hostname === PLATFORM_DOMAIN || hostname === 'localhost' || hostname === '127.0.0.1') {
    return { isStore: false };
  }

  // A subdomain of the platform: seller.silacod.com
  if (hostname.endsWith('.' + PLATFORM_DOMAIN)) {
    const sub = hostname.slice(0, -(PLATFORM_DOMAIN.length + 1));
    // Only a single label. `a.b.silacod.com` is not a seller subdomain, and
    // treating it as one hands an unresolvable name to the resolver.
    if (sub && !sub.includes('.') && !RESERVED_SUBDOMAINS.has(sub)) {
      return { isStore: true };
    }
    return { isStore: false };
  }

  // Any other domain: possibly a connected custom domain (brand.ma). The
  // resolver decides.
  return { isStore: true };
}

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [store, setStore] = useState<StoreData | null>(null);
  const [vendor, setVendor] = useState<StoreVendor | null>(null);
  const [pixels, setPixels] = useState<StorePixel[]>([]);
  const [isStorefront, setIsStorefront] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStore = useCallback(async () => {
    const detection = detectStoreHost();
    if (!detection.isStore && !detection.explicitSlug) {
      setIsStorefront(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await storePublicApi.resolve(detection.explicitSlug);
      const data = res.data?.data;
      if (data?.store) {
        setStore(data.store);
        setVendor(data.vendor);
        setPixels(data.pixels || []);
        setIsStorefront(true);

        // Dynamically apply Theme CSS Variables & Title
        if (data.store.primaryColor) {
          document.documentElement.style.setProperty('--store-primary', data.store.primaryColor);
        }
        if (data.store.secondaryColor) {
          document.documentElement.style.setProperty('--store-secondary', data.store.secondaryColor);
        }
        if (data.store.name) {
          document.title = data.store.metaTitle || data.store.name;
        }
        if (data.store.faviconUrl) {
          let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = data.store.faviconUrl;
        }
      } else {
        setIsStorefront(false);
      }
    } catch (err: any) {
      console.warn('Store resolution notice:', err?.response?.data?.message || err.message);
      setIsStorefront(false);
      setError(err?.response?.data?.message || 'Boutique introuvable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStore();
  }, [fetchStore]);

  return (
    <StoreContext.Provider
      value={{
        store,
        vendor,
        pixels,
        isStorefront,
        loading,
        error,
        refreshStore: fetchStore,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};
