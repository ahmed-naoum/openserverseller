import { esc, safeColor, safeUrl, num, oneOf } from '../escape.js';
import type { BlockRenderer, BlockContext } from './types.js';

/** One testimonial, large. */
export const quoteBlock: BlockRenderer = {
  type: 'quote',

  css:
    `.bk-q{width:100%;padding-left:24px;padding-right:24px;text-align:center}` +
    `.bk-q.al-l{text-align:left}` +
    `.bk-q-in{margin:0 auto;width:100%}.bk-q.al-l .bk-q-in{margin-left:0}` +
    `.bk-q-k{display:inline-block;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;margin-bottom:14px;opacity:.8}` +
    `.bk-q-s{font-size:16px;letter-spacing:2px;margin-bottom:12px}` +
    `.bk-q blockquote{margin:0;font-size:24px;line-height:1.35;font-weight:700}` +
    `.bk-q.sz-md blockquote{font-size:20px}.bk-q.sz-xl blockquote{font-size:30px}` +
    `@media(min-width:768px){.bk-q blockquote{font-size:30px}.bk-q.sz-md blockquote{font-size:22px}.bk-q.sz-xl blockquote{font-size:40px;line-height:1.25}}` +
    `.bk-q.serif blockquote{font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-weight:500;font-style:italic}` +
    `.bk-q-a{display:flex;align-items:center;gap:12px;justify-content:center;margin-top:18px;font-size:14px}` +
    `.bk-q.al-l .bk-q-a{justify-content:flex-start}` +
    `.bk-q-a img{width:44px;height:44px;border-radius:999px;object-fit:cover}` +
    `.bk-q-a b{display:block;font-weight:800}.bk-q-a span{display:block;font-size:13px}`,

  render(block: any, _ctx: BlockContext): string {
    const c = block?.content || {};
    const align = oneOf(c.align, ['left', 'center'] as const, 'center');
    const size = oneOf(c.size, ['md', 'lg', 'xl'] as const, 'lg');
    const text = safeColor(c.textColor, '#0f172a');
    const muted = safeColor(c.mutedColor, '#64748b');
    const stars = num(c.stars, 5, 0, 5);
    const maxWidth = num(c.maxWidth, 820, 280, 1400);
    const avatar = c.avatarUrl ? safeUrl(c.avatarUrl) : '';
    const style =
      `padding-top:${num(c.paddingTop, 24, 0, 400)}px;padding-bottom:${num(c.paddingBottom, 24, 0, 400)}px;` +
      `margin-top:${num(c.marginTop, 0, -200, 400)}px;margin-bottom:${num(c.marginBottom, 0, -200, 400)}px`;
    const sentence = String(c.text ?? '').trim().slice(0, 400);
    const author = String(c.author ?? '').trim().slice(0, 60);
    const role = String(c.role ?? '').trim().slice(0, 60);
    const kicker = String(c.kicker ?? '').trim().slice(0, 60);

    return (
      `<div class="bk bk-q al-${align[0]} sz-${size}${c.serif ? ' serif' : ''}" style="${style}">` +
      `<div class="bk-q-in" style="max-width:${maxWidth}px">` +
      (kicker ? `<span class="bk-q-k" style="color:${muted}">${esc(kicker)}</span>` : '') +
      (stars > 0 ? `<div class="bk-q-s" style="color:${safeColor(c.starColor, '#f59e0b')}" aria-label="${stars} sur 5">${'★'.repeat(stars)}</div>` : '') +
      `<blockquote style="color:${text}">« ${esc(sentence || 'Absolument délicieux !')} »</blockquote>` +
      (author || role
        ? `<div class="bk-q-a">` +
          (avatar ? `<img src="${esc(avatar)}" alt="${esc(author)}" loading="lazy">` : '') +
          `<div>${author ? `<b style="color:${text}">${esc(author)}</b>` : ''}${role ? `<span style="color:${muted}">${esc(role)}</span>` : ''}</div></div>`
        : '') +
      `</div></div>`
    );
  },
};
