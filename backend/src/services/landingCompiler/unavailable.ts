import type { Response } from 'express';

/**
 * The page a visitor gets when a link has nowhere it can legitimately be served.
 *
 * An influencer with neither a subdomain nor a custom domain has no host that
 * `validateInfluencerHost` will ever admit, so their landing page cannot be
 * shown anywhere — not compiled, and not by React either. Handing back the SPA
 * shell in that situation only looks like it works: the app boots, calls
 * `/public` for the link, is refused for the same host reason, and the visitor
 * watches a spinner resolve into an error. This says so directly instead.
 *
 * Deliberately says nothing about *why*. The visitor came from an ad and cannot
 * act on "the influencer never claimed a subdomain"; that detail belongs in the
 * dashboard, not on a page a stranger is looking at.
 *
 * Self-contained on purpose — no script, no external stylesheet, no font. It is
 * served to paid traffic on a page that is already failing, so it must not have
 * a way to fail further.
 */

const HTML =
  `<!doctype html>` +
  `<html lang="fr">` +
  `<head>` +
  `<meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<meta name="robots" content="noindex,nofollow">` +
  `<title>Lien indisponible</title>` +
  `<style>` +
  `*{box-sizing:border-box}` +
  `body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;` +
  `padding:24px;background:#f9fafb;color:#111827;` +
  `font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}` +
  `main{max-width:420px;text-align:center}` +
  `svg{width:56px;height:56px;color:#d1d5db;margin-bottom:20px}` +
  `h1{margin:0 0 10px;font-size:20px;line-height:1.3;font-weight:800}` +
  `p{margin:0;font-size:14px;line-height:1.6;color:#6b7280}` +
  `</style>` +
  `</head>` +
  `<body>` +
  `<main>` +
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">` +
  `<path stroke-linecap="round" stroke-linejoin="round" ` +
  `d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"/>` +
  `</svg>` +
  `<h1>Ce lien n'est pas disponible</h1>` +
  `<p>La page que vous cherchez n'est pas accessible pour le moment. ` +
  `Contactez la personne qui vous a partagé ce lien.</p>` +
  `</main>` +
  `</body>` +
  `</html>`;

/**
 * 404, and `no-store` above all.
 *
 * The condition behind this page is one field away from being fixed — the moment
 * a subdomain is assigned the link works — so nothing about this response may be
 * cached by a CDN or a browser and outlive the repair.
 */
export function serveLinkUnavailable(res: Response): void {
  // helmet's default CSP is `style-src 'self'`, which would drop the inline
  // stylesheet above and leave an unstyled page. This one is tighter than the
  // default in every other respect: no script, no frame, no network of any kind.
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"
  );
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(404).send(HTML);
}

/** Exposed so a test can assert on the markup without going through Express. */
export const LINK_UNAVAILABLE_HTML = HTML;
