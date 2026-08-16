import { esc, safeUrl, num } from '../escape.js';
import type { BlockRenderer, BlockContext } from './types.js';

/**
 * Ported from BlockRenderer.tsx `case 'image'` (lines 123-155).
 *
 * Two deliberate differences from the React version, both improvements:
 *
 *  - `minHeight: 200px` is dropped in favour of real width/height attributes
 *    probed at compile time. The React version reserves 200px for every image
 *    regardless of its true aspect ratio, which itself causes a layout shift
 *    when a taller image arrives. Real dimensions remove the shift entirely.
 *  - `decoding` is `sync` on the first image rather than `async`, so the LCP
 *    element is not deferred behind other decode work.
 *
 * Everything else — the percentage width, maxHeight, the padding/margin
 * contract, eager loading for the first two blocks — matches.
 */
export const imageBlock: BlockRenderer = {
  type: 'image',

  css:
    `.bk-img{display:flex;justify-content:center;margin-left:auto;margin-right:auto}` +
    `.bk-img img{object-fit:contain;height:auto}`,

  render(block: any, ctx: BlockContext): string {
    const content = block?.content || {};

    const style =
      `padding-top:${num(content.paddingTop, 0, 0, 400)}px;` +
      `padding-bottom:${num(content.paddingBottom, 0, 0, 400)}px;` +
      `margin-top:${num(content.marginTop, 0, -200, 400)}px;` +
      `margin-bottom:${num(content.marginBottom, 0, -200, 400)}px`;

    const url = safeUrl(content.url, { allowDataImage: true });
    if (!url) {
      // The builder shows a dashed placeholder here. A live page should not, so
      // an image block with no source renders nothing rather than a grey box.
      return `<div class="bk bk-img" style="${style}"></div>`;
    }

    const widthPct = content.width ? `${num(content.width, 100, 1, 100)}%` : '100%';
    const maxHeight = content.maxHeight
      ? `max-height:${num(content.maxHeight, 0, 1, 4000)}px;`
      : '';

    const isFirst = ctx.index === 0;
    const eager = ctx.index < 2;

    const dims = ctx.probeImage(url);
    const sizeAttrs = dims ? ` width="${dims.width}" height="${dims.height}"` : '';
    // Without intrinsic dimensions there is nothing to reserve space with, so
    // fall back to the aspect-ratio-free behaviour rather than guessing.
    const ratio = dims ? `aspect-ratio:${dims.width}/${dims.height};` : '';

    const imgStyle = `width:${widthPct};${maxHeight}${ratio}`;

    return (
      `<div class="bk bk-img" style="${style}">` +
      `<img src="${esc(url)}" alt="${esc(content.alt || '')}"${sizeAttrs}` +
      ` loading="${eager ? 'eager' : 'lazy'}"` +
      ` fetchpriority="${isFirst ? 'high' : 'auto'}"` +
      ` decoding="${isFirst ? 'sync' : 'async'}"` +
      ` style="${imgStyle}">` +
      `</div>`
    );
  },
};
