import { esc, safeUrl, safeColor, num, jsonForScript } from '../escape.js';
import { CART_RUNTIME } from '../runtime/cart.js';
import type { BlockRenderer, BlockContext } from './types.js';

/**
 * A product in full, from the `product` prop the store compiler bound.
 *
 * Nothing here fetches. The product arrives resolved — the compiler looked it
 * up for this URL — so the markup is complete when it leaves the server, and
 * the only script is the cart runtime handling the two buttons.
 *
 * Without a product (the block on a page that has none, or an unresolved
 * binding) it renders an honest placeholder rather than an empty box.
 */

const PLACEHOLDER_SVG =
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">` +
  `<path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`;

function imageUrls(product: any): string[] {
  const list = Array.isArray(product?.images) ? product.images : [];
  return list
    .map((i: any) => safeUrl(i?.url ?? i?.imageUrl))
    .filter((u: string) => Boolean(u))
    .slice(0, 8);
}

export const productDetailBlock: BlockRenderer = {
  type: 'product_detail',

  css:
    `.bk-pd{max-width:1152px;margin:0 auto;padding-left:16px;padding-right:16px}` +
    `.bk-pd-g{display:grid;gap:32px;grid-template-columns:1fr}` +
    `@media(min-width:900px){.bk-pd-g{grid-template-columns:1.1fr 1fr;align-items:start}}` +
    `.bk-pd-main{background:#f9fafb;border-radius:20px;overflow:hidden;aspect-ratio:1/1;display:flex;align-items:center;justify-content:center}` +
    `.bk-pd-main img{width:100%;height:100%;object-fit:contain;display:block}` +
    `.bk-pd-main .ph{color:#d1d5db;width:64px;height:64px}` +
    `.bk-pd-th{display:flex;gap:8px;margin-top:10px;overflow-x:auto}` +
    `.bk-pd-th label{flex:none;width:64px;height:64px;border-radius:12px;overflow:hidden;border:2px solid #e5e7eb;cursor:pointer;background:#fff}` +
    `.bk-pd-th img{width:100%;height:100%;object-fit:cover;display:block}` +
    `.bk-pd-th input{display:none}` +
    `.bk-pd-th input:checked+img{outline:2px solid #0f172a;outline-offset:-2px}` +
    `.bk-pd h1{font-size:28px;line-height:1.15;font-weight:900;letter-spacing:-.02em;margin:0 0 10px}` +
    `.bk-pd-sku{font-size:12px;color:#9ca3af;margin:0 0 14px}` +
    `.bk-pd-pr{font-size:30px;font-weight:900;margin:0 0 16px}` +
    `.bk-pd-pr small{font-size:14px;font-weight:700;color:#6b7280;margin-left:4px}` +
    `.bk-pd-ds{font-size:14px;line-height:1.7;color:#4b5563;margin:0 0 20px;white-space:pre-line}` +
    `.bk-pd-st{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;padding:6px 12px;border-radius:999px;margin-bottom:18px}` +
    `.bk-pd-st.in{background:#ecfdf5;color:#047857}.bk-pd-st.out{background:#fef2f2;color:#b91c1c}` +
    `.bk-pd-row{display:flex;gap:10px;align-items:stretch;flex-wrap:wrap}` +
    `.bk-pd-qty{display:inline-flex;align-items:center;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;background:#fff}` +
    `.bk-pd-qty button{width:40px;height:46px;border:0;background:none;font-size:18px;font-weight:900;cursor:pointer;color:#111827;font-family:inherit}` +
    `.bk-pd-qty input{width:44px;height:46px;border:0;text-align:center;font-weight:800;font-size:14px;font-family:inherit;-moz-appearance:textfield}` +
    `.bk-pd-qty input::-webkit-outer-spin-button,.bk-pd-qty input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}` +
    `.bk-pd-b{flex:1 1 180px;height:46px;border:0;border-radius:14px;font-weight:900;font-size:14px;cursor:pointer;font-family:inherit;transition:transform .15s,opacity .15s}` +
    `.bk-pd-b:active{transform:scale(.98)}.bk-pd-b:disabled{opacity:.7;cursor:default}` +
    `.bk-pd-b.alt{background:#0f172a;color:#fff}` +
    `.bk-pd-e{padding:40px 16px;text-align:center;color:#9ca3af;font-size:14px;border:1px dashed #e5e7eb;border-radius:16px}` +
    // The count badge the cart runtime draws on the header's cart icon.
    `.bk-sh-cart{position:relative}` +
    `.bk-sh-badge{position:absolute;top:2px;right:2px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#ef4444;color:#fff;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center;line-height:1}`,

  runtime: CART_RUNTIME,

  render(block: any, ctx: BlockContext): string {
    const c = block?.content || {};
    const p = c.product;
    const wrap =
      `padding-top:${num(c.paddingTop, 24, 0, 500)}px;padding-bottom:${num(c.paddingBottom, 24, 0, 500)}px;` +
      `margin-top:${num(c.marginTop, 0, -200, 500)}px;margin-bottom:${num(c.marginBottom, 0, -200, 500)}px`;

    if (!p || typeof p !== 'object' || !p.id) {
      return `<div class="bk bk-pd" style="${wrap}"><div class="bk-pd-e">Fiche produit — se remplit avec le produit de la page.</div></div>`;
    }

    const name = String(p.nameFr || p.nameAr || p.nameEn || '').trim() || 'Produit';
    const price = Number(p.retailPriceMad) || 0;
    const stock = Number(p.stockQuantity);
    const inStock = !Number.isFinite(stock) || stock > 0;
    const images = imageUrls(p);
    const priceColor = safeColor(c.priceColor, '#f97316');
    const btnBg = safeColor(c.buttonBg, '#f97316');
    const btnColor = safeColor(c.buttonColor, '#ffffff');
    const uid = `pd-${ctx.index}`;

    // Thumbnails switch the main image with a radio + CSS trick: no script.
    const gallery =
      c.showGallery === false
        ? ''
        : `<div>` +
          (images.length
            ? images
                .map(
                  (u, i) =>
                    `<div class="bk-pd-main" data-pd-img="${i}"${i ? ' hidden' : ''}>` +
                    `<img src="${esc(u)}" alt="${esc(name)}"${i ? ' loading="lazy"' : ' fetchpriority="high"'} decoding="async"></div>`
                )
                .join('')
            : `<div class="bk-pd-main"><span class="ph">${PLACEHOLDER_SVG}</span></div>`) +
          (images.length > 1
            ? `<div class="bk-pd-th">` +
              images
                .map(
                  (u, i) =>
                    `<label><input type="radio" name="${uid}-th" value="${i}"${i === 0 ? ' checked' : ''} data-pd-th>` +
                    `<img src="${esc(u)}" alt="" loading="lazy" decoding="async"></label>`
                )
                .join('') +
              `</div>`
            : '') +
          `</div>`;

    const cfg = {
      storeId: Number(c.storeId) || Number(p.storeId) || 0,
      added: 'Ajouté ✓',
      item: {
        productId: p.id,
        productName: name,
        sku: String(p.sku || ''),
        imageUrl: images[0] || null,
        variantName: null,
        variantOptionId: null,
        unitPriceMad: price,
      },
    };

    const buttons = inStock
      ? `<div class="bk-pd-row">` +
        `<div class="bk-pd-qty"><button type="button" data-cart-step="-" aria-label="Moins">−</button>` +
        `<input type="number" min="1" max="99" value="1" data-cart-qty aria-label="Quantité">` +
        `<button type="button" data-cart-step="+" aria-label="Plus">+</button></div>` +
        `<button type="button" class="bk-pd-b" data-cart-add="add" style="background:${btnBg};color:${btnColor}">${esc(String(c.buttonText || 'Ajouter au panier'))}</button>` +
        (c.showBuyNow !== false
          ? `<button type="button" class="bk-pd-b alt" data-cart-add="buy">${esc(String(c.buyNowText || 'Commander maintenant'))}</button>`
          : '') +
        `</div>`
      : '';

    return (
      `<div class="bk bk-pd" style="${wrap}" data-pd data-store-id="${cfg.storeId}">` +
      `<div class="bk-pd-g">` +
      gallery +
      `<div>` +
      `<h1>${esc(name)}</h1>` +
      (p.sku ? `<p class="bk-pd-sku">Réf. ${esc(String(p.sku))}</p>` : '') +
      `<p class="bk-pd-pr" style="color:${priceColor}">${esc(String(price))}<small>MAD</small></p>` +
      (c.showStock !== false
        ? `<span class="bk-pd-st ${inStock ? 'in' : 'out'}">${inStock ? 'En stock — livraison 24/48h' : 'Rupture de stock'}</span>`
        : '') +
      (c.showDescription !== false && p.description ? `<p class="bk-pd-ds">${esc(String(p.description))}</p>` : '') +
      buttons +
      `</div></div>` +
      `<script type="application/json">${jsonForScript(cfg)}</script>` +
      // Gallery switching is CSS driven off the radio state; a small style
      // block scoped to this instance keeps it script-free.
      (images.length > 1
        ? `<style>` +
          images
            .map((_, i) => `#${uid}:has(input[value="${i}"]:checked) [data-pd-img]{display:none}#${uid}:has(input[value="${i}"]:checked) [data-pd-img="${i}"]{display:flex}`)
            .join('') +
          `</style>`
        : '') +
      `</div>`
    ).replace('<div class="bk bk-pd"', `<div id="${uid}" class="bk bk-pd"`);
  },
};
