import { esc, safeColor, num, oneOf } from '../escape.js';
import type { BlockRenderer, BlockContext } from './types.js';

/**
 * Ported from BlockRenderer.tsx `case 'text'` — a paragraph or a section
 * heading, aligned two ways.
 *
 * Preserved as shipped: the default colour differs between the heading
 * (#111827) and the paragraph (#374151); the box is at least 80px tall unless
 * the text sits at the top; the paragraph repeats `text-align` on itself.
 *
 * The type scale, weight, uppercase and tracking fields are opt-in: a block
 * without them compiles to the markup it always did.
 */
const VALIGN = { top: 'flex-start', center: 'center', bottom: 'flex-end' } as const;

export const textBlock: BlockRenderer = {
  type: 'text',

  css:
    `.bk-tx{max-width:896px;margin-left:auto;margin-right:auto;padding-left:24px;` +
    `padding-right:24px;display:flex;flex-direction:column}` +
    `.bk-tx h3{font-size:24px;line-height:32px;font-weight:700;margin:0 0 8px}` +
    `.bk-tx p{font-size:16px;line-height:1.625;margin:0}` +
    // Type scale, both for a heading and for a paragraph.
    `.bk-tx.sz-sm h3{font-size:20px;line-height:28px}.bk-tx.sz-sm p{font-size:14px}` +
    `.bk-tx.sz-lg h3{font-size:32px;line-height:40px}.bk-tx.sz-lg p{font-size:18px;line-height:1.7}` +
    `.bk-tx.sz-xl h3{font-size:36px;line-height:1.15}@media(min-width:768px){.bk-tx.sz-xl h3{font-size:44px}}.bk-tx.sz-xl p{font-size:20px;line-height:1.65}` +
    `.bk-tx.w-n h3,.bk-tx.w-n p{font-weight:400}.bk-tx.w-m h3,.bk-tx.w-m p{font-weight:500}` +
    `.bk-tx.w-b h3,.bk-tx.w-b p{font-weight:700}.bk-tx.w-k h3,.bk-tx.w-k p{font-weight:900}` +
    `.bk-tx.up h3,.bk-tx.up p{text-transform:uppercase}` +
    `.bk-tx.tr-w h3,.bk-tx.tr-w p{letter-spacing:.14em}.bk-tx.tr-t h3,.bk-tx.tr-t p{letter-spacing:-.02em}`,

  render(block: any, _ctx: BlockContext): string {
    const c = block?.content || {};
    const align = oneOf(c.align, ['left', 'center', 'right'] as const, 'left');
    const valign = oneOf(c.verticalAlign, ['top', 'center', 'bottom'] as const, 'center');
    const size = oneOf(c.size, ['sm', 'md', 'lg', 'xl'] as const, 'md');
    const weight = oneOf(c.weight, ['normal', 'medium', 'bold', 'black'] as const, '' as any);
    const tracking = oneOf(c.tracking, ['tight', 'normal', 'wide'] as const, 'normal');
    const style =
      `text-align:${align};justify-content:${VALIGN[valign]};` +
      `min-height:${valign !== 'top' ? '80px' : 'auto'};` +
      `padding-top:${num(c.paddingTop, 16, 0, 500)}px;padding-bottom:${num(c.paddingBottom, 16, 0, 500)}px;` +
      `margin-top:${num(c.marginTop, 0, -200, 500)}px;margin-bottom:${num(c.marginBottom, 0, -200, 500)}px`;

    const classes =
      'bk bk-tx' +
      (size !== 'md' ? ` sz-${size}` : '') +
      (weight === 'normal' ? ' w-n' : weight === 'medium' ? ' w-m' : weight === 'bold' ? ' w-b' : weight === 'black' ? ' w-k' : '') +
      (c.uppercase ? ' up' : '') +
      (tracking === 'wide' ? ' tr-w' : tracking === 'tight' ? ' tr-t' : '');

    const text = String(c.text ?? '').trim();
    const inner = c.isHeading
      ? `<h3 style="color:${safeColor(c.color, '#111827')}">${esc(text || 'Section Heading')}</h3>`
      : `<p style="color:${safeColor(c.color, '#374151')};text-align:${align}">` +
        esc(text || 'Add some descriptive text here to explain the product details and benefits.') +
        `</p>`;

    return `<div class="${classes}" style="${style}">${inner}</div>`;
  },
};
