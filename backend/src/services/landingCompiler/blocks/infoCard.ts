import { esc, safeColor, safeUrl, num, oneOf } from '../escape.js';
import type { BlockRenderer, BlockContext } from './types.js';

/**
 * The floating info card: a title, label/value rows, a progress bar, a
 * figure and a button, on glass or on a solid surface. Beside a hero it is
 * the "metrics panel" of the reference designs; on its own it is a compact
 * promise box. Pure HTML and CSS; the blur degrades to a plain translucent
 * surface where backdrop-filter is unsupported.
 */
export const infoCardBlock: BlockRenderer = {
  type: 'info_card',

  css:
    `.bk-ic{width:100%;display:flex;padding-left:16px;padding-right:16px}` +
    `.bk-ic.al-l{justify-content:flex-start}.bk-ic.al-c{justify-content:center}.bk-ic.al-r{justify-content:flex-end}` +
    `.bk-ic-c{width:100%;padding:22px 22px 20px;border:1px solid transparent;box-shadow:0 20px 45px -20px rgba(0,0,0,.35)}` +
    `.bk-ic-c.gl{-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}` +
    `.bk-ic-bd{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-bottom:10px}` +
    `.bk-ic-c h3{margin:0 0 4px;font-size:18px;line-height:1.3;font-weight:800}` +
    `.bk-ic-c .bk-ic-s{margin:0 0 14px;font-size:13px;line-height:1.5}` +
    `.bk-ic-r{display:flex;justify-content:space-between;gap:16px;padding:9px 0;font-size:13px;border-top:1px solid rgba(127,127,127,.18)}` +
    `.bk-ic-r b{font-weight:800;text-align:right}` +
    `.bk-ic-p{margin-top:12px}.bk-ic-pl{display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:6px}` +
    `.bk-ic-bar{height:6px;border-radius:999px;background:rgba(127,127,127,.22);overflow:hidden}` +
    `.bk-ic-bar i{display:block;height:100%;border-radius:999px}` +
    `.bk-ic-f{margin-top:14px;display:flex;align-items:baseline;gap:8px}.bk-ic-f b{font-size:26px;font-weight:900;line-height:1}.bk-ic-f span{font-size:12px}` +
    `.bk-ic-b{display:flex;align-items:center;justify-content:center;margin-top:16px;padding:12px 16px;border-radius:12px;` +
    `font-weight:800;font-size:14px;text-decoration:none;transition:transform .15s,opacity .15s}` +
    `.bk-ic-b:hover{opacity:.92}.bk-ic-b:active{transform:scale(.98)}`,

  render(block: any, _ctx: BlockContext): string {
    const c = block?.content || {};
    const style = oneOf(c.style, ['glass', 'solid'] as const, 'glass');
    const align = oneOf(c.align, ['left', 'center', 'right'] as const, 'right');
    const text = safeColor(c.textColor, '#0f172a');
    const muted = safeColor(c.mutedColor, '#475569');
    const radius = num(c.radius, 20, 0, 200);
    const maxWidth = num(c.maxWidth, 380, 200, 900);

    const wrap =
      `padding-top:${num(c.paddingTop, 16, 0, 400)}px;padding-bottom:${num(c.paddingBottom, 16, 0, 400)}px;` +
      `margin-top:${num(c.marginTop, 0, -200, 400)}px;margin-bottom:${num(c.marginBottom, 0, -200, 400)}px`;
    const card =
      `background:${safeColor(c.bgColor, style === 'glass' ? 'rgba(255,255,255,0.86)' : '#ffffff')};color:${text};` +
      `border-color:${safeColor(c.borderColor, style === 'glass' ? 'rgba(255,255,255,0.6)' : '#e2e8f0')};` +
      `border-radius:${radius}px;max-width:${maxWidth}px`;

    const badge = String(c.badge ?? '').trim().slice(0, 40);
    const title = String(c.title ?? '').trim().slice(0, 80);
    const subtitle = String(c.subtitle ?? '').trim().slice(0, 160);
    const rows = (Array.isArray(c.rows) ? c.rows : [])
      .slice(0, 6)
      .map((r: any) => ({ label: String(r?.label ?? '').trim().slice(0, 50), value: String(r?.value ?? '').trim().slice(0, 50) }))
      .filter((r: { label: string; value: string }) => r.label || r.value);

    const pct = num(c.progressPct, -1, 0, 100);
    const progressLabel = String(c.progressLabel ?? '').trim().slice(0, 40);
    const progress =
      pct >= 0 && progressLabel
        ? `<div class="bk-ic-p"><div class="bk-ic-pl"><span style="color:${muted}">${esc(progressLabel)}</span><span>${esc(String(c.progressValue ?? `${pct} %`).slice(0, 20))}</span></div>` +
          `<div class="bk-ic-bar"><i style="width:${pct}%;background:${safeColor(c.progressColor, '#22c55e')}"></i></div></div>`
        : '';

    const figure = String(c.figure ?? '').trim().slice(0, 24);
    const figureHtml = figure
      ? `<div class="bk-ic-f"><b style="color:${safeColor(c.figureColor, text)}">${esc(figure)}</b>` +
        (c.figureCaption ? `<span style="color:${muted}">${esc(String(c.figureCaption).slice(0, 40))}</span>` : '') +
        `</div>`
      : '';

    const ctaText = String(c.ctaText ?? '').trim().slice(0, 40);
    const ctaHref = ctaText ? safeUrl(c.ctaUrl || '/products') : '';
    const cta =
      ctaText && ctaHref
        ? `<a class="bk-ic-b" href="${esc(ctaHref)}" style="background:${safeColor(c.ctaBg, '#0f172a')};color:${safeColor(c.ctaColor, '#ffffff')}">${esc(ctaText)}</a>`
        : '';

    return (
      `<div class="bk bk-ic al-${align[0]}" style="${wrap}">` +
      `<div class="bk-ic-c${style === 'glass' ? ' gl' : ''}" style="${card}">` +
      (badge ? `<span class="bk-ic-bd" style="color:${safeColor(c.badgeColor, '#16a34a')}">${esc(badge)}</span>` : '') +
      (title ? `<h3>${esc(title)}</h3>` : '') +
      (subtitle ? `<p class="bk-ic-s" style="color:${muted}">${esc(subtitle)}</p>` : '') +
      rows.map((r: { label: string; value: string }) => `<div class="bk-ic-r"><span style="color:${muted}">${esc(r.label)}</span><b>${esc(r.value)}</b></div>`).join('') +
      progress +
      figureHtml +
      cta +
      `</div></div>`
    );
  },
};
