/**
 * Prerenders the public marketing routes into static HTML.
 *
 * WHY THIS EXISTS
 * ---------------
 * silacod.com is a client-rendered React SPA. Measured against the live site on
 * 3 Aug 2026, every public page returned an identical 3,487-byte shell ending in
 * `<div id="root"></div>` — for browsers and crawlers alike. Ten pages looked
 * like one blank page to anything that does not execute JavaScript, which
 * includes most AI crawlers. Cloudflare's own AI Crawl Control recorded 545 AI
 * crawler requests in 24 hours arriving at that blank page.
 *
 * HOW IT WORKS
 * ------------
 * After `vite build`, this script serves dist/ locally, loads each public route
 * in headless Chrome, waits for React to finish rendering, and writes the
 * resulting HTML to dist/<route>/index.html. nginx's usual
 * `try_files $uri $uri/ /index.html` then serves the static file to everyone;
 * React hydrates over it, so users see faster first paint and crawlers see real
 * content.
 *
 * CHROME REQUIREMENT
 * ------------------
 * Uses puppeteer-core with the system Chrome/Chromium (no bundled 180MB
 * download). If no browser is found the script logs how to install one and
 * exits 0 — the build succeeds and simply ships unprerendered, exactly as it
 * does today. Prerendering is an enhancement, never a build blocker.
 *
 *   Debian/Ubuntu VPS:  sudo apt-get install -y chromium-browser
 *   or set:             PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
 *
 * USAGE
 *   node scripts/prerender.mjs
 *   PRERENDER_API_TARGET=http://localhost:3001 node scripts/prerender.mjs
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { preview } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Mirrors build.outDir in vite.config.ts so deploy.sh can build into a staging
// directory and swap it in atomically.
const DIST = process.env.VITE_OUT_DIR
  ? path.resolve(ROOT, process.env.VITE_OUT_DIR)
  : path.join(ROOT, 'dist');
const PORT = Number(process.env.PRERENDER_PORT || 4173);

/**
 * Public routes to snapshot. Mirrors STATIC_PAGES in generate-sitemap.mjs and
 * PAGE_PATHS in src/lib/seo/config.ts — keep the three in step.
 *
 * Dashboards, auth flows and per-user pages are deliberately excluded: they
 * require a session, have no search value, and are blocked in robots.txt.
 */
const ROUTES = [
  '/',
  '/marketplace',
  '/pricing',
  '/about',
  '/faq',
  '/blog',
  '/contact',
  '/careers',
  '/terms',
  '/privacy',
];

/**
 * Language the prerendered HTML is captured in.
 *
 * LanguageContext resolves: user profile -> localStorage -> navigator.language
 * -> 'ar'. A headless browser has no profile and no localStorage, so we seed
 * localStorage before load to pin the output. French is the default because
 * index.html declares lang="fr" and the meta description is French; once
 * language-prefixed routes ship (task C5), this becomes a per-prefix loop.
 */
const PRERENDER_LANG = process.env.PRERENDER_LANG || 'fr';

/** Common Chrome/Chromium locations across Windows, macOS and Linux. */
const CHROME_PATHS = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/snap/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

function findChrome() {
  return CHROME_PATHS.find((p) => {
    try {
      return existsSync(p);
    } catch {
      return false;
    }
  });
}

function skip(reason) {
  console.warn(`\n[prerender] SKIPPED — ${reason}`);
  console.warn('[prerender] The build is fine; pages ship client-rendered as before.');
  console.warn('[prerender] To enable on this machine:');
  console.warn('[prerender]   sudo apt-get install -y chromium-browser');
  console.warn('[prerender]   (or set PUPPETEER_EXECUTABLE_PATH to a Chrome binary)\n');
  process.exit(0);
}

/** Route path -> output file inside dist/. */
function outputPath(route) {
  return route === '/'
    ? path.join(DIST, 'index.html')
    : path.join(DIST, route.replace(/^\//, ''), 'index.html');
}

async function main() {
  if (!existsSync(DIST)) skip('dist/ not found — run `vite build` first');

  /**
   * A pristine copy of the built shell, for nginx to use as the SPA fallback.
   *
   * The homepage snapshot is written over dist/index.html, and that same file is
   * what `try_files $uri $uri/ /index.html` hands to every route without a
   * static file of its own. So a customer opening /r/<code> was served ~87 KB of
   * homepage markup — nav, hero, the whole footer — which React then threw away
   * and replaced with the offer. Pointing the fallback at this ~4 KB shell
   * instead removes that from the critical path.
   *
   * Copied here, before anything else can fail: `skip()` below exits 0 when no
   * Chrome is present, and nginx must never be left pointing at a file that a
   * skipped prerender never produced.
   *
   * Guarded on the source still being a shell, because this script is runnable
   * on its own (`npm run prerender`). On a second run without a rebuild,
   * dist/index.html is already the homepage snapshot, and copying that would
   * quietly turn the fallback into the very 87 KB page this exists to avoid.
   * An unrendered shell is recognisable by its size.
   */
  const shellPath = path.join(DIST, 'index.html');
  const spaPath = path.join(DIST, 'spa.html');
  const shellHtml = await readFile(shellPath, 'utf8');

  /**
   * Structural, not textual.
   *
   * Testing for a literal `<div id="root"></div>` meant that putting a loading
   * skeleton inside #root — or adding an attribute, or switching to single
   * quotes — would silently drop through to the warn-and-continue branch below
   * and ship a build with no SPA fallback. That is a plausible next edit on a
   * page being tuned for LCP, and it would look harmless in review.
   *
   * The `else if` backstop cannot save it either: deploy.sh wipes the staging
   * directory before every build, so a previous spa.html never exists there.
   *
   * Size is the honest discriminator. The built shell is ~5 KB; a prerendered
   * snapshot is ~90 KB. The threshold sits four times above one and four times
   * below the other, and if the shell ever genuinely outgrows it the failure is
   * loud rather than silent.
   */
  const SHELL_MAX_BYTES = 20_000;

  if (shellHtml.length < SHELL_MAX_BYTES) {
    await copyFile(shellPath, spaPath);
    console.log('[prerender] Saved unrendered shell to dist/spa.html (SPA fallback)');
  } else if (existsSync(spaPath)) {
    console.log('[prerender] index.html is already prerendered — keeping the existing spa.html');
  } else {
    console.warn('[prerender] WARNING: index.html is already prerendered and there is no spa.html.');
    console.warn('[prerender] Run `vite build` before prerendering, or nginx falls back to the homepage snapshot.');
  }

  const executablePath = findChrome();
  if (!executablePath) skip('no Chrome/Chromium binary found');
  console.log(`[prerender] Using browser: ${executablePath}`);

  let puppeteer;
  try {
    puppeteer = (await import('puppeteer-core')).default;
  } catch {
    skip('puppeteer-core is not installed (npm i -D puppeteer-core)');
  }

  // Serve the freshly built dist/ exactly as production would.
  const server = await preview({
    root: ROOT,
    preview: { port: PORT, strictPort: true, open: false },
  });
  const base = `http://localhost:${PORT}`;
  console.log(`[prerender] Serving dist/ at ${base}`);

  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const results = [];
  // Measured from spa.html, not index.html: the loop below overwrites
  // index.html with the homepage snapshot, so on a standalone re-run this
  // reported the previous run's ~90 KB page as "the shell" — the very number
  // the spa.html copy exists to shrink. spa.html is the only copy of the shell
  // that survives a prerender. The fallback covers the branch that warns above,
  // where there is no shell left on disk to measure.
  const shellSize = existsSync(spaPath)
    ? (await readFile(spaPath, 'utf8')).length
    : shellHtml.length;

  try {
    for (const route of ROUTES) {
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 1280, height: 900 });

        // Block anything that never settles or that we do not want baked into a
        // static snapshot. Without this, `networkidle` never fires: SocketContext
        // opens a socket.io connection that stays open by design.
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          const url = req.url();
          const blocked =
            url.includes('socket.io') ||
            url.includes('challenges.cloudflare.com') ||
            url.includes('fonts.googleapis.com') ||
            url.includes('fonts.gstatic.com') ||
            url.includes('google-analytics') ||
            url.includes('googletagmanager') ||
            // Google Sign-In appends its own <script> tag on mount, and the
            // snapshot below is taken after React has run — so without this the
            // tag was serialised into the static HTML and the browser fetched
            // GSI twice: once from the parsed snapshot, once when the provider
            // re-injected it on hydration.
            url.includes('accounts.google.com') ||
            ['media', 'font', 'websocket'].includes(req.resourceType());
          if (blocked) req.abort().catch(() => {});
          else req.continue().catch(() => {});
        });

        // Pin the language before any app code runs.
        await page.evaluateOnNewDocument((lang) => {
          try {
            localStorage.setItem('guest_lang', lang);
          } catch {
            /* storage unavailable — the context default still applies */
          }
        }, PRERENDER_LANG);

        // domcontentloaded, not networkidle: the app keeps long-lived
        // connections open, so "idle" is never reached. Readiness is decided by
        // the #root check below instead.
        await page.goto(`${base}${route}`, {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        });

        // Wait for React to actually paint something into #root.
        await page
          .waitForFunction(
            () => {
              const root = document.getElementById('root');
              return root && root.innerHTML.length > 1000;
            },
            { timeout: 20_000 },
          )
          .catch(() => {
            console.warn(`[prerender] ${route}: #root stayed small; capturing anyway`);
          });

        // Wait for the <Seo> component to have written its tags. Waiting on a
        // fixed timer instead raced: a page could be captured with the generic
        // index.html title still in place. The canonical link is only ever added
        // by Seo.tsx, so its presence is a deterministic ready signal.
        await page
          .waitForFunction(
            () => !!document.querySelector('link[rel="canonical"][data-seo-managed]'),
            { timeout: 15_000, polling: 100 },
          )
          .catch(() => {
            console.warn(`[prerender] ${route}: no <Seo> tags detected — page may lack SEO metadata`);
          });

        // Let remaining effects and animations settle.
        await new Promise((r) => setTimeout(r, 800));

        // The service-worker registration is deliberately kept in the snapshot.
        // Removing it would disable the PWA for anyone landing on a marketing
        // page, and it costs nothing here: crawlers do not run service workers,
        // so they always read the prerendered HTML. A returning user with an
        // active SW gets the cached shell and client-renders — exactly today's
        // behaviour, so this is an improvement for everyone and a regression for
        // no one.
        // Aborting the request above stops the download but leaves the element
        // behind, and a browser parsing the snapshot would fetch it for real.
        // Google Sign-In is the only injector that reaches the prerendered
        // routes, and none of them offer a Google button, so the tag is dropped
        // outright rather than shipped for the client to re-request.
        const html = (await page.content()).replace(
          /<script[^>]*accounts\.google\.com[^>]*><\/script>/gi,
          ''
        );
        const outPath = outputPath(route);
        await mkdir(path.dirname(outPath), { recursive: true });
        await writeFile(outPath, html, 'utf8');

        const title = await page.title();

        // Judge success from the page itself rather than by comparing against
        // dist/index.html: prerendering overwrites that file, so on a re-run
        // without a rebuild the "shell" baseline is a previously prerendered
        // page and every route looks thin.
        const { rootChars, hasSeo } = await page.evaluate(() => ({
          rootChars: document.getElementById('root')?.innerHTML.length ?? 0,
          hasSeo: !!document.querySelector('link[rel="canonical"][data-seo-managed]'),
        }));

        results.push({
          route,
          bytes: html.length,
          title,
          rootChars,
          hasSeo,
          ok: rootChars > 5000 && hasSeo,
        });
      } catch (err) {
        console.warn(`[prerender] ${route}: FAILED — ${err.message}`);
        results.push({ route, bytes: 0, title: '', ok: false });
      } finally {
        await page.close();
      }
    }
  } finally {
    // Windows sometimes holds a lock on the Chrome profile during teardown
    // (EBUSY on CrashpadMetrics). Harmless — never let it mask the results.
    await browser.close().catch(() => {});
    await server.close().catch(() => {});
  }

  console.log('\n[prerender] Results');
  console.log('[prerender] ' + '-'.repeat(78));
  console.log(
    `[prerender] ${'STATUS'.padEnd(6)} ${'ROUTE'.padEnd(14)} ${'HTML'.padStart(9)} ${'CONTENT'.padStart(9)}  TITLE`,
  );
  for (const r of results) {
    const flag = r.ok ? 'OK    ' : r.hasSeo ? 'THIN  ' : 'NO-SEO';
    const kb = `${(r.bytes / 1024).toFixed(1)} KB`.padStart(9);
    const rc = `${(r.rootChars / 1024).toFixed(1)} KB`.padStart(9);
    console.log(
      `[prerender] ${flag} ${r.route.padEnd(14)} ${kb} ${rc}  ${r.title.slice(0, 38)}`,
    );
  }
  const good = results.filter((r) => r.ok).length;
  console.log('[prerender] ' + '-'.repeat(78));
  console.log(
    `[prerender] ${good}/${results.length} routes prerendered with content + SEO tags ` +
      `(unrendered shell is ~${(shellSize / 1024).toFixed(1)} KB)\n`,
  );

  if (good === 0) {
    console.warn('[prerender] No route produced content — shipping client-rendered.');
  }
}

main().catch((err) => {
  // Never fail the build over prerendering.
  console.error('[prerender] Error:', err.message);
  process.exit(0);
});
