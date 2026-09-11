/**
 * Screenshot every shipped store theme, compiled exactly as the storefront
 * compiles it, for the gallery card.
 *
 *     npx tsx scripts/theme-thumbnails.ts            # all twelve
 *     npx tsx scripts/theme-thumbnails.ts novatrade  # one
 *
 * The cards used to show stock mockups of unrelated sites — a bank app, a
 * task manager, a real-estate listing — because those were the pictures the
 * design pack came with. A seller choosing a store template should see the
 * store. Each theme's home page is compiled with placeholder products through
 * `compileStoreDocument` (the same path the gallery preview and the storefront
 * take), rendered in headless Chrome at desktop width, and written to
 * frontend/public/images/themes/theme_<id>.jpg, which `previewImage` names.
 *
 * Needs Chrome on this machine and the API running on :3001, so the theme
 * photographs under /uploads resolve. Fonts come from Google Fonts.
 */
import 'dotenv/config';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { THEMES } from '../src/shared/templates/themes.js';
import { compileStoreDocument } from '../src/services/storeCompiler/index.js';

const ROOT = path.resolve(process.cwd());
const FRONTEND = path.resolve(ROOT, '..', 'frontend');
const OUT = path.join(FRONTEND, 'public', 'images', 'themes');
const API = process.env.THUMBNAIL_API_ORIGIN || 'http://localhost:3001';

const CHROME = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter((p): p is string => Boolean(p));

// The same placeholder products the gallery preview binds when a store has none.
const PRODUCTS = [
  { id: -1, ref: 'exemple-1', nameFr: 'Produit vedette', description: 'Un exemple de fiche. Vos propres produits apparaîtront ici dès que vous en aurez ajouté.', retailPriceMad: 349, stockQuantity: 12 },
  { id: -2, ref: 'exemple-2', nameFr: 'Best-seller de la semaine', description: 'Le produit que vos clients recommandent le plus.', retailPriceMad: 249, stockQuantity: 30 },
  { id: -3, ref: 'exemple-3', nameFr: 'Nouveauté', description: 'La dernière arrivée du catalogue.', retailPriceMad: 199, stockQuantity: 8 },
  { id: -4, ref: 'exemple-4', nameFr: 'Coffret découverte', description: 'Trois produits pour tester la gamme.', retailPriceMad: 499, stockQuantity: 5 },
  { id: -5, ref: 'exemple-5', nameFr: 'Édition limitée', description: 'Quantités limitées, prix bloqué.', retailPriceMad: 599, stockQuantity: 3 },
  { id: -6, ref: 'exemple-6', nameFr: 'L’essentiel', description: 'Le produit du quotidien, au bon prix.', retailPriceMad: 129, stockQuantity: 40 },
].map((p) => ({ ...p, sku: p.ref.toUpperCase(), images: [], categories: [{ nameFr: 'Exemple' }] }));

/** The store name where the theme left "MA BOUTIQUE", as the preview route does. */
function branded(doc: unknown, name: string): unknown {
  const copy = JSON.parse(JSON.stringify(doc));
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'block' && (node.block === 'site_header' || node.block === 'site_footer')) {
      node.props = node.props ?? {};
      if (!String(node.props.brandText ?? '').trim() || node.props.brandText === 'MA BOUTIQUE') node.props.brandText = name;
    }
    if (Array.isArray(node.children)) node.children.forEach(visit);
  };
  if (Array.isArray(copy?.root)) copy.root.forEach(visit);
  return copy;
}

async function main(): Promise<number> {
  const only = process.argv[2];
  const themes = THEMES.filter((t) => !only || t.id === only);
  if (!themes.length) {
    console.error(`unknown theme: ${only}`);
    return 2;
  }
  const executablePath = CHROME.find((p) => existsSync(p));
  if (!executablePath) {
    console.error('No Chrome binary found; set PUPPETEER_EXECUTABLE_PATH.');
    return 1;
  }
  const entry = path.join(FRONTEND, 'node_modules', 'puppeteer-core', 'lib', 'esm', 'puppeteer', 'puppeteer-core.js');
  const puppeteer = (await import(pathToFileURL(entry).href)).default;
  mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
  let failed = 0;
  try {
    for (const theme of themes) {
      const name = theme.label.fr;
      const out = await compileStoreDocument({
        store: { name, metaTitle: name, logoUrl: null, primaryColor: theme.palette.primary, secondaryColor: theme.palette.secondary, fontFamily: theme.fontFamily },
        user: { subdomain: null, pixels: [] },
        kind: 'home',
        page: theme.pages.home,
        header: branded(theme.pages.header, name),
        footer: branded(theme.pages.footer, name),
        path: '/',
        bindings: { product: PRODUCTS[0], collection: null, catalogue: async (o: { limit?: number }) => PRODUCTS.slice(0, o.limit ?? 24), storeId: 0 } as any,
      });
      if (!out) {
        console.error(`${theme.id}: compiler declined the page`);
        failed++;
        continue;
      }
      const html = out.html.replace('<head>', `<head><base href="${API}/">`);
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 1376, height: 860, deviceScaleFactor: 1 });
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
        await page.evaluate(() => (document as any).fonts?.ready);
        await new Promise((r) => setTimeout(r, 400));
        const file = path.join(OUT, `theme_${theme.id}.jpg`);
        await page.screenshot({ path: file, type: 'jpeg', quality: 84, clip: { x: 0, y: 0, width: 1376, height: 860 } });
        console.log(`${theme.id.padEnd(12)} → ${path.relative(ROOT, file)}`);
      } catch (err) {
        failed++;
        console.error(`${theme.id}: ${(err as Error).message}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  return failed ? 1 : 0;
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error(err);
  process.exit(1);
});
