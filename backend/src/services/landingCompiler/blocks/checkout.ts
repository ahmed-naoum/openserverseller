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
 *
 * One deliberate departure from the original (owner request, 2026-08): the
 * phone field accepts Moroccan numbers only — 0[5-7] plus 8 digits, or the
 * same subscriber number behind +212 / 00212 / 212 — where the React form
 * OR-ed that pattern with a loose "9 to 14 digits anywhere" fallback. Errors
 * also surface in real time per field instead of only on submit.
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
  nameLetters: 'يرجى كتابة الاسم بالحروف',
  nameLong: 'الاسم طويل جدا',
  cityRequired: 'اسم المدينة مطلوب *',
  cityShort: 'يرجى كتابة اسم المدينة بشكل صحيح',
  cityLetters: 'يرجى كتابة اسم المدينة بالحروف',
  cityLong: 'اسم المدينة طويل جدا',
  phoneRequired: 'رقم الهاتف مطلوب *',
  // The generic message doubles as the fallback for the three precise ones on
  // pages cached before they existed, so it must stay self-sufficient.
  phoneInvalid: 'يرجى إدخال رقم هاتف مغربي صحيح (مثال: 0612345678)',
  phonePrefix: 'يجب أن يبدأ الرقم بـ 06 أو 07 أو 05 (أو +212)',
  phoneIncomplete: 'الرقم غير مكتمل، يجب أن يتكون من 10 أرقام',
  phoneLong: 'رقم الهاتف طويل جدا',
  // Only reachable when the address is filled in; an empty one stays valid.
  addressShort: 'العنوان قصير جدا، يرجى كتابته كاملا',
  addressLong: 'العنوان طويل جدا',
  sending: 'جاري المعالجة...',
  failed: 'حدث خطأ، يرجى المحاولة مرة أخرى',
  success: 'تم استلام طلبك بنجاح!',
  successBody: 'سنتصل بك قريبا لتأكيد الطلب.',
};

/**
 * The one place the field rules live: the `maxlength` attributes below and the
 * runtime's checks both read these, so the browser's own cap and the message
 * the customer sees can never disagree.
 *
 * The lower bounds stay where the React form had them (2 characters for a name
 * or a city) — this is the money path, and a stricter floor would start
 * rejecting leads that convert today. The upper bounds are new, and set far
 * above any real Moroccan name, city or address, so they only ever catch a
 * paste or a bot.
 *
 * The phone field has no digit-count entry any more: its rule is the Moroccan
 * pattern in the runtime, which fixes the length by itself. `phoneMax` remains
 * as the raw input cap (separators and a leading + included).
 */
const LIMITS = {
  nameMin: 2,
  nameMax: 60,
  cityMin: 2,
  cityMax: 40,
  phoneMax: 20,
  /** Applies only once something has been typed — the field stays optional. */
  addressMin: 5,
  addressMax: 200,
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
  /** Hard cap the browser enforces before the runtime ever sees the value. */
  maxLength?: number;
  /** Keyboard hint on mobile, where most of this traffic is. */
  inputMode?: string;
  autoComplete?: string;
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
  // `maxlength` stops the value at the cap while typing; the runtime still
  // checks the length, because a paste on some mobile browsers lands over it.
  const max = o.maxLength ? ` maxlength="${o.maxLength}"` : '';
  const mode = o.inputMode ? ` inputmode="${o.inputMode}"` : '';
  const auto = o.autoComplete ? ` autocomplete="${o.autoComplete}"` : '';
  const attrs = `${max}${mode}${auto}`;

  const control = o.rows
    ? `<textarea class="ck-i" id="${id}" data-ck="${o.key}" dir="${dir}" rows="${o.rows}"` +
      `${required}${attrs} placeholder="${esc(o.placeholder)}"></textarea>`
    : `<input class="ck-i" id="${id}" data-ck="${o.key}" type="${o.type || 'text'}" dir="${dir}"` +
      `${required}${attrs} placeholder="${esc(o.placeholder)}">`;

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
    // The selected look is driven entirely by `.is-on`, never by an inline
    // style. An inline style would win over the class, so the runtime could
    // move `.is-on` while the first pack kept its border and badge — the
    // customer would see one pack highlighted and be charged for another.
    // Per-pack colours travel as custom properties instead.
    `.ck-pack{position:relative;display:flex;align-items:center;justify-content:space-between;` +
    `gap:10px;padding:12px 14px;cursor:pointer;border-style:solid;border-width:0;` +
    `border-bottom:1px solid #f3f4f6;background:transparent}` +
    `.ck-pack.is-on{border-width:var(--pkw,2px);border-color:var(--pk,#f97316);` +
    `border-radius:var(--pkr,16px);background:var(--pkbg,transparent)}` +
    `.ck-pack .ck-badge{display:none}` +
    `.ck-pack.is-on .ck-badge{display:block}` +
    `.ck-pack-n{font-weight:700}` +
    // Units per pack, and deliberately quieter than the name it follows. The
    // pack's price is the bundle total whatever the quantity, so anything that
    // reads as loudly as the price would be taken as a discount claim the pack
    // is not making. It states what the customer receives, nothing more.
    `.ck-pack-q{margin-inline-start:6px;font-size:12px;font-weight:600;opacity:.6}` +
    `.ck-pack-p{font-weight:800;white-space:nowrap}` +
    `.ck-pack-o{text-decoration:line-through;opacity:.6;font-weight:600;margin-inline-end:6px}` +
    `.ck-badge{position:absolute;top:-4px;inset-inline-start:-8px;padding:2px 8px;font-size:7px;` +
    `font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:-.02em;border-radius:999px}` +
    `.ck-f{margin:0 0 12px}` +
    `.ck-l{display:block;margin:0 0 6px;font-size:14px;font-weight:600}` +
    `.ck-i{width:100%;padding:12px 14px;font:inherit;font-size:16px;border:1px solid #d1d5db;` +
    `border-radius:10px;background:#fff;color:#111827}` +
    `.ck-i:focus{outline:2px solid var(--ck-a);outline-offset:1px;border-color:var(--ck-a)}` +
    `.ck-i[aria-invalid=true]{border-color:#dc2626;outline-color:#dc2626}` +
    // Positive feedback the moment a field becomes valid — part of the same
    // live-validation pass that shows the errors, driven by `data-valid`.
    `.ck-i[data-valid=true]{border-color:#16a34a}` +
    // display:none -> block restarts the animation, so every new message slides
    // in even when it replaces a previous one in the same slot.
    `.ck-e{display:none;margin-top:5px;font-size:13px;font-weight:600;color:#dc2626;` +
    `animation:ck-ein .18s ease-out}` +
    `@keyframes ck-ein{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}` +
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

    // 32px, not 0: express_checkout is the one block whose vertical padding
    // defaults high (BlockRenderer.tsx:268).
    const wrapStyle =
      `padding-top:${num(c.paddingTop, 32, 0, 400)}px;` +
      `padding-bottom:${num(c.paddingBottom, 32, 0, 400)}px;` +
      `margin-top:${num(c.marginTop, 0, -200, 400)}px;` +
      `margin-bottom:${num(c.marginBottom, 0, -200, 400)}px;` +
      `background:${containerBg}`;

    const cardStyle =
      `--ck-a:${accent};background:${formBg};border-radius:${radius};` +
      `border-width:${borderWidth}px;border-color:${borderColor}`;

    const uid = String(ctx.index);
    const parts: string[] = [];
    // `express-checkout-block` is the anchor a button block scrolls to and the
    // element its sticky-hide observer watches. React emits it on every checkout
    // block and relies on getElementById returning the first; only the first one
    // gets it here so the document stays valid HTML.
    const anchor = ctx.index === ctx.firstCheckoutIndex ? ' id="express-checkout-block"' : '';

    parts.push(
      `<div class="bk" style="${wrapStyle}">` +
        `<div class="ck" data-ck-root${anchor} style="${cardStyle}">`
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
        const priceColor = safeColor(opt?.priceColor, '#111827');
        // Floored: `num` clamps but does not round, and the runtime stores a
        // floored integer into an Int column — a badge reading "x2.5" next to a
        // lead recorded as 2 units is a support ticket waiting to happen.
        const qty = Math.floor(num(opt?.quantity, 1, 1, 99));

        // `${tint}08` in the original: 8-digit hex alpha, about a 3% tint. Only
        // valid on 6-digit hex, so anything else gets no fill rather than a
        // malformed colour that would drop the declaration entirely.
        const tintBg = /^#[0-9a-f]{6}$/i.test(tint) ? `${tint}08` : 'transparent';

        // Custom properties, not a conditional inline style: these describe how
        // the pack looks WHEN selected, and the class decides whether it is.
        const vars =
          `--pk:${tint};--pkw:${packBorder}px;--pkr:${packRadius}px;--pkbg:${tintBg}`;

        parts.push(
          `<div class="ck-pack${on ? ' is-on' : ''}" data-pack="${esc(opt?.id ?? i)}"` +
            ` role="radio" tabindex="0" aria-checked="${on ? 'true' : 'false'}" style="${vars}">` +
            // Rendered on every pack; CSS shows it only on the selected one, so
            // the runtime can move the selection without rebuilding markup.
            `<span class="ck-badge" style="background:${tint}">محدد</span>` +
            // Nested inside the name rather than beside it: `.ck-pack` is a
            // space-between flex row, so a third child would push the badge to
            // the middle of the row instead of leaving it against the name.
            // Absent at quantity 1 — "×1" is noise on every single-unit pack.
            `<span class="ck-pack-n">${esc(opt?.name || `Pack ${i + 1}`)}` +
            (qty > 1 ? `<span class="ck-pack-q">×${esc(qty)}</span>` : '') +
            `</span>` +
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
      placeholder: c.namePlaceholder || DEFAULTS.namePlaceholder,
      maxLength: LIMITS.nameMax, autoComplete: 'name' }));
    parts.push(field({ key: 'phone', uid, type: 'tel', label: c.phoneLabel || DEFAULTS.phoneLabel,
      placeholder: c.phonePlaceholder || DEFAULTS.phonePlaceholder,
      // Not inputmode="numeric": the field accepts a leading + and separators,
      // and the numeric keypad on iOS offers neither.
      maxLength: LIMITS.phoneMax, inputMode: 'tel', autoComplete: 'tel' }));
    parts.push(field({ key: 'city', uid, label: c.cityLabel || DEFAULTS.cityLabel,
      placeholder: c.cityPlaceholder || DEFAULTS.cityPlaceholder,
      maxLength: LIMITS.cityMax, autoComplete: 'address-level2' }));
    // Optional, and a textarea: matches ReferralForm.tsx:666-681. `maxlength`
    // is a cap, not a requirement — an empty address still submits.
    parts.push(field({ key: 'address', uid, required: false, rows: 2,
      label: c.addressLabel || DEFAULTS.addressLabel,
      placeholder: c.addressPlaceholder || DEFAULTS.addressPlaceholder,
      maxLength: LIMITS.addressMax, autoComplete: 'street-address' }));

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
        // Units in the pack, which decide only how much stock the order
        // reserves — never the money. The price above is the bundle total
        // whatever this says, so nothing downstream may multiply the two.
        qty: Math.floor(num(o?.quantity, 1, 1, 99)),
      })),
      pixels: ctx.pixels,
      // Where a completed order goes. Matches ReferralForm's
      // navigate(thankYouPath(code), { replace: true }) — the per-link page,
      // which falls back to the shared default when the seller has not built
      // one, so this is safe for every link. The '/thank-you' segment is load
      // bearing: the lead signal in backend/src/index.ts matches on it.
      thankYouUrl: `/r/${encodeURIComponent(ctx.code)}/thank-you`,
      // Long enough for the pixel beacons to leave before the document unloads,
      // short enough that the visitor does not notice a pause.
      thankYouDelayMs: 400,
      // Last tier of the price chain, so a pack with no price of its own
      // still updates the header to something truthful.
      retailPrice: ctx.productPriceMad,
      msg: MESSAGES,
      // Same object the maxlength attributes above were built from, so the
      // browser's cap and the message the customer reads always agree.
      lim: LIMITS,
    };
    parts.push(`<script type="application/json">${jsonForScript(cfg)}</script>`);

    parts.push('</div></div>');
    return parts.join('');
  },
};
