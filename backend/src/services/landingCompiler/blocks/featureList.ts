import { esc, safeColor, safeUrl, num, oneOf } from '../escape.js';
import type { BlockRenderer, BlockContext } from './types.js';

const CHECK_SVG =
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`;

/** A heading, a paragraph, and check-marked points in one or two columns. */
export const featureListBlock: BlockRenderer = {
  type: 'feature_list',

  css:
    `.bk-fl{width:100%;padding-left:24px;padding-right:24px}` +
    `.bk-fl-in{margin:0 auto;width:100%}.bk-fl.al-l .bk-fl-in{margin-left:0}` +
    `.bk-fl-k{display:inline-block;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;margin-bottom:10px}` +
    `.bk-fl h3{margin:0 0 10px;font-size:28px;line-height:1.15;font-weight:900}` +
    `.bk-fl.sz-md h3{font-size:24px}.bk-fl.sz-xl h3{font-size:36px}@media(min-width:768px){.bk-fl.sz-xl h3{font-size:44px}}` +
    `.bk-fl.up h3{text-transform:uppercase;letter-spacing:.02em}` +
    `.bk-fl.al-c{text-align:center}` +
    `.bk-fl-p{margin:0 0 18px;font-size:16px;line-height:1.65}` +
    `.bk-fl-l{list-style:none;margin:0;padding:0;display:grid;gap:12px 24px;grid-template-columns:1fr}` +
    `@media(min-width:640px){.bk-fl-l.c2{grid-template-columns:1fr 1fr}.bk-fl-l.c3{grid-template-columns:1fr 1fr 1fr}}` +
    `.bk-fl-i{display:flex;gap:12px;align-items:flex-start;text-align:left}` +
    `.bk-fl.al-c .bk-fl-l{justify-items:center}.bk-fl.al-c .bk-fl-i{max-width:360px}` +
    `.bk-fl-m{flex-shrink:0;width:26px;height:26px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;margin-top:1px}` +
    `.bk-fl-m svg{width:14px;height:14px}` +
    `.bk-fl-i b{display:block;font-size:15px;font-weight:800;line-height:1.35}` +
    `.bk-fl-i span{display:block;font-size:13px;line-height:1.55;margin-top:2px}` +
    `.bk-fl-b{display:inline-flex;align-items:center;justify-content:center;margin-top:22px;padding:13px 26px;border-radius:12px;font-weight:800;font-size:14px;text-decoration:none}`,

  render(block: any, _ctx: BlockContext): string {
    const c = block?.content || {};
    const align = oneOf(c.align, ['left', 'center'] as const, 'left');
    const size = oneOf(c.titleSize, ['md', 'lg', 'xl'] as const, 'lg');
    const marker = oneOf(c.marker, ['check', 'dot', 'number', 'icon'] as const, 'check');
    const cols = num(c.columns, 2, 1, 3);
    const title = safeColor(c.titleColor, '#0f172a');
    const text = safeColor(c.textColor, '#475569');
    const markerColor = safeColor(c.markerColor, '#16a34a');
    const maxWidth = num(c.maxWidth, 0, 0, 1600);

    const style =
      `padding-top:${num(c.paddingTop, 16, 0, 400)}px;padding-bottom:${num(c.paddingBottom, 16, 0, 400)}px;` +
      `margin-top:${num(c.marginTop, 0, -200, 400)}px;margin-bottom:${num(c.marginBottom, 0, -200, 400)}px`;

    const items = (Array.isArray(c.items) ? c.items : []).slice(0, 12);
    const mark = (item: any, i: number) => {
      const inner =
        marker === 'number' ? String(i + 1) : marker === 'dot' ? '•' : marker === 'icon' && item?.icon ? esc(String(item.icon).slice(0, 4)) : CHECK_SVG;
      const solid = marker === 'number' || marker === 'check';
      return `<i class="bk-fl-m" style="${solid ? `background:${markerColor};color:#ffffff` : `color:${markerColor};background:transparent`}">${inner}</i>`;
    };
    const list = items.length
      ? `<ul class="bk-fl-l c${cols}">` +
        items
          .map((it: any, i: number) => {
            const t = String(it?.title ?? '').trim().slice(0, 90);
            const d = String(it?.text ?? '').trim().slice(0, 200);
            if (!t && !d) return '';
            return `<li class="bk-fl-i">${mark(it, i)}<div>${t ? `<b style="color:${title}">${esc(t)}</b>` : ''}${d ? `<span style="color:${text}">${esc(d)}</span>` : ''}</div></li>`;
          })
          .join('') +
        `</ul>`
      : '';

    const kicker = String(c.kicker ?? '').trim().slice(0, 60);
    const heading = String(c.title ?? '').trim().slice(0, 120);
    const para = String(c.text ?? '').trim().slice(0, 400);
    const ctaText = String(c.ctaText ?? '').trim().slice(0, 40);
    const ctaHref = ctaText ? safeUrl(c.ctaUrl || '/products') : '';

    return (
      `<div class="bk bk-fl al-${align[0]} sz-${size}${c.uppercase ? ' up' : ''}" style="${style}">` +
      `<div class="bk-fl-in"${maxWidth ? ` style="max-width:${maxWidth}px"` : ''}>` +
      (kicker ? `<span class="bk-fl-k" style="color:${markerColor}">${esc(kicker)}</span>` : '') +
      (heading ? `<h3 style="color:${title}">${esc(heading)}</h3>` : '') +
      (para ? `<p class="bk-fl-p" style="color:${text}">${esc(para)}</p>` : '') +
      list +
      (ctaText && ctaHref ? `<a class="bk-fl-b" href="${esc(ctaHref)}" style="background:${safeColor(c.ctaBg, '#0f172a')};color:${safeColor(c.ctaColor, '#ffffff')}">${esc(ctaText)}</a>` : '') +
      `</div></div>`
    );
  },
};
