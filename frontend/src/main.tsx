import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { loadLanguage, initialLanguage } from './contexts/LanguageContext';
import './styles/globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const mount = () =>
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {/* Google Sign-In is mounted per-screen — see components/auth/GoogleAuthProvider. */}
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>
  );

/**
 * The offer pages carry their own copy — hardcoded Arabic and French, not a
 * single call into the translation system — so they load no dictionary at all.
 * They are the pages reached from paid ads, and they were paying for all three
 * languages.
 *
 * Everywhere else the active language is fetched before mounting. It is one
 * hashed, cacheable chunk, and waiting for it is what keeps the translate
 * function synchronous: mount first and every translated screen renders raw
 * keys for a frame before correcting itself. Marketing pages are prerendered,
 * so their real text is already on screen while this resolves.
 *
 * A failed load still mounts — loadLanguage never rejects, and the translate
 * function degrades to English and then to the key.
 */
if (window.location.pathname.startsWith('/r/')) {
  mount();
} else {
  loadLanguage(initialLanguage()).then(mount, mount);
}
