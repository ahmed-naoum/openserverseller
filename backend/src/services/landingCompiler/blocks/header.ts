import { esc, safeColor, num } from '../escape.js';
import type { BlockRenderer, BlockContext } from './types.js';

/**
 * Ported from BlockRenderer.tsx `case 'header'` — the original brand bar, a
 * name on a coloured strip. Not the page header; that is `site_header`.
 *
 * Preserved as shipped: the React default bottom margin is 4px, not 0, and the
 * bar carries a small shadow.
 */
export const headerBlock: BlockRenderer = {
  type: 'header',

  css:
    `.bk-hd{box-shadow:0 1px 2px 0 rgba(0,0,0,.05)}` +
    `.bk-hd-in{max-width:896px;margin:0 auto;display:flex;align-items:center;` +
    `justify-content:space-between;padding:0 24px}` +
    `.bk-hd h1{font-size:20px;line-height:28px;font-weight:900;margin:0}`,

  render(block: any, _ctx: BlockContext): string {
    const c = block?.content || {};
    const style =
      `background:${safeColor(c.bgColor, '#ffffff')};` +
      `padding-top:${num(c.paddingTop, 16, 0, 500)}px;padding-bottom:${num(c.paddingBottom, 16, 0, 500)}px;` +
      `margin-top:${num(c.marginTop, 0, -200, 500)}px;margin-bottom:${num(c.marginBottom, 4, -200, 500)}px`;
    const text = String(c.text ?? '').trim() || 'My Brand';
    return (
      `<header class="bk bk-hd" style="${style}"><div class="bk-hd-in">` +
      `<h1 style="color:${safeColor(c.color, '#111827')}">${esc(text)}</h1>` +
      `</div></header>`
    );
  },
};
