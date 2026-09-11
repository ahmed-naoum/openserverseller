import { esc, safeUrl, safeColor, num, oneOf } from '../escape.js';
import { SITE_HEADER_RUNTIME } from '../runtime/siteHeader.js';
import type { BlockRenderer, BlockContext } from './types.js';

/**
 * The page's own header: announcement strip, logo, navigation, call to action.
 *
 * It exists as a BLOCK rather than as chrome the storefront wraps around the
 * page, and that is the whole point of it. A landing page served on a seller's
 * domain used to be rendered inside the React storefront layout, so its header
 * and footer arrived as part of the single-page app: a framework boot, a store
 * resolve request and a paint, all ahead of the first pixel of a page the
 * compiler had already turned into static HTML. The bar at the top was the
 * slowest thing on the fastest page in the product.
 *
 * As a block it compiles with everything else — same HTML, same brotli, same
 * content policy, no JavaScript on the critical path — and the seller edits it
 * in the builder beside the rest of the page instead of in a settings screen
 * somewhere else.
 *
 * Only the mobile menu needs script, and only after a tap.
 */

const CART_SVG =
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
  `<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>` +
  `<path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`;

const SEARCH_SVG =
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
  `<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`;

const ACCOUNT_SVG =
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
  `<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`;

const BURGER_SVG =
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
  `stroke-linecap="round" aria-hidden="true">` +
  `<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>`;

const CLOSE_SVG =
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
  `stroke-linecap="round" aria-hidden="true">` +
  `<path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

/** At most this many navigation entries survive; the rest are dropped. */
const MAX_LINKS = 8;

interface NavLink {
  label: string;
  url: string;
}

/**
 * `#anchor` stays an anchor, everything else goes through the URL allow-list.
 * A link that survives neither is dropped rather than rendered dead — the same
 * rule the button and products blocks apply.
 */
function navLinks(raw: unknown): NavLink[] {
  if (!Array.isArray(raw)) return [];
  const out: NavLink[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const label = String((entry as any).label ?? '').trim().slice(0, 60);
    if (!label) continue;

    // `#anchor` is the one shape safeUrl does not answer for: it returns ''
    // for a bare fragment. Root-relative paths (/products, /cart) and absolute
    // http(s) URLs it handles, so everything else defers to it.
    const rawUrl = String((entry as any).url ?? '').trim();
    const url = rawUrl.startsWith('#')
      ? (/^#[A-Za-z0-9_-]+$/.test(rawUrl) ? rawUrl : '')
      : safeUrl(rawUrl);

    if (!url) continue;
    out.push({ label, url });
    if (out.length >= MAX_LINKS) break;
  }

  return out;
}

export const siteHeaderBlock: BlockRenderer = {
  type: 'site_header',

  css:
    `.bk-sh{width:100%;z-index:50}` +
    `.bk-sh.st{position:sticky;top:0}` +
    `.bk-sh-an{width:100%;text-align:center;font-size:12px;font-weight:700;` +
    `padding:8px 16px;letter-spacing:.01em}` +
    `.bk-sh-bar{display:flex;align-items:center;gap:16px;` +
    `padding:12px 16px;max-width:1152px;margin:0 auto}` +
    `.bk-sh-brand{display:flex;align-items:center;gap:10px;text-decoration:none;` +
    `font-weight:900;font-size:18px;letter-spacing:-.02em;flex:none}` +
    `.bk-sh-brand img{display:block;width:auto;object-fit:contain}` +
    `.bk-sh-nav{display:none;align-items:center;gap:26px;flex:1 1 auto;justify-content:center}` +
    `.bk-sh-nav a{text-decoration:none;font-size:14px;font-weight:600;opacity:.85}` +
    `.bk-sh-nav a:hover{opacity:1}` +
    `.bk-sh-act{display:flex;align-items:center;gap:10px;margin-left:auto;flex:none}` +
    `.bk-sh-cart{display:inline-flex;align-items:center;justify-content:center;` +
    `width:40px;height:40px;border-radius:12px;text-decoration:none}` +
    `.bk-sh-cart svg{width:20px;height:20px;display:block}` +
    `.bk-sh-cta{display:inline-flex;align-items:center;justify-content:center;` +
    `padding:10px 18px;border-radius:12px;font-size:13px;font-weight:800;` +
    `text-decoration:none;border:0;font-family:inherit;cursor:pointer}` +
    `.bk-sh-bt{display:inline-flex;align-items:center;justify-content:center;` +
    `width:40px;height:40px;border-radius:12px;background:none;border:0;padding:0;` +
    `cursor:pointer;color:inherit}` +
    `.bk-sh-bt svg{width:22px;height:22px;display:block}` +
    `.bk-sh-bt .x{display:none}` +
    `.bk-sh[data-open="1"] .bk-sh-bt .x{display:block}` +
    `.bk-sh[data-open="1"] .bk-sh-bt .m{display:none}` +
    // The mobile panel is height-collapsed rather than display:none so the tap
    // animates; `visibility` keeps it out of the tab order while closed.
    `.bk-sh-mob{overflow:hidden;max-height:0;visibility:hidden;` +
    `transition:max-height .25s ease,visibility 0s linear .25s}` +
    `.bk-sh[data-open="1"] .bk-sh-mob{max-height:70vh;visibility:visible;transition-delay:0s}` +
    `.bk-sh-mob ul{list-style:none;margin:0;padding:8px 16px 16px;` +
    `display:flex;flex-direction:column;gap:2px}` +
    `.bk-sh-mob a{display:block;padding:12px 4px;text-decoration:none;` +
    `font-size:15px;font-weight:700}` +
    `@media(min-width:768px){` +
    `.bk-sh-nav{display:flex}` +
    `.bk-sh-bt{display:none}` +
    `.bk-sh-mob{display:none}` +
    `.bk-sh-bar{padding:14px 24px}}` +
    `@media(prefers-reduced-motion:reduce){.bk-sh-mob{transition:none}}` +
    // Laid over the band below it: no surface of its own, and never sticky.
    `.bk-sh.ov{position:absolute;top:0;left:0;right:0;z-index:40;background:transparent!important;border-bottom-color:transparent!important}` +
    // Uppercase, tracked links for the luxury and editorial looks.
    `.bk-sh.uc .bk-sh-nav a{text-transform:uppercase;letter-spacing:.1em;font-size:12px}` +
    // Brand in the middle: links left, actions right, the brand centred between.
    `@media(min-width:1024px){.bk-sh.bc .bk-sh-bar{display:grid;grid-template-columns:1fr auto 1fr;align-items:center}` +
    `.bk-sh.bc .bk-sh-nav{order:1;justify-self:start;margin:0}.bk-sh.bc .bk-sh-brand{order:2;justify-self:center}.bk-sh.bc .bk-sh-act{order:3;justify-self:end}}` +
    `.bk-sh-cta2{display:inline-flex;align-items:center;justify-content:center;padding:9px 16px;border-radius:999px;` +
    `border:1.5px solid currentColor;font-size:13px;font-weight:700;text-decoration:none;white-space:nowrap}` +
    // On a phone the bar keeps the brand, the cart, the main button and the
    // burger; the second button and the extra icons wait for a wider screen,
    // and a long brand name is clipped rather than pushing the buttons out.
    `@media(max-width:639px){.bk-sh-cta2,.bk-sh-ic{display:none}` +
    `.bk-sh-brand span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:38vw}` +
    `.bk-sh-cta{white-space:nowrap;padding-left:12px;padding-right:12px;max-width:34vw;overflow:hidden;text-overflow:ellipsis}}`,

  runtime: SITE_HEADER_RUNTIME,

  render(block: any, ctx: BlockContext): string {
    const c = block?.content || {};

    const bg = safeColor(c.bgColor, '#ffffff');
    const fg = safeColor(c.textColor, '#0f172a');
    const border = safeColor(c.borderColor, '#e2e8f0');
    const sticky = c.sticky !== false;

    const links = navLinks(c.links);
    const logoUrl = safeUrl(c.logoUrl);
    const logoHeight = num(c.logoHeight, 36, 16, 96);
    const brandText = String(c.brandText ?? '').trim().slice(0, 60);
    const homeUrl = links.length ? '/' : '#';

    // ── announcement strip ────────────────────────────────────────────────
    const annText = String(c.announcementText ?? '').trim().slice(0, 160);
    const announcement =
      c.announcementActive !== false && annText
        ? `<div class="bk-sh-an" style="background:${safeColor(c.announcementBg, '#0f172a')};` +
          `color:${safeColor(c.announcementColor, '#ffffff')}">${esc(annText)}</div>`
        : '';

    // ── brand ─────────────────────────────────────────────────────────────
    const dims = logoUrl ? ctx.probeImage(logoUrl) : null;
    // Width comes from the file's own aspect ratio when we know it. Without both
    // attributes the logo has no reserved box and the whole bar jumps when it
    // decodes — the one layout shift a header can least afford.
    const logoWidth =
      dims && dims.height > 0 ? Math.round((dims.width / dims.height) * logoHeight) : 0;
    const logoImg = logoUrl
      ? `<img src="${esc(logoUrl)}" alt="${esc(brandText || 'Logo')}" ` +
        `style="height:${logoHeight}px"` +
        (logoWidth ? ` width="${logoWidth}" height="${logoHeight}"` : '') +
        // The header is above the fold by definition, so its logo is never lazy.
        ` decoding="async">`
      : '';
    const brand =
      logoImg || brandText
        ? `<a class="bk-sh-brand" href="${esc(homeUrl)}" style="color:${fg}">` +
          logoImg +
          (brandText ? `<span>${esc(brandText)}</span>` : '') +
          `</a>`
        : '';

    // ── navigation ────────────────────────────────────────────────────────
    const desktopNav = links.length
      ? `<nav class="bk-sh-nav">` +
        links.map((l) => `<a href="${esc(l.url)}" style="color:${fg}">${esc(l.label)}</a>`).join('') +
        `</nav>`
      : '';

    const mobileNav = links.length
      ? `<div class="bk-sh-mob" id="shm-${ctx.index}"><ul>` +
        links
          .map(
            (l) =>
              `<li><a href="${esc(l.url)}" style="color:${fg};` +
              `border-bottom:1px solid ${border}">${esc(l.label)}</a></li>`
          )
          .join('') +
        `</ul></div>`
      : '';

    const burger = links.length
      ? `<button class="bk-sh-bt" type="button" data-sh-toggle aria-expanded="false" ` +
        `aria-controls="shm-${ctx.index}" aria-label="Menu">` +
        `<span class="m">${BURGER_SVG}</span><span class="x">${CLOSE_SVG}</span></button>`
      : '';

    // ── actions ───────────────────────────────────────────────────────────
    const cartUrl = c.cartUrl ? safeUrl(c.cartUrl) : '/cart';
    const cart =
      c.showCart !== false
        ? `<a class="bk-sh-cart" href="${esc(cartUrl || '/cart')}" aria-label="Panier" ` +
          `style="color:${fg};background:${safeColor(c.cartBg, 'transparent')}">${CART_SVG}</a>`
        : '';

    const ctaText = String(c.ctaText ?? '').trim().slice(0, 40);
    // An empty destination means "scroll to the order form", which is what a
    // header call to action almost always means on a landing page. The anchor
    // only exists when the page actually has a checkout on it.
    const ctaHref =
      String(c.ctaUrl ?? '').trim()
        ? safeUrl(c.ctaUrl)
        : ctx.firstCheckoutIndex >= 0
        ? '#express-checkout-block'
        : '';
    const ctaRadius = c.ctaRadius !== undefined && c.ctaRadius !== null && c.ctaRadius !== '' ? `border-radius:${num(c.ctaRadius, 12, 0, 999)}px;` : '';
    const cta =
      ctaText && ctaHref
        ? `<a class="bk-sh-cta" href="${esc(ctaHref)}" ` +
          `style="background:${safeColor(c.ctaBg, '#ea580c')};${ctaRadius}` +
          `color:${safeColor(c.ctaColor, '#ffffff')}">${esc(ctaText)}</a>`
        : '';

    const secondaryText = String(c.secondaryText ?? '').trim().slice(0, 40);
    const secondaryHref = secondaryText ? safeUrl(c.secondaryUrl || '/products') : '';
    const secondary =
      secondaryText && secondaryHref
        ? `<a class="bk-sh-cta2" href="${esc(secondaryHref)}" style="color:${fg}">${esc(secondaryText)}</a>`
        : '';

    // Two more icons of the reference designs, drawn like the cart: a search
    // that opens the catalogue, an account that opens order tracking.
    const iconStyle = `color:${fg};background:${safeColor(c.cartBg, 'transparent')}`;
    const search = c.showSearch === true ? `<a class="bk-sh-cart bk-sh-ic" href="/products" aria-label="Rechercher" style="${iconStyle}">${SEARCH_SVG}</a>` : '';
    const account = c.showAccount === true ? `<a class="bk-sh-cart bk-sh-ic" href="/pages/suivi" aria-label="Mon compte" style="${iconStyle}">${ACCOUNT_SVG}</a>` : '';
    const actions =
      cart || cta || secondary || burger || search || account ? `<div class="bk-sh-act">${search}${account}${cart}${secondary}${cta}${burger}</div>` : '';

    const align = oneOf(c.align, ['left', 'center'] as const, 'left');
    const overlay = c.overlay === true;
    const extra =
      (overlay ? ' ov' : '') +
      (oneOf(c.linkCase, ['normal', 'upper'] as const, 'normal') === 'upper' ? ' uc' : '') +
      (oneOf(c.brandAlign, ['left', 'center'] as const, 'left') === 'center' ? ' bc' : '');

    return (
      `<header class="bk bk-sh${sticky && !overlay ? ' st' : ''}${extra}" data-open="0" ` +
      `style="background:${bg};color:${fg};border-bottom:1px solid ${border}">` +
      announcement +
      `<div class="bk-sh-bar"${align === 'center' ? ' style="justify-content:center"' : ''}>` +
      brand +
      desktopNav +
      actions +
      `</div>` +
      mobileNav +
      `</header>`
    );
  },
};
