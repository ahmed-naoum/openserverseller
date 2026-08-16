import { esc, safeColor, num, jsonForScript } from '../escape.js';
import { CHECKOUT_RUNTIME } from '../runtime/checkout.js';
import type { BlockRenderer, BlockContext } from './types.js';

/**
 * Ported from ReferralForm.renderCheckoutForm (lines 429-716) — the money path.
 *
 * Behaviour is reproduced as shipped, including the parts that look like bugs,
 * because a rendering rewrite and a behaviour change landing in the same release
 * would make any movement in conversion impossible to attribute. Specifically
 * preserved:
 *
 *  - `showPrice` is opt-OUT (`!== false`), `showOldPrice` is opt-IN (truthy).
 *  - The old price falls back to retail + 50, then to 150. Both are magic
 *    numbers in the original.
 *  - The header old price ignores the selected pack's own `oldPrice`.
 *  - Phone validation is effectively "9 to 14 digits anywhere".
 *
 * `border-style: solid` is set explicitly throughout. In the React version it
 * comes from Tailwind's preflight, which sets it globally; without preflight the
 * inline `borderWidth`/`borderColor` would render nothing at all.
 */

const DEFAULTS = {
  title: 'اطلب الآن',
  buttonText: 'تأكيد الطلب',
  nameLabel: 'الاسم الكامل *',
  namePlaceholder: 'مثال: يوسف بن جلون',
  phoneLabel: 'رقم الهاتف *',
  phonePlaceholder: '06 XX XX XX XX',
  cityLabel: 'المدينة *',
  cityPlaceholder: 'مثال: الدار البيضاء',
  // Explicitly "(optional)" — the address is not required by the form or by
  // POST /public/leads, and call-centre agents collect it on the confirmation
  // call. Requiring it here would reject orders both sides accept.
  addressLabel: 'العنوان (اختياري)',
  addressPlaceholder: 'عنوانك الكامل لترهين التوصيل',
};

const MESSAGES = {
  nameRequired: 'الاسم الكامل مطلوب *',
  nameShort: 'يرجى كتابة الاسم الكامل بشكل صحيح',
  cityRequired: 'اسم المدينة مطلوب *',
  cityShort: 'يرجى كتابة اسم المدينة بشكل صحيح',
  phoneRequired: 'رقم الهاتف مطلوب *',
  phoneInvalid: 'رقم هاتف غير صحيح (مثال: 0612345678)',
  sending: 'جاري المعالجة...',
  failed: 'حدث خطأ، يرجى المحاولة مرة أخرى',
  success: 'تم استلام طلبك بنجاح!',
  successBody: 'سنتصل بك قريبا لتأكيد الطلب.',
};

interface FieldOptions {
  key: string;
  uid: string;
  label: string;
  placeholder: string;
  type?: string;
  required?: boolean;
  /** Renders a textarea instead of an input, matching the address field. */
  rows?: number;
}

/**
 * Ids are suffixed per block so a page with two checkout blocks stays valid
 * HTML; the runtime finds elements by `data-ck` within its own root rather than
 * by id, so the ids exist only to bind each label to its control.
 */
function field(o: FieldOptions): string {
  const id = `ck-${o.key}-${o.uid}`;
  // `dir` is hard-coded ltr on the phone field in the original; every other
  // field follows the page direction.
  const dir = o.key === 'phone' ? 'ltr' : 'rtl';
  const required = o.required === false ? '' : ' required';

  const control = o.rows
    ? `<textarea class="ck-i" id="${id}" data-ck="${o.key}" dir="${dir}" rows="${o.rows}"` +
      `${required} placeholder="${esc(o.placeholder)}"></textarea>`
    : `<input class="ck-i" id="${id}" data-ck="${o.key}" type="${o.type || 'text'}" dir="${dir}"` +
      `${required} placeholder="${esc(o.placeholder)}">`;

  return (
    `<div class="ck-f">` +
    `<label class="ck-l" for="${id}">${esc(o.label)}</label>` +
    control +
    `<div class="ck-e" data-ck-err role="alert"></div>` +
    `</div>`
  );
}

export const checkoutBlock: BlockRenderer = {
  type: 'express_checkout',

  css:
    `.ck{--ck-a:#f97316;padding:20px;border-style:solid}` +
    `.ck-t{margin:0 0 4px;font-size:22px;font-weight:800;text-align:center}` +
    `.ck-s{margin:0 0 14px;font-size:14px;text-align:center;opacity:.75}` +
    `.ck-price{text-align:center;margin:0 0 16px;line-height:1.2}` +
    `.ck-old{font-weight:700;text-decoration:line-through;opacity:.6;margin-inline-end:8px}` +
    `.ck-now{font-weight:900}` +
    `.ck-packs{margin:0 0 20px}` +
    `.ck-pack{position:relative;display:flex;align-items:center;justify-content:space-between;` +
    `gap:10px;padding:12px 14px;cursor:pointer;border-style:solid;border-width:0;` +
    `border-bottom:1px solid #f3f4f6;background:transparent}` +
    `.ck-pack.is-on{border-bottom-color:transparent}` +
    `.ck-pack-n{font-weight:700}` +
    `.ck-pack-p{font-weight:800;white-space:nowrap}` +
    `.ck-pack-o{text-decoration:line-through;opacity:.6;font-weight:600;margin-inline-end:6px}` +
    `.ck-badge{position:absolute;top:-4px;inset-inline-start:-8px;padding:2px 8px;font-size:7px;` +
    `font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:-.02em;border-radius:999px}` +
    `.ck-f{margin:0 0 12px}` +
    `.ck-l{display:block;margin:0 0 6px;font-size:14px;font-weight:600}` +
    `.ck-i{width:100%;padding:12px 14px;font:inherit;font-size:16px;border:1px solid #d1d5db;` +
    `border-radius:10px;background:#fff;color:#111827}` +
    `.ck-i:focus{outline:2px solid var(--ck-a);outline-offset:1px;border-color:var(--ck-a)}` +
    `.ck-i[aria-invalid=true]{border-color:#dc2626}` +
    `.ck-e{display:none;margin-top:5px;font-size:13px;color:#dc2626}` +
    `.ck-strip{display:none;margin:0 0 12px;padding:10px 12px;border-radius:10px;` +
    `background:#fef2f2;color:#991b1b;font-size:14px}` +
    `.ck-b{width:100%;padding:15px;font:inherit;font-weight:800;cursor:pointer;` +
    `border-style:solid;border-width:0;color:#fff;background:var(--ck-a)}` +
    `.ck-b[disabled]{opacity:.65;cursor:default}` +
    `.ck-ok{display:none;padding:26px 20px;text-align:center}` +
    `.ck-ok-t{margin:0 0 6px;font-size:20px;font-weight:800;color:#15803d}` +
    `.ck-ok-b{margin:0;font-size:15px;opacity:.8}`,

  runtime: CHECKOUT_RUNTIME,

  render(block: any, ctx: BlockContext): string {
    const c = block?.content || {};
    const rtl = true;

    const accent = safeColor(c.themeColor, '#f97316');
    const formBg = safeColor(c.formBgColor, '#ffffff');
    const containerBg = safeColor(c.containerBgColor, 'transparent');
    const borderColor = safeColor(c.borderColor, '#e5e7eb');
    const borderWidth = num(c.borderWidth, 0, 0, 20);

    const radius =
      `${num(c.borderRadiusTL, 16, 0, 80)}px ${num(c.borderRadiusTR, 16, 0, 80)}px ` +
      `${num(c.borderRadiusBR, 16, 0, 80)}px ${num(c.borderRadiusBL, 16, 0, 80)}px`;

    const wrapStyle =
      `padding-top:${num(c.paddingTop, 0, 0, 400)}px;` +
      `padding-bottom:${num(c.paddingBottom, 0, 0, 400)}px;` +
      `margin-top:${num(c.marginTop, 0, -200, 400)}px;` +
      `margin-bottom:${num(c.marginBottom, 0, -200, 400)}px;` +
      `background:${containerBg}`;

    const cardStyle =
      `--ck-a:${accent};background:${formBg};border-radius:${radius};` +
      `border-width:${borderWidth}px;border-color:${borderColor}`;

    const uid = String(ctx.index);
    const parts: string[] = [];
    parts.push(
      `<div class="bk" style="${wrapStyle}">` +
        `<div class="ck" data-ck-root style="${cardStyle}">`
    );

    parts.push(`<h2 class="ck-t">${esc(c.title || DEFAULTS.title)}</h2>`);
    if (c.subtitle) parts.push(`<p class="ck-s">${esc(c.subtitle)}</p>`);

    // Opt-out, matching `blockContent.showPrice !== false`.
    if (c.showPrice !== false) {
      const priceColor = safeColor(c.priceColor, '#f64444');
      const priceSize = num(c.priceSize, 30, 8, 120);
      const bits: string[] = [];

      // Opt-in, matching plain truthiness on showOldPrice.
      if (c.showOldPrice) {
        const oldColor = safeColor(c.oldPriceColor, '#9ca3af');
        const oldSize = num(c.oldPriceSize, Math.round(priceSize * 0.7), 6, 120);
        // `retail + 50`, else 150. Both magic numbers are in the original, and
        // so is the truthiness test — a product priced at 0 falls to 150 rather
        // than showing 50. `Number.isFinite` would be wrong here: Number(null)
        // is 0, which is finite, and would quietly print "50 MAD".
        const retail = Number(ctx.productPriceMad);
        const oldValue = c.oldPriceValue || (retail ? retail + 50 : 150);
        bits.push(
          `<span class="ck-old" style="color:${oldColor};font-size:${oldSize}px">` +
            `${esc(oldValue)} MAD</span>`
        );
      }

      const packs = Array.isArray(c.options) ? c.options : [];
      const current = packs.length && packs[0]?.price ? packs[0].price : ctx.productPriceMad;
      bits.push(
        `<span class="ck-now" data-ck="price" style="color:${priceColor};font-size:${priceSize}px">` +
          `${esc(current)} MAD</span>`
      );
      parts.push(`<div class="ck-price">${bits.join('')}</div>`);
    }

    const packs = Array.isArray(c.options) ? c.options : [];
    if (packs.length) {
      const packBorder = num(c.packBorderWidth, 2, 0, 12);
      const packRadius = num(c.packBorderRadius, 16, 0, 60);

      parts.push('<div class="ck-packs" data-ck="packs" role="radiogroup">');
      packs.forEach((opt: any, i: number) => {
        const tint = safeColor(opt?.color || c.packColor, accent);
        const on = i === 0;
        // `${accent}08` in the original: 8-digit hex alpha, about a 3% tint.
        const style = on
          ? `border-width:${packBorder}px;border-color:${tint};border-radius:${packRadius}px;` +
            `background:${tint}08`
          : '';
        const priceColor = safeColor(opt?.priceColor, '#111827');

        parts.push(
          `<div class="ck-pack${on ? ' is-on' : ''}" data-pack="${esc(opt?.id ?? i)}"` +
            ` role="radio" tabindex="0" aria-checked="${on ? 'true' : 'false'}" style="${style}">` +
            (on ? `<span class="ck-badge" style="background:${tint}">محدد</span>` : '') +
            `<span class="ck-pack-n">${esc(opt?.name || `Pack ${i + 1}`)}</span>` +
            `<span class="ck-pack-p">` +
            (opt?.oldPrice
              ? `<span class="ck-pack-o" style="color:${safeColor(opt?.oldPriceColor, '#9ca3af')}">` +
                `${esc(opt.oldPrice)}</span>`
              : '') +
            `<span style="color:${priceColor}">${esc(opt?.price ?? '')} MAD</span>` +
            `</span>` +
            `</div>`
        );
      });
      parts.push('</div>');
    }

    parts.push('<div class="ck-strip" data-ck="strip" role="alert"></div>');
    parts.push('<form novalidate>');
    parts.push(field({ key: 'name', uid, label: c.nameLabel || DEFAULTS.nameLabel,
      placeholder: c.namePlaceholder || DEFAULTS.namePlaceholder }));
    parts.push(field({ key: 'phone', uid, type: 'tel', label: c.phoneLabel || DEFAULTS.phoneLabel,
      placeholder: c.phonePlaceholder || DEFAULTS.phonePlaceholder }));
    parts.push(field({ key: 'city', uid, label: c.cityLabel || DEFAULTS.cityLabel,
      placeholder: c.cityPlaceholder || DEFAULTS.cityPlaceholder }));
    // Optional, and a textarea: matches ReferralForm.tsx:666-681.
    parts.push(field({ key: 'address', uid, required: false, rows: 2,
      label: c.addressLabel || DEFAULTS.addressLabel,
      placeholder: c.addressPlaceholder || DEFAULTS.addressPlaceholder }));

    const btnRadius = num(c.buttonBorderRadius, 12, 0, 60);
    const btnSize = num(c.buttonSize, 17, 10, 40);
    const btnColor = safeColor(c.buttonTextColor, '#ffffff');
    parts.push(
      `<button class="ck-b" data-ck="submit" type="submit"` +
        ` style="border-radius:${btnRadius}px;font-size:${btnSize}px;color:${btnColor}">` +
        `${esc(c.buttonText || ctx.landingButtonText || DEFAULTS.buttonText)}</button>`
    );
    parts.push('</form>');

    // Pre-rendered rather than built on success: the React version contains this
    // markup too (ReferralForm.tsx:449-473) but navigates away before it can
    // ever show, so it has never been seen.
    parts.push(
      `<div class="ck-ok" data-ck="success" role="status">` +
        `<p class="ck-ok-t">${esc(MESSAGES.success)}</p>` +
        `<p class="ck-ok-b">${esc(MESSAGES.successBody)}</p>` +
        `</div>`
    );

    const cfg = {
      code: ctx.code,
      packs: packs.map((o: any, i: number) => ({
        id: String(o?.id ?? i),
        // The NAME, bare. getPackPrice matches option.name or option.id and
        // nothing else, so a composite string would silently fall back to the
        // product's retail price.
        name: String(o?.name ?? ''),
        price: o?.price ?? null,
      })),
      pixels: ctx.pixels,
      // Last tier of the price chain, so a pack with no price of its own
      // still updates the header to something truthful.
      retailPrice: ctx.productPriceMad,
      msg: MESSAGES,
    };
    parts.push(`<script type="application/json">${jsonForScript(cfg)}</script>`);

    parts.push('</div></div>');
    return parts.join('');
  },
};
