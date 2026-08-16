import { esc, safeColor, num } from '../escape.js';
import type { BlockRenderer, BlockContext } from './types.js';

/**
 * Ported from BlockRenderer.tsx `case 'hero'` (:74) — a centred headline and
 * subheadline on a coloured band.
 *
 * Unlike most blocks the band is full-bleed inside the page column and its own
 * background is the point, so the padding defaults are large (48px) and the
 * bottom margin is 24px rather than the usual 0.
 *
 * The placeholder copy is deliberately kept. React renders "Headline goes here"
 * for an empty title, so a block saved without one looks the same compiled as it
 * does in the builder — dropping the text would silently change the page.
 */
export const heroBlock: BlockRenderer = {
  type: 'hero',

  css:
    `.bk-hero{width:100%;padding-left:24px;padding-right:24px;text-align:center}` +
    // text-4xl + leading-tight, going to text-5xl at the md breakpoint. The
    // explicit line-height matters: text-4xl carries its own 2.5rem, and
    // leading-tight overrides it in both sizes.
    `.bk-hero h2{font-size:36px;line-height:1.25;font-weight:900;margin:0 0 16px}` +
    `.bk-hero p{font-size:18px;line-height:1.75rem;max-width:672px;margin:0 auto}` +
    `@media(min-width:768px){.bk-hero h2{font-size:48px}.bk-hero p{font-size:20px}}`,

  render(block: any, _ctx: BlockContext): string {
    const c = block?.content || {};

    const style =
      `background:${safeColor(c.bgColor, '#f9fafb')};` +
      `padding-top:${num(c.paddingTop, 48, 0, 400)}px;` +
      `padding-bottom:${num(c.paddingBottom, 48, 0, 400)}px;` +
      `margin-top:${num(c.marginTop, 0, -200, 400)}px;` +
      `margin-bottom:${num(c.marginBottom, 24, -200, 400)}px`;

    const title = String(c.title || 'Headline goes here');
    const subtitle = String(c.subtitle || 'Subheadline goes here to explain the offer.');

    return (
      `<div class="bk bk-hero" style="${style}">` +
      `<h2 style="color:${safeColor(c.titleColor, '#111827')}">${esc(title)}</h2>` +
      `<p style="color:${safeColor(c.subtitleColor, '#4b5563')}">${esc(subtitle)}</p>` +
      `</div>`
    );
  },
};
