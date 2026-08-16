import fs from 'fs';
import path from 'path';
import type { Response } from 'express';

/**
 * Serves the React application for a landing page the compiler did not produce.
 *
 * Every decline path ends here: SSG switched off, a block type not yet
 * supported, a compile error, an unknown code. The visitor gets exactly what
 * they get today, so a gap in compiler coverage is never a broken page.
 */

const DIST_DIR =
  process.env.FRONTEND_DIST_DIR ||
  // Relative to the process cwd, which pm2 sets to the backend root
  // (ecosystem.config.cjs). Deliberately not an absolute path: the checkout
  // lives at /var/www/openseller on the current server but /var/www/silacod
  // appears in older scripts, and hardcoding either one is how that
  // disagreement keeps causing bugs. Override with FRONTEND_DIST_DIR if the
  // frontend is ever deployed somewhere else entirely.
  path.resolve(process.cwd(), '..', 'frontend', 'dist');

/**
 * `spa.html` before `index.html`, and the order matters more than it looks.
 *
 * `scripts/prerender.mjs` overwrites `dist/index.html` with the rendered
 * marketing homepage — measured at 89 KB — and nginx's `try_files` fallback is
 * what hands that file to /r/:code today. The same script also writes a pristine
 * 7.8 KB shell to `dist/spa.html` for exactly this purpose, which nothing has
 * ever read. Preferring it makes even the fallback path an improvement.
 */
const CANDIDATES = ['spa.html', 'index.html'];

const RECHECK_MS = 30_000;

let cached: { html: string; source: string; mtimeMs: number } | null = null;
let lastCheck = 0;

function load(): { html: string; source: string } | null {
  const now = Date.now();

  if (cached && now - lastCheck < RECHECK_MS) {
    return { html: cached.html, source: cached.source };
  }

  for (const name of CANDIDATES) {
    const file = path.join(DIST_DIR, name);
    try {
      const stat = fs.statSync(file);
      if (cached && cached.source === file && cached.mtimeMs === stat.mtimeMs) {
        lastCheck = now;
        return { html: cached.html, source: cached.source };
      }
      const html = fs.readFileSync(file, 'utf8');
      cached = { html, source: file, mtimeMs: stat.mtimeMs };
      lastCheck = now;
      return { html, source: file };
    } catch {
      // try the next candidate
    }
  }

  lastCheck = now;
  return null;
}

export function serveSpaFallback(res: Response, status = 200): void {
  const shell = load();

  if (!shell) {
    console.error(
      `[SSG] no SPA shell found in ${DIST_DIR} — looked for ${CANDIDATES.join(', ')}. ` +
        'Set FRONTEND_DIST_DIR, or check that the frontend build succeeded.'
    );
    res.status(503).type('text/plain').send('Service temporarily unavailable');
    return;
  }

  // helmet applies its default CSP (script-src 'self') to everything Express
  // sends. Harmless while we only serve JSON, fatal for this shell: it would
  // block the inline __REFERRAL_PRELOAD__ script and connect.facebook.net, so
  // the fallback would render but fire no pixel. nginx serves it with no CSP
  // today, so removing the header restores current behaviour exactly.
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('Content-Security-Policy-Report-Only');
  res.setHeader('X-DNS-Prefetch-Control', 'on');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(shell.html);
}

/** Exposed for the health check, so a misconfigured dist path is visible before traffic finds it. */
export function spaFallbackStatus(): { dir: string; source: string | null } {
  const shell = load();
  return { dir: DIST_DIR, source: shell?.source ?? null };
}
