import { ReactNode } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';

/**
 * Scopes Google Sign-In to the two screens that actually offer it.
 *
 * Mounting `GoogleOAuthProvider` is what appends Google's GSI script (~96 KB),
 * and it does so unconditionally. Wrapped around the whole app in main.tsx it
 * therefore loaded on every route — including the public offer pages, which have
 * no Google button and no login at all.
 *
 * It was also loading *twice*: the prerenderer snapshots the DOM after React has
 * mounted, so the injected tag was baked into the static HTML, and the provider
 * then appended a second copy on hydration. The prerender blocklist now strips
 * `accounts.google.com` as well, which fixes that half.
 */
export default function GoogleAuthProvider({ children }: { children: ReactNode }) {
  return (
    <GoogleOAuthProvider
      clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your_google_client_id_here'}
    >
      {children}
    </GoogleOAuthProvider>
  );
}
