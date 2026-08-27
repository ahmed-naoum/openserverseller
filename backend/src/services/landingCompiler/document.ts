import { esc, safeColor, safeUrl, num } from './escape.js';
import { buildSrcset, sizesFor } from './blocks/image.js';
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
function findLcpImage(blocks: any[]): { url: string; content: any } | null {
  for (const block of blocks.slice(0, 3)) {
    if (block?.type !== 'image') continue;
    const url = safeUrl(block?.content?.url, { allowDataImage: true });
    if (url) return { url, content: block?.content || {} };
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

/**
 * Content-protection runtime for the compiled page.
 *
 * The React page runs the equivalent from ReferralForm; the compiled page ships
 * no React, so its guards are emitted here instead. Returns '' when neither flag
 * is set. The output is appended to the single hashed <script>, so it is covered
 * by the page CSP — an inline `oncontextmenu` attribute would not be.
 *
 * This raises the effort of casual copy/save; it is not real protection. A
 * determined visitor disables JavaScript, opens DevTools before load, or screen-
 * records, and none of that is stopped here.
 */
function cloakGuardScript(cloaking: any): string {
  if (!cloaking) return '';
  const parts: string[] = [];

  if (cloaking.disableRightClick) {
    parts.push(
      // 1. Context Menu & Keyboard Protection
      `d.addEventListener('contextmenu',function(e){e.preventDefault();},true);` +
      `d.addEventListener('keydown',function(e){` +
      `var k=(e.key||'').toLowerCase(),code=e.keyCode||e.which;` +
      `if(code===123||k==='f12'){e.preventDefault();e.stopPropagation();return false;}` +
      `if((e.ctrlKey||e.metaKey)&&(e.shiftKey||e.altKey)&&(k==='i'||k==='j'||k==='c')){e.preventDefault();e.stopPropagation();return false;}` +
      `if((e.ctrlKey||e.metaKey)&&(k==='u'||k==='s')){e.preventDefault();e.stopPropagation();return false;}` +
      `},true);` +

      // 2. DevTools Redirect Trap (Console Getter + Debugger Timing + Resize Probe)
      `var doRedirect=function(){try{window.location.replace('https://www.silacod.com');}catch(_){d.body.innerHTML='';}};` +
      `var dtImg=new Image();` +
      `Object.defineProperty(dtImg,'id',{get:function(){doRedirect();}});` +
      `var dtCheck=function(){` +
      `try{console.log('%c',dtImg);}catch(_){}` +
      `var start=performance.now();` +
      `(function(){}).constructor('debugger')();` +
      `var diff=performance.now()-start;` +
      `var devOpen=(diff>50)||(window.outerWidth-window.innerWidth>160)||(window.outerHeight-window.innerHeight>160);` +
      `if(devOpen){doRedirect();}` +
      `};` +
      `setInterval(dtCheck,800);` +
      `window.addEventListener('resize',dtCheck,true);`
    );
  }

  if (cloaking.protectVideos) {
    parts.push(
      // 1. Convert raw video sources to Blob URLs so real URLs are completely hidden from HTML DOM
      `var convertBlob=function(v){` +
      `var raw=v.getAttribute('data-vsrc')||v.getAttribute('src');` +
      `if(!raw||raw.indexOf('blob:')===0)return;` +
      `v.removeAttribute('data-vsrc');` +
      `fetch(raw).then(function(r){return r.blob();}).then(function(b){` +
      `var bUrl=URL.createObjectURL(b);` +
      `v.src=bUrl;` +
      `}).catch(function(){});` +
      `};` +

      // 2. Anti-Screen Sharing & Anti-Stream Blackout Guard
      `var handleStreamGuard=function(){` +
      `var isHidden=d.hidden||!d.hasFocus();` +
      `var vs=d.getElementsByTagName('video');` +
      `for(var i=0;i<vs.length;i++){` +
      `var v=vs[i];var p=v.parentElement;if(!p)continue;` +
      `var ov=p.querySelector('.vid-stream-guard');` +
      `if(!ov){` +
      `ov=d.createElement('div');ov.className='vid-stream-guard';` +
      `ov.style.cssText='position:absolute;top:0;left:0;width:100%;height:100%;background:#000;color:#fff;display:none;align-items:center;justify-content:center;font-family:sans-serif;font-size:14px;font-weight:bold;z-index:9999;pointer-events:none;text-align:center;padding:20px;box-sizing:border-box;';` +
      `ov.innerHTML='🔒 Content Protected<br><span style="font-size:11px;opacity:0.75">Screen Capture & Streaming Blocked</span>';` +
      `if(getComputedStyle(p).position==='static')p.style.position='relative';` +
      `p.appendChild(ov);` +
      `}` +
      `if(isHidden){try{v.pause();}catch(_){}ov.style.display='flex';}else{ov.style.display='none';}` +
      `}` +
      `};` +
      `window.addEventListener('blur',handleStreamGuard,true);` +
      `window.addEventListener('focus',handleStreamGuard,true);` +
      `d.addEventListener('visibilitychange',handleStreamGuard,true);` +

      // 3. Apply Video Attributes & MutationObserver
      `var pv=function(){` +
      `var vs=d.getElementsByTagName('video');` +
      `for(var i=0;i<vs.length;i++){` +
      `var v=vs[i];` +
      `try{v.setAttribute('controlsList','nodownload');v.disablePictureInPicture=true;v.setAttribute('ondragstart','return false;');}catch(_){}` +
      `v.addEventListener('contextmenu',function(e){e.preventDefault();e.stopPropagation();},true);` +
      `convertBlob(v);` +
      `}` +
      `handleStreamGuard();` +
      `};` +
      `pv();if(window.MutationObserver){new MutationObserver(pv).observe(d.documentElement,{childList:true,subtree:true});}`
    );
  }

  if (!parts.length) return '';
  return `(function(){var d=document;${parts.join('')}})();`;
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
  const pageMaxWidth = num(input.settings?.maxWidth, 640, 280, 1600);
  const ctx: Omit<BlockContext, 'index'> = {
    total: input.blocks.length,
    pageMaxWidth,
    code: input.code,
    productPriceMad: Number.isFinite(retail) ? retail : null,
    pixels,
    landingButtonText: input.landingPage?.buttonText || null,
    firstCheckoutIndex: input.blocks.findIndex((b) => b?.type === 'express_checkout'),
    influencerName: input.influencerName || null,
    influencerAvatar: input.influencerAvatar || null,
    probeImage,
    protectVideos: Boolean(input.settings?.cloaking?.protectVideos),
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

  // The preload must advertise exactly the candidates the <img> will, or the
  // browser resolves the two independently and fetches two different files.
  const lcp = findLcpImage(input.blocks);
  const lcpSrcset = lcp ? buildSrcset(lcp.url, probeImage(lcp.url)) : '';

  const head = renderHead({
    title: pageTitle(input),
    description: pageDescription(input),
    lcpImage: lcp?.url ?? null,
    lcpImageSrcset: lcpSrcset || null,
    lcpImageSizes: lcpSrcset ? sizesFor({ ...ctx, index: 0 }, lcp!.content) : null,
    pixels,
    themeColor,
    css,
    rtl,
    canonical,
    ogImage: primaryProductImage(input.product),
  });

  const noscript = renderNoscriptPixels(pixels);
  // The content-protection guard rides in the same hashed <script> as the block
  // runtimes, so it needs no separate CSP hash.
  const guard = cloakGuardScript(settings?.cloaking);
  const runtimeScript = [[...runtimes].join('\n'), guard].filter(Boolean).join('\n');

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
