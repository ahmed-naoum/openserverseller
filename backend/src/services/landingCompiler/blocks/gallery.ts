import { esc, safeColor, safeUrl, num, oneOf } from '../escape.js';
import type { BlockRenderer, BlockContext } from './types.js';

/** Photos in a grid; double tiles make a mosaic. Tiles without a picture are skipped. */
export const galleryBlock: BlockRenderer = {
  type: 'gallery',

  css:
    `.bk-ga{width:100%;padding-left:16px;padding-right:16px}` +
    `.bk-ga-g{display:grid;width:100%;grid-auto-flow:dense}` +
    `.bk-ga-t{position:relative;overflow:hidden;display:block;background:#f1f5f9}` +
    `.bk-ga-t img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s}` +
    `.bk-ga.hv-z .bk-ga-t:hover img{transform:scale(1.05)}` +
    `.bk-ga.hv-l .bk-ga-t{transition:transform .3s,box-shadow .3s}.bk-ga.hv-l .bk-ga-t:hover{transform:translateY(-4px);box-shadow:0 14px 30px -12px rgba(0,0,0,.35)}` +
    `.bk-ga-c{position:absolute;left:0;right:0;bottom:0;padding:10px 14px;font-size:13px;font-weight:700}` +
    `.bk-ga-t.s2{grid-column:span 2}.bk-ga-t.r2{grid-row:span 2}` +
    `@media(max-width:639px){.bk-ga-g{grid-template-columns:1fr 1fr!important}.bk-ga-t.s2{grid-column:span 2}}`,

  render(block: any, _ctx: BlockContext): string {
    const c = block?.content || {};
    const cols = num(c.columns, 4, 1, 6);
    const gap = num(c.gap, 12, 0, 60);
    const radius = num(c.radius, 16, 0, 200);
    const rowHeight = num(c.rowHeight, 220, 80, 900);
    const hover = oneOf(c.hover, ['none', 'zoom', 'lift'] as const, 'zoom');
    const wrap =
      `padding-top:${num(c.paddingTop, 8, 0, 400)}px;padding-bottom:${num(c.paddingBottom, 8, 0, 400)}px;` +
      `margin-top:${num(c.marginTop, 0, -200, 400)}px;margin-bottom:${num(c.marginBottom, 0, -200, 400)}px`;

    const tiles = (Array.isArray(c.images) ? c.images : [])
      .slice(0, 24)
      .map((im: any) => ({
        url: im?.url ? safeUrl(im.url) : '',
        alt: String(im?.alt ?? '').slice(0, 120),
        caption: String(im?.caption ?? '').trim().slice(0, 80),
        href: im?.href ? safeUrl(im.href) : '',
        span: num(im?.span, 1, 1, 2),
        rows: num(im?.rows, 1, 1, 2),
      }))
      .filter((t: { url: string }) => t.url);
    if (!tiles.length) return `<div class="bk bk-ga" style="${wrap}"></div>`;

    const captionColor = safeColor(c.captionColor, '#ffffff');
    const captionBg = safeColor(c.captionBg, 'rgba(0,0,0,0.45)');
    const html = tiles
      .map((t: any, i: number) => {
        const cls = `bk-ga-t${t.span === 2 ? ' s2' : ''}${t.rows === 2 ? ' r2' : ''}`;
        const inner =
          `<img src="${esc(t.url)}" alt="${esc(t.alt)}" loading="${i < 2 ? 'eager' : 'lazy'}">` +
          (t.caption ? `<span class="bk-ga-c" style="color:${captionColor};background:${captionBg}">${esc(t.caption)}</span>` : '');
        return t.href
          ? `<a class="${cls}" href="${esc(t.href)}" style="border-radius:${radius}px">${inner}</a>`
          : `<div class="${cls}" style="border-radius:${radius}px">${inner}</div>`;
      })
      .join('');

    return (
      `<div class="bk bk-ga${hover === 'zoom' ? ' hv-z' : hover === 'lift' ? ' hv-l' : ''}" style="${wrap}">` +
      `<div class="bk-ga-g" style="grid-template-columns:repeat(${cols},1fr);gap:${gap}px;grid-auto-rows:${rowHeight}px">${html}</div>` +
      `</div>`
    );
  },
};
