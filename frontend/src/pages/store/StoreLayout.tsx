import React, { useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../../contexts/StoreContext';
import StoreHeader from '../../components/store/StoreHeader';
import StoreFooter from '../../components/store/StoreFooter';
import StoreCartDrawer from '../../components/store/StoreCartDrawer';
import StoreWhatsAppButton from '../../components/store/StoreWhatsAppButton';
import StoreMobileBar from '../../components/store/StoreMobileBar';
import { ShoppingBag } from 'lucide-react';
import BlockRenderer from '../../components/helper/sitebuilder/BlockRenderer';
import { flatBlocks } from '@shared/document/migrate.js';
import { themeFromStore, resolveBlocks } from '@shared/document/theme.js';
import StorePixelTracker from '../../components/store/StorePixelTracker';

/** Loads the store's brand font from Google Fonts once; the compiled page does the same in its head. */
function useBrandFont(font: string | null | undefined) {
  useEffect(() => {
    const family = String(font ?? '').trim();
    if (!/^[A-Za-z0-9 ]{2,40}$/.test(family)) return;
    const id = 'store-brand-font';
    const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@400;500;700;800;900&display=swap`;
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
  }, [font]);
}

/**
 * A store opened with `?__store=slug` (development on 127.0.0.1) would lose
 * the slug on the first click: every link on the page is a plain path. Keep
 * it — on internal anchors as they are clicked, and on router navigations.
 */
function useKeepStoreQuery() {
  const location = useLocation();
  const navigate = useNavigate();
  const slug = useRef<string | null>(typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('__store') : null);

  useEffect(() => {
    const value = slug.current;
    if (!value) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (!href.startsWith('/') || href.startsWith('//')) return;
      const url = new URL(href, window.location.origin);
      if (url.searchParams.get('__store')) return;
      url.searchParams.set('__store', value);
      a.setAttribute('href', `${url.pathname}${url.search}${url.hash}`);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    const value = slug.current;
    if (!value) return;
    const params = new URLSearchParams(location.search);
    if (params.get('__store')) return;
    params.set('__store', value);
    navigate({ pathname: location.pathname, search: `?${params.toString()}`, hash: location.hash }, { replace: true });
  }, [location.pathname, location.search, location.hash, navigate]);
}

export default function StoreLayout() {
  const { store, loading, error } = useStore();
  useBrandFont(store?.fontFamily);
  useKeepStoreQuery();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-gray-500 tracking-wide uppercase">Chargement de la boutique...</p>
        </div>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center mb-4">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-gray-900">Boutique introuvable ou indisponible</h1>
        <p className="text-sm text-gray-500 mt-2 max-w-md">
          {error || "Cette boutique n'est pas encore configurée ou son nom de domaine est incorrect."}
        </p>
        <Link
          to="/"
          className="mt-6 px-6 py-2.5 bg-gray-900 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-black transition-colors"
        >
          Retour à l'accueil
        </Link>
      </div>
    );
  }

  const theme = themeFromStore(store);
  const headerBlocks = resolveBlocks(flatBlocks(store.globalSections?.header), theme);
  const footerBlocks = resolveBlocks(flatBlocks(store.globalSections?.footer), theme);

  return (
    <div
      className="min-h-screen bg-[#fafafa] flex flex-col text-gray-900 font-sans selection:bg-orange-500 selection:text-white"
      style={theme.font ? { fontFamily: `'${theme.font}', Inter, system-ui, sans-serif` } : undefined}
    >
      {/* Global store pixel tracking */}
      <StorePixelTracker />

      {/* A header built in Studio replaces the stock one. Theme tokens
          ($primary and friends) resolve against the store here, exactly as
          the compiler will resolve them. */}
      {headerBlocks.length ? <BlockRenderer blocks={headerBlocks as any} /> : <StoreHeader />}

      {/* Main Store Viewport */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Slide-out Cart Drawer */}
      <StoreCartDrawer />

      {/* WhatsApp Support Bubble */}
      <StoreWhatsAppButton />

      {/* Same for the footer. */}
      {footerBlocks.length ? <BlockRenderer blocks={footerBlocks as any} /> : <StoreFooter />}

      {/* Thumb navigation on phones. It floats over the page, so the footer
          gets matching padding below to keep its last row reachable. */}
      <StoreMobileBar />
      <div className="lg:hidden h-16" aria-hidden="true" />
    </div>
  );
}
