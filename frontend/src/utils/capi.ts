/**
 * Browser-side companions for the Meta Conversions API.
 *
 * The backend re-reports conversions server-side (metaCapi.service.ts) and
 * needs three things only the browser has: the _fbp/_fbc cookies Meta's pixel
 * sets, and an event id shared with the local fbq call so Meta deduplicates
 * the browser/server pair instead of double-counting the order.
 *
 * Mirrors the compiled landing page's runtime (runtime/checkout.ts) — the two
 * checkout implementations must hand the server the same identifiers.
 */

export function readCookie(name: string): string | null {
  try {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

/**
 * The _fbc cookie, or one rebuilt from the fbclid query param exactly the way
 * the pixel would build it — the click id outlives a blocked or not-yet-run
 * fbevents.js.
 */
export function fbcValue(): string | null {
  const v = readCookie('_fbc');
  if (v) return v;
  try {
    const id = new URLSearchParams(window.location.search).get('fbclid');
    if (id) return `fb.1.${Date.now()}.${id}`;
  } catch {
    /* no usable click id */
  }
  return null;
}

/** One id per submit attempt, for fbq's eventID and the server event alike. */
export function makeCapiEventId(): string {
  try {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  } catch {
    /* fall through to the manual id */
  }
  return `ck.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 10)}`;
}
