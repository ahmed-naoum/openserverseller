import { esc, safeUrl, safeColor, num, oneOf, jsonForScript } from '../escape.js';
import { PRODUCTS_RUNTIME } from '../runtime/products.js';
import type { BlockRenderer, BlockContext } from './types.js';

/**
 * Ported from BlockRenderer.tsx `case 'products'` (:239) and ProductsBlock
 * (:299) — a grid or carousel of the influencer's other products.
 *
 * The one block whose content does not live in the saved page. ProductsBlock
 * fetches `/public/products-by-accounts` on mount, so what the compiler can
 * emit is the shell React paints before its own request resolves: the skeleton,
 * the styles, and the block's settings as JSON for the runtime to finish with.
 *
 * Worth knowing before reading the empty state: that endpoint does not exist in
 * this backend. `frontend/src/lib/api.ts:457` calls it and no route answers, so
 * every live products block ends at "Aucun produit disponible ou sélectionné."
 * today — the fetch 404s, the catch logs, and `products` stays empty. The
 * compiled page reproduces that exactly rather than quietly resolving the
 * catalogue from the database, which would put products on a page that has
 * never shown any and make any change in conversion unattributable.
 */

const PLACEHOLDER_SVG =
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">` +
  `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" ` +
  `d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14` +
  `m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`;

const CHEVRON =
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"` +
  ` stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`;
const CHEVRON_LEFT = `${CHEVRON}<path d="m15 18-6-6 6-6"/></svg>`;
const CHEVRON_RIGHT = `${CHEVRON}<path d="m9 18 6-6-6-6"/></svg>`;

const EMPTY_TEXT = 'Aucun produit disponible ou sélectionné.';

/**
 * `#anchor` stays an anchor; anything else has to survive the URL allow-list.
 *
 * An anchor carrying anything outside an id is rejected rather than cleaned:
 * stripping the offending characters would leave a *different*, still-valid id
 * that scrolls somewhere nobody chose.
 */
function cardLink(raw: unknown, fallback: string): string {
  const value = String(raw ?? '').trim();
  if (!value) return fallback;
  if (value.startsWith('#')) return /^#[A-Za-z0-9_-]+$/.test(value) ? value : fallback;
  return safeUrl(value) || fallback;
}

/** One skeleton card, matching the pulse block React shows while it fetches. */
function skeleton(): string {
  return (
    `<div class="bk-pr-sk"><i></i><div>` +
    `<span style="height:16px;width:25%"></span>` +
    `<span style="height:24px;width:75%"></span>` +
    `<span style="height:16px;width:83.333333%"></span>` +
    `<span style="height:40px;width:100%;margin-top:16px"></span>` +
    `</div></div>`
  );
}

export const productsBlock: BlockRenderer = {
  type: 'products',

  css:
    `.bk-pr{max-width:1152px;margin-left:auto;margin-right:auto;` +
    `padding-left:16px;padding-right:16px}` +
    `.bk-pr-g{display:grid;gap:24px;grid-template-columns:1fr}` +
    // The slider's own skeleton is a flat three columns in React, responsive to
    // nothing — it is only ever on screen for the length of one request.
    `.bk-pr-g.gs{grid-template-columns:repeat(3,1fr)}` +
    `@media(min-width:640px){.bk-pr-g.g2,.bk-pr-g.g3,.bk-pr-g.g4{grid-template-columns:repeat(2,1fr)}}` +
    `@media(min-width:768px){.bk-pr-g.g3,.bk-pr-g.g4{grid-template-columns:repeat(3,1fr)}}` +
    `@media(min-width:1024px){.bk-pr-g.g4{grid-template-columns:repeat(4,1fr)}}` +
    `.bk-pr-c{display:flex;flex-direction:column;height:100%;overflow:hidden;` +
    `border:1px solid #f3f4f6;transition:transform .3s,box-shadow .3s}` +
    `.bk-pr-c:hover{transform:translateY(-4px);` +
    `box-shadow:0 10px 15px -3px rgba(0,0,0,.1),0 4px 6px -4px rgba(0,0,0,.1)}` +
    `.bk-pr-c.sh-s{box-shadow:0 1px 2px 0 rgba(0,0,0,.05)}` +
    `.bk-pr-c.sh-m{box-shadow:0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1)}` +
    `.bk-pr-c.sh-l{box-shadow:0 10px 15px -3px rgba(0,0,0,.1),0 4px 6px -4px rgba(0,0,0,.1)}` +
    `.bk-pr-c.sh-x{box-shadow:0 20px 25px -5px rgba(0,0,0,.1),0 8px 10px -6px rgba(0,0,0,.1)}` +
    `.bk-pr-im{position:relative;height:192px;background:#f9fafb;display:flex;` +
    `align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}` +
    `.bk-pr-im img{width:100%;height:100%;object-fit:contain;padding:8px;transition:transform .5s}` +
    `.bk-pr-im img:hover{transform:scale(1.05)}` +
    `.bk-pr-ph{color:#d1d5db}` +
    `.bk-pr-ph svg{width:48px;height:48px;display:block}` +
    `.bk-pr-cat{position:absolute;top:12px;left:12px;background:rgba(0,0,0,.6);` +
    `-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);color:#fff;font-size:10px;` +
    `font-weight:900;text-transform:uppercase;letter-spacing:.05em;padding:2px 8px;border-radius:6px}` +
    `.bk-pr-bd{padding:16px;display:flex;flex-direction:column;flex:1 1 0%;` +
    `justify-content:space-between}` +
    `.bk-pr-tx h4{font-size:16px;line-height:1.5;font-weight:900;margin:0;` +
    `display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;overflow:hidden}` +
    `.bk-pr-tx p{font-size:12px;line-height:1.625;margin:4px 0 0;` +
    `display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}` +
    `.bk-pr-ft{margin-top:16px;padding-top:12px;border-top:1px solid #f9fafb}` +
    `.bk-pr-pr{display:flex;align-items:center;justify-content:space-between}` +
    `.bk-pr-pr span{font-size:18px;font-weight:900}` +
    `.bk-pr-b{width:100%;margin-top:12px;padding:10px 16px;border:0;border-radius:12px;` +
    `font-family:inherit;font-size:12px;font-weight:900;text-align:center;cursor:pointer;` +
    `box-shadow:0 1px 3px 0 rgba(0,0,0,.1),0 1px 2px -1px rgba(0,0,0,.1);transition:transform .15s}` +
    `.bk-pr-b:active{transform:scale(.98)}` +
    `.bk-pr-s{position:relative;width:100%}` +
    `.bk-pr-sv{overflow:hidden;width:100%;position:relative}` +
    `.bk-pr-st{display:flex;gap:16px;padding-top:8px;padding-bottom:8px}` +
    `.bk-pr-st.a-smooth{transition:transform 1000ms cubic-bezier(.25,1,.5,1)}` +
    `.bk-pr-st.a-bounce{transition:transform 800ms cubic-bezier(.34,1.56,.64,1)}` +
    `.bk-pr-st.a-plain{transition:transform 500ms ease-in-out}` +
    `.bk-pr-si{min-width:0}` +
    `.bk-pr-a{position:absolute;top:50%;transform:translateY(-50%);width:36px;height:36px;` +
    `border-radius:50%;background:#fff;border:1px solid #f3f4f6;` +
    `box-shadow:0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1);` +
    `display:flex;align-items:center;justify-content:center;color:#4b5563;cursor:pointer;` +
    `z-index:10;transition:transform .2s}` +
    `.bk-pr-a:hover{transform:translateY(-50%) scale(1.05)}` +
    `.bk-pr-a:active{transform:translateY(-50%) scale(.95)}` +
    `.bk-pr-a.l{left:-16px}.bk-pr-a.r{right:-16px}` +
    `.bk-pr-dots{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:20px}` +
    `.bk-pr-dots button{width:8px;height:8px;padding:0;border:0;border-radius:999px;` +
    `background:#d1d5db;cursor:pointer;transition:all .3s}` +
    `.bk-pr-dots button:hover{background:#9ca3af}` +
    `.bk-pr-dots button.is-on{width:24px}` +
    `.bk-pr-mv{overflow:hidden;width:100%;position:relative}` +
    `.bk-pr-mt{display:flex;gap:16px;width:max-content;padding-top:8px;padding-bottom:8px;` +
    `animation:bkpr-mq linear infinite}` +
    `@keyframes bkpr-mq{0%{transform:translate3d(0,0,0)}100%{transform:translate3d(-50%,0,0)}}` +
    `.bk-pr-mi{width:280px;flex-shrink:0;min-width:0}` +
    `.bk-pr-sk{height:380px;overflow:hidden;background:#f3f4f6;border:1px solid #e5e7eb;` +
    `border-radius:16px;animation:bkpr-pulse 2s cubic-bezier(.4,0,.6,1) infinite}` +
    `@keyframes bkpr-pulse{0%,100%{opacity:1}50%{opacity:.5}}` +
    `.bk-pr-sk i{display:block;height:192px;width:100%;background:#e5e7eb}` +
    `.bk-pr-sk div{padding:16px}` +
    `.bk-pr-sk span{display:block;background:#e5e7eb;border-radius:4px;margin-top:12px}` +
    `.bk-pr-e{text-align:center;padding-top:48px;padding-bottom:48px;background:#f9fafb;` +
    `border:1px dashed #e5e7eb;border-radius:16px}` +
    `.bk-pr-e p{margin:0;font-size:14px;font-weight:700;color:#6b7280}`,

  runtime: PRODUCTS_RUNTIME,

  render(block: any, _ctx: BlockContext): string {
    const c = block?.content || {};

    const wrapStyle =
      `padding-top:${num(c.paddingTop, 32, 0, 400)}px;` +
      `padding-bottom:${num(c.paddingBottom, 32, 0, 400)}px;` +
      `margin-top:${num(c.marginTop, 0, -200, 400)}px;` +
      `margin-bottom:${num(c.marginBottom, 0, -200, 400)}px`;

    // Ids reach a query string, so anything that is not a plain number is
    // dropped. The builder only ever writes the owner's numeric user id.
    // Tested on the string, not on Number(): `Number(null)` is 0, which is
    // finite, and would turn a null in the array into a request for account 0.
    const accountIds = (Array.isArray(c.accountIds) ? c.accountIds : [])
      .map((id: any) => String(id ?? '').trim())
      .filter((id: string) => /^\d{1,12}$/.test(id));

    const layout = oneOf(c.layoutType, ['grid', 'slider'] as const, 'grid');
    const cols = num(c.gridCols || 3, 3, 1, 4);
    const shadow = String(c.cardShadow || 'md');
    const shadowClass =
      shadow === 'sm' ? 'sh-s' : shadow === 'lg' ? 'sh-l' : shadow === 'xl' ? 'sh-x' : shadow === 'md' ? 'sh-m' : '';

    const btnBg = safeColor(c.btnBg, '#f97316');
    const btnColor = safeColor(c.btnColor, '#ffffff');

    const cfg = {
      accountIds: accountIds.join(','),
      // Both a filter and an order, so the array shape has to survive intact.
      selected: (Array.isArray(c.selectedProducts) ? c.selectedProducts : []).map((sp: any) => ({
        id: String(sp?.productId ?? ''),
        link: cardLink(sp?.link, '#express-checkout-block'),
        buttonText: String(sp?.buttonText || ''),
        btnBg: sp?.btnBg ? safeColor(sp.btnBg, btnBg) : '',
        btnColor: sp?.btnColor ? safeColor(sp.btnColor, btnColor) : '',
      })),
      layout,
      cols,
      shadow: shadowClass,
      showPrice: c.showPrice !== false,
      cardBg: safeColor(c.cardBg, '#ffffff'),
      cardRadius: num(c.cardRadius, 16, 0, 200),
      titleColor: safeColor(c.titleColor, '#111827'),
      descColor: safeColor(c.descColor, '#4b5563'),
      priceColor: safeColor(c.priceColor, '#f97316'),
      btnBg,
      btnColor,
      slideStep: num(c.slideStep || 1, 1, 1, 20),
      autoPlay: c.autoPlay !== false,
      // The same field, two defaults: 3500ms per step for the carousel, 15s for
      // a full pass of the continuous marquee. Both are React's.
      speed: num(c.autoPlaySpeed || 3500, 3500, 100, 600000),
      speedMarquee: num(c.autoPlaySpeed || 15000, 15000, 100, 600000),
      anim: oneOf(
        c.animationType,
        ['continuous', 'smooth', 'bounce', 'default'] as const,
        'default'
      ),
      empty: EMPTY_TEXT,
      placeholder: PLACEHOLDER_SVG,
      chevronLeft: CHEVRON_LEFT,
      chevronRight: CHEVRON_RIGHT,
    };

    // With no account selected React never fetches, so the empty state is the
    // final answer and the skeleton would be a lie.
    const shell = accountIds.length
      ? // cardsPerView starts at 3 before the resize effect runs, so a slider
        // shows three skeletons and a grid shows two rows of its columns.
        `<div class="bk-pr-g ${layout === 'slider' ? 'gs' : `g${cols}`}">` +
        skeleton().repeat(layout === 'slider' ? 3 : cols * 2) +
        `</div>`
      : `<div class="bk-pr-e"><p>${esc(EMPTY_TEXT)}</p></div>`;

    return (
      `<div class="bk bk-pr" style="${wrapStyle}" data-pr>` +
      `<div data-pr-body>${shell}</div>` +
      `<script type="application/json">${jsonForScript(cfg)}</script>` +
      `</div>`
    );
  },
};
