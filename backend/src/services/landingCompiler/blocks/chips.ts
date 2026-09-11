import { esc, safeColor, safeUrl, num, oneOf } from '../escape.js';
import type { BlockRenderer, BlockContext } from './types.js';

/** A row of small labels, linked or not. */
export const chipsBlock: BlockRenderer = {
  type: 'chips',

  css:
    `.bk-ch{width:100%;padding-left:24px;padding-right:24px;display:flex;flex-wrap:wrap;align-items:center;gap:8px;justify-content:center}` +
    `.bk-ch.al-l{justify-content:flex-start}.bk-ch.al-r{justify-content:flex-end}` +
    `.bk-ch-p{font-size:12px;font-weight:700;opacity:.65;margin-right:4px}` +
    `.bk-ch-i{display:inline-flex;align-items:center;padding:7px 14px;border-radius:999px;font-size:13px;font-weight:700;text-decoration:none;border:1px solid transparent;line-height:1.2}` +
    `.bk-ch.sz-sm .bk-ch-i{padding:5px 10px;font-size:12px}` +
    `.bk-ch.up .bk-ch-i{text-transform:uppercase;letter-spacing:.08em;font-size:11px}` +
    `.bk-ch.st-t .bk-ch-i{padding:2px 0;border:0;background:transparent!important}` +
    `.bk-ch.st-t .bk-ch-i+.bk-ch-i::before{content:"·";margin-right:10px;opacity:.5}` +
    `a.bk-ch-i:hover{opacity:.85}`,

  render(block: any, _ctx: BlockContext): string {
    const c = block?.content || {};
    const style = oneOf(c.style, ['pill', 'outline', 'text'] as const, 'pill');
    const align = oneOf(c.align, ['left', 'center', 'right'] as const, 'center');
    const size = oneOf(c.size, ['sm', 'md'] as const, 'md');
    const text = safeColor(c.textColor, '#0f172a');
    const bg = style === 'pill' ? safeColor(c.bgColor, '#f1f5f9') : 'transparent';
    const border = style === 'outline' ? safeColor(c.borderColor, safeColor(c.textColor, '#e2e8f0')) : style === 'pill' ? safeColor(c.borderColor, 'transparent') : 'transparent';
    const wrap =
      `padding-top:${num(c.paddingTop, 8, 0, 400)}px;padding-bottom:${num(c.paddingBottom, 8, 0, 400)}px;` +
      `margin-top:${num(c.marginTop, 0, -200, 400)}px;margin-bottom:${num(c.marginBottom, 0, -200, 400)}px`;

    const items = (Array.isArray(c.items) ? c.items : [])
      .slice(0, 16)
      .map((it: any) => ({ label: String(it?.label ?? '').trim().slice(0, 40), url: it?.url ? safeUrl(it.url) : '' }))
      .filter((it: { label: string }) => it.label);
    if (!items.length) return `<div class="bk bk-ch" style="${wrap}"></div>`;

    const chipStyle = `background:${bg};color:${text};border-color:${border}`;
    const prefix = String(c.prefix ?? '').trim().slice(0, 30);
    return (
      `<div class="bk bk-ch al-${align[0]} sz-${size} st-${style[0]}${c.uppercase ? ' up' : ''}" style="${wrap}">` +
      (prefix ? `<span class="bk-ch-p" style="color:${text}">${esc(prefix)}</span>` : '') +
      items
        .map((it: { label: string; url: string }) =>
          it.url
            ? `<a class="bk-ch-i" href="${esc(it.url)}" style="${chipStyle}">${esc(it.label)}</a>`
            : `<span class="bk-ch-i" style="${chipStyle}">${esc(it.label)}</span>`
        )
        .join('') +
      `</div>`
    );
  },
};
