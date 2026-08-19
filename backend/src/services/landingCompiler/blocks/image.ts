import { esc, safeUrl, num } from '../escape.js';
import type { BlockRenderer, BlockContext, ImageDimensions } from './types.js';

/**
 * The candidate list, widest-last, with the original as the top candidate.
 *
 * Exported because head.ts must preload the LCP image with an `imagesrcset`
 * identical to this one. A mismatch is worse than no srcset at all: the preload
 * fetches the full-size file and the <img> then fetches a variant, so the page
 * downloads both.
 */
export function buildSrcset(url: string, dims: ImageDimensions | null): string {
  if (!dims?.variants?.length) return '';
  return [
    ...dims.variants.map((v) => `${v.url} ${v.width}w`),
    `${url} ${dims.width}w`,
  ].join(', ');
}

/**
 * What the browser needs to know to pick from that list before layout exists.
 *
 * The image sits in `.pg`, a centred column capped at `settings.maxWidth`
 * (default 640), so it is viewport-wide only until that cap. A bare `100vw`
 * would overstate the requirement on every desktop and hand back the savings.
 */
export function sizesFor(ctx: BlockContext, content: any): string {
  const pct = content?.width ? num(content.width, 100, 1, 100) : 100;
  const column = ctx.pageMaxWidth || 640;
  const capped = Math.round((column * pct) / 100);
  return pct === 100
    ? `(max-width:${column}px) 100vw, ${capped}px`
    : `(max-width:${column}px) ${pct}vw, ${capped}px`;
}

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

    const srcset = buildSrcset(url, dims);
    const responsive = srcset
      ? ` srcset="${esc(srcset)}" sizes="${esc(sizesFor(ctx, content))}"`
      : '';

    return (
      `<div class="bk bk-img" style="${style}">` +
      `<img src="${esc(url)}" alt="${esc(content.alt || '')}"${sizeAttrs}${responsive}` +
      ` loading="${eager ? 'eager' : 'lazy'}"` +
      ` fetchpriority="${isFirst ? 'high' : 'auto'}"` +
      ` decoding="${isFirst ? 'sync' : 'async'}"` +
      ` style="${imgStyle}">` +
      `</div>`
    );
  },
};
