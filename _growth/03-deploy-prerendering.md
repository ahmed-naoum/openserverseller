# Deploying the prerendering — what the server needs

**Status:** built and verified locally, 10/10 routes. Two small server-side things are needed before it works in production.

---

## What changed and why

Measured on the live site, every public page returned an identical **3,487-byte shell** ending in `<div id="root"></div>` — to browsers and crawlers alike. Ten pages looked like one blank page to anything that doesn't execute JavaScript. Meanwhile Cloudflare's AI Crawl Control recorded **545 AI crawler requests in 24 hours** (up 64.7%), with Anthropic's crawler alone hitting 336 times. All of them arrived at that blank page.

`npm run build` now ends with a prerender step that loads each public route in headless Chrome and writes real HTML into `dist/`:

| Route | Before | After |
|---|---|---|
| `/` | 2.5 KB shell | **83.6 KB** (67.4 KB of content) |
| `/marketplace` | 2.5 KB shell | 46.2 KB |
| `/pricing` | 2.5 KB shell | 49.4 KB |
| `/about` | 2.5 KB shell | 44.7 KB |
| `/faq` | 2.5 KB shell | 53.4 KB |
| `/blog` | 2.5 KB shell | 47.1 KB |
| `/contact` | 2.5 KB shell | 46.1 KB |
| `/careers` | 2.5 KB shell | 47.2 KB |
| `/terms` | 2.5 KB shell | 68.9 KB |
| `/privacy` | 2.5 KB shell | 47.5 KB |

Each file now carries its own `<title>`, meta description, canonical, Open Graph tags and JSON-LD (`Organization`, `WebSite`, `WebPage`, `PostalAddress`) — all baked into the HTML, no JavaScript required.

Output layout:

```
dist/index.html            ← prerendered homepage
dist/pricing/index.html    ← prerendered
dist/about/index.html      ← prerendered
… one directory per public route
```

---

## SERVER TASK 1 — Install Chromium on the VPS

The prerenderer uses `puppeteer-core` with the **system** Chrome, so nothing large is downloaded during `npm install`. But the build machine needs a browser:

```bash
sudo apt-get update && sudo apt-get install -y chromium-browser
```

If your distro names it differently:

```bash
sudo apt-get install -y chromium
```

The script auto-detects `/usr/bin/chromium`, `/usr/bin/chromium-browser`, `/usr/bin/google-chrome` and a few others. To point it somewhere specific:

```bash
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

**If Chromium is missing the build still succeeds** — the script prints an install hint and exits cleanly, shipping client-rendered pages exactly as today. Prerendering is an enhancement, never a build blocker. So you can deploy first and add Chromium after.

## SERVER TASK 2 — Check the nginx `try_files` line

For `silacod.com/pricing` to serve `dist/pricing/index.html`, nginx must try the directory before falling back to the SPA entry point. Open your site config (likely `/etc/nginx/sites-available/silacod` or similar) and confirm the location block reads:

```nginx
location / {
    root /var/www/openseller/frontend/dist;
    try_files $uri $uri/ $uri/index.html /index.html;
}
```

The important part is **`$uri/index.html` before the final `/index.html`**. A common existing config is:

```nginx
try_files $uri $uri/ /index.html;      # works only if $uri/ resolves to index.html
```

That usually works too, because `$uri/` with `index index.html;` set serves the directory index. Verify with the curl test below rather than by reading the config — the test is definitive.

After editing:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## Deploy and verify

```bash
bash deploy.sh
```

Then run these from anywhere. **Test 2 is the one that matters.**

**1. Is your robots.txt live (not Cloudflare's)?**
```bash
curl -s https://silacod.com/robots.txt | head -3
```
Expect it to start with `# robots.txt — silacod.com`.

**2. Do crawlers get real content?**
```bash
curl -s -A "ClaudeBot/1.0" https://silacod.com/pricing | wc -c
```
- **~3,500** → nginx is still serving the SPA shell; fix `try_files` (Server task 2)
- **~49,000** → working ✅

**3. Does each page have its own title?**
```bash
for P in / /pricing /about /faq /blog; do curl -s -A "GPTBot/1.2" "https://silacod.com$P" | grep -o '<title>[^<]*</title>'; done
```
Expect five different titles. If all five are identical, prerendering did not run (check the deploy log for `[prerender]` lines).

**4. Is the sitemap real XML?**
```bash
curl -s https://silacod.com/sitemap.xml | head -3
```
Expect `<?xml version="1.0"` — not `<!DOCTYPE html>`.

**5. Is structured data present?**
```bash
curl -s -A "GPTBot/1.2" https://silacod.com/ | grep -c 'application/ld+json'
```
Expect at least 1. Then paste the homepage URL into Google's Rich Results Test to confirm the Organization entity parses.

---

## Notes

- **The catalogue in the sitemap.** `generate-sitemap.mjs` pulls products from the API at build time. Locally the backend isn't running, so it wrote 10 static URLs and warned. On the VPS the backend is restarted *before* the frontend build in `deploy.sh`, so products should be included automatically — check the `[sitemap] Wrote N URLs` line in the deploy output. If it says 0 products, the endpoint shape may have changed; send me the line and I'll adjust.
- **The PWA is untouched.** The service-worker registration is kept in every prerendered page. Crawlers don't run service workers, so they always read the prerendered HTML; a returning user with an active SW gets the cached shell and client-renders, exactly as today.
- **Adding a route later.** New public routes must be added in three places, all marked with cross-references: `ROUTES` in `scripts/prerender.mjs`, `STATIC_PAGES` in `scripts/generate-sitemap.mjs`, and `PAGE_PATHS` + `SEO` in `src/lib/seo/config.ts`.
- **Build time.** Prerendering adds roughly 30–60 seconds to the build. If that becomes a problem on the VPS, run `npm run build` without it via `tsc && npm run sitemap && vite build`.
