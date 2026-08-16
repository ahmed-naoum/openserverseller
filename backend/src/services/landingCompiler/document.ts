import { esc, safeColor, safeUrl } from './escape.js';
import { buildCss } from './styles.js';
import { renderHead, renderNoscriptPixels, selectActivePixels, buildCsp, ActivePixel } from './head.js';
import crypto from 'crypto';
import { rendererFor, supportedTypes } from './blocks/index.js';
import { probeImage, warmImageCache } from './media.js';
import type { BlockContext } from './blocks/types.js';

export interface RenderInput {
  code: string;
  blocks: any[];
  settings: any;
  landingPage: any;
  product: any;
  influencerPixels: any[];
  /** Used as the WhatsApp widget's default nickname and avatar. */
  influencerName?: string | null;
  influencerAvatar?: string | null;
  /** Host the page is served from, for canonical/OG URLs. Null when unknown. */
  origin: string | null;
}

function blockUrls(blocks: any[]): string[] {
  const urls: string[] = [];
  for (const block of blocks) {
    const url = block?.content?.url;
    if (typeof url === 'string' && url.startsWith('/uploads/')) urls.push(url);
  }
  return urls;
}

/**
 * The image most likely to be the largest element, for `<link rel=preload>`.
 *
 * Only the first few blocks are considered: an image below the fold is not the
 * LCP element, and preloading it would compete with the one that is. This
 * mirrors the heuristic the inline script in frontend/index.html already uses,
 * except we can resolve it at compile time rather than during parse.
 */
function findLcpImage(blocks: any[]): string | null {
  for (const block of blocks.slice(0, 3)) {
    if (block?.type !== 'image') continue;
    const url = safeUrl(block?.content?.url, { allowDataImage: true });
    if (url) return url;
  }
  return null;
}

/** Falls back through the fields most likely to carry something meaningful. */
function pageTitle(input: RenderInput): string {
  const explicit = String(input.landingPage?.title || '').trim();
  if (explicit) return explicit;

  const product = input.product;
  const name = String(product?.nameFr || product?.nameAr || product?.nameEn || '').trim();
  return name || 'Commander';
}

function pageDescription(input: RenderInput): string {
  const explicit = String(input.landingPage?.description || '').trim();
  if (explicit) return explicit;
  return String(input.product?.description || '').trim().slice(0, 300);
}

function primaryProductImage(product: any): string | null {
  const images = Array.isArray(product?.images) ? product.images : [];
  const primary = images.find((i: any) => i?.isPrimary) || images[0];
  const url = primary?.imageUrl;
  return typeof url === 'string' ? safeUrl(url) : null;
}

/**
 * The WhatsApp widget's content, or null when the page has no widget.
 *
 * Mirrors the precedence in ReferralForm.tsx:721-731 exactly, and the fallback
 * arm is the whole point: `enableWidget:false` on the block does NOT mean "no
 * widget", it means "not from the block" — a page whose settings still enable
 * one gets that one instead. It also covers the commoner shape, a page with
 * `settings.whatsappWidget` and no `whatsapp` block at all, which every v2
 * site-builder template produces (sitebuilder/v2/templates.ts). Those pages
 * already compiled before the renderer existed, so reading the block alone
 * would have kept serving them a page with the widget silently missing.
 */
function whatsappContent(input: RenderInput): any | null {
  const block = input.blocks.find((b) => b?.type === 'whatsapp');
  if (block && block?.content?.enableWidget !== false) return block.content || {};

  const fromSettings = input.settings?.whatsappWidget;
  return fromSettings?.enabled ? fromSettings : null;
}

/**
 * Assembles one landing page into a complete HTML document.
 *
 * Returns null when any block on the page has no renderer — a decline, not a
 * failure. The caller serves the React app instead, so partial coverage is
 * never a broken page.
 */
export interface RenderedPage {
  html: string;
  /** Policy for this specific page — see buildCsp. */
  csp: string;
}

export async function renderDocument(input: RenderInput): Promise<RenderedPage | null> {
  const supported = supportedTypes();
  const types = input.blocks.map((b) => b?.type).filter(Boolean) as string[];

  if (!types.length) return null;
  if (types.some((type) => !supported.has(type))) return null;

  // Dimensions are read once, up front, so renderers can stay synchronous.
  await warmImageCache(blockUrls(input.blocks));

  const pixels: ActivePixel[] = selectActivePixels(input.influencerPixels, input.code);

  const retail = Number(input.product?.retailPriceMad);
  const ctx: Omit<BlockContext, 'index'> = {
    total: input.blocks.length,
    code: input.code,
    productPriceMad: Number.isFinite(retail) ? retail : null,
    pixels,
    landingButtonText: input.landingPage?.buttonText || null,
    firstCheckoutIndex: input.blocks.findIndex((b) => b?.type === 'express_checkout'),
    influencerName: input.influencerName || null,
    influencerAvatar: input.influencerAvatar || null,
    probeImage,
  };

  const body = input.blocks
    .map((block, index) => {
      // The widget is a fixed overlay resolved below from the block OR from page
      // settings, and it contributes no layout, so it never renders in the flow.
      if (block?.type === 'whatsapp') return '';
      const renderer = rendererFor(block?.type);
      if (!renderer) return '';
      return renderer.render(block, { ...ctx, index });
    })
    .join('');

  const waContent = whatsappContent(input);
  const waRenderer = rendererFor('whatsapp');
  const overlay =
    waContent && waRenderer
      ? // index -1, the same "no position in the flow" convention as
        // firstCheckoutIndex: settings can supply a widget with no block behind it.
        waRenderer.render({ type: 'whatsapp', content: waContent }, { ...ctx, index: -1 })
      : '';

  // One stylesheet and one runtime per block TYPE, however many blocks of that
  // type the page has. A Set keyed on the string also collapses two renderers
  // that happen to share a sheet.
  const emitted = new Set(types);
  // The widget is the one renderer whose sheet is earned by output rather than
  // by a block being present: it can appear with no block, and a block can be
  // present and draw nothing (opted out, or no phone number). Charging a page
  // 4 KB of dead CSS for a widget it never shows is the wrong default.
  emitted.delete('whatsapp');
  if (overlay) emitted.add('whatsapp');

  const sheets = new Set<string>();
  const runtimes = new Set<string>();
  for (const type of emitted) {
    const renderer = rendererFor(type);
    if (renderer?.css) sheets.add(renderer.css);
    if (renderer?.runtime) runtimes.add(renderer.runtime);
  }

  const settings = input.settings || {};
  const themeColor = safeColor(input.landingPage?.themeColor, '#f97316');

  const css = buildCss(sheets, settings);
  const rtl = Boolean(settings?.rtl);

  const canonical = input.origin ? `${input.origin}/r/${encodeURIComponent(input.code)}` : null;

  const head = renderHead({
    title: pageTitle(input),
    description: pageDescription(input),
    lcpImage: findLcpImage(input.blocks),
    pixels,
    themeColor,
    css,
    rtl,
    canonical,
    ogImage: primaryProductImage(input.product),
  });

  const noscript = renderNoscriptPixels(pixels);
  const runtimeScript = [...runtimes].join('\n');

  const html =
    `<!doctype html>` +
    `<html lang="fr"${rtl ? ' dir="rtl"' : ''}>` +
    `<head>${head}</head>` +
    `<body>` +
    (noscript ? `<noscript>${noscript}</noscript>` : '') +
    `<div class="pg">${body}</div>` +
    // Outside the container on purpose: `.pg` is a max-width column, and a
    // `position:fixed` child of it would break the day that column gains a
    // transform, filter or contain.
    overlay +
    (runtimeScript ? `<script>${runtimeScript}</script>` : '') +
    `</body></html>`;

  // Inline scripts are allow-listed by hash rather than 'unsafe-inline', so a
  // payload that did escape into the document still could not execute. The hash
  // must cover the script body exactly as written into the HTML.
  const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const hashes = inlineScripts.map((src) =>
    crypto.createHash('sha256').update(src, 'utf8').digest('base64')
  );

  return { html, csp: buildCsp(pixels, hashes) };
}
