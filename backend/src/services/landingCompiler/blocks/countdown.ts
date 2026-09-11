import { esc, num } from '../escape.js';
import type { BlockRenderer, BlockContext } from './types.js';

/**
 * Ported from BlockRenderer.tsx `case 'countdown'` — an urgency banner.
 *
 * Static, exactly as React draws it: the "countdown" is a line of text the
 * seller writes, and the React block never ticked either. Making it count for
 * real would change what visitors see, which is a product decision and a
 * runtime, not a port.
 */
export const countdownBlock: BlockRenderer = {
  type: 'countdown',

  css:
    `.bk-cd{display:flex;justify-content:center}` +
    `.bk-cd-in{display:inline-flex;align-items:center;gap:12px;background:#fef2f2;color:#dc2626;` +
    `padding:12px 24px;border-radius:16px;border:1px solid #fee2e2;` +
    `box-shadow:0 1px 2px 0 rgba(0,0,0,.05);font-weight:900;font-size:20px;line-height:28px}`,

  render(block: any, _ctx: BlockContext): string {
    const c = block?.content || {};
    const style =
      `padding-top:${num(c.paddingTop, 24, 0, 500)}px;padding-bottom:${num(c.paddingBottom, 24, 0, 500)}px;` +
      `margin-top:${num(c.marginTop, 0, -200, 500)}px;margin-bottom:${num(c.marginBottom, 0, -200, 500)}px`;
    const text = String(c.text ?? '').trim() || "L'offre expire dans : 00:15:00";
    return `<div class="bk bk-cd" style="${style}"><div class="bk-cd-in"><span>⏳</span><span>${esc(text)}</span></div></div>`;
  },
};
