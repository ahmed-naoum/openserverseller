import { esc, safeColor, safeBackground, safeUrl, num, oneOf } from '../escape.js';
import type { BlockRenderer, BlockContext } from './types.js';

/**
 * The hero, compiled.
 *
 * Started as a port of BlockRenderer.tsx `case 'hero'` — a centred headline
 * and subheadline on a coloured band — and grew the fields the store themes
 * need to reproduce real storefront designs: a photograph or gradient behind
 * the copy with an overlay, left alignment, a giant serif option, a word of
 * the title in the brand colour, and buttons inline under the copy.
 *
 * Every field is opt-in: a block without them compiles to the markup it
 * always did, and the placeholder copy is kept for the same reason React
 * keeps it — a block saved without a title looks the same compiled as it
 * does in the builder.
 */

/** The title with one phrase wrapped for colour, both halves escaped. */
function titleHtml(title: string, highlight: string, colour: string, style: 'color' | 'underline' | 'mark' = 'color'): string {
  const phrase = highlight.trim();
  if (!phrase) return esc(title);
  const at = title.toLowerCase().indexOf(phrase.toLowerCase());
  if (at === -1) return esc(title);
  return (
    esc(title.slice(0, at)) +
    (style === 'underline'
      ? `<span class="bk-hero-hl hl-u" style="background-image:linear-gradient(${colour},${colour})">${esc(title.slice(at, at + phrase.length))}</span>`
      : style === 'mark'
        ? `<span class="bk-hero-hl hl-m" style="background:${colour}">${esc(title.slice(at, at + phrase.length))}</span>`
        : `<span class="bk-hero-hl" style="color:${colour}">${esc(title.slice(at, at + phrase.length))}</span>`) +
    esc(title.slice(at + phrase.length))
  );
}

export const heroBlock: BlockRenderer = {
  type: 'hero',

  css:
    `.bk-hero{width:100%;padding-left:24px;padding-right:24px;text-align:center;position:relative;overflow:hidden}` +
    // text-4xl + leading-tight, going to text-5xl at the md breakpoint.
    `.bk-hero h2{font-size:36px;line-height:1.25;font-weight:900;margin:0 0 16px}` +
    `.bk-hero p{font-size:18px;line-height:1.75rem;max-width:672px;margin:0 auto}` +
    `@media(min-width:768px){.bk-hero h2{font-size:48px}.bk-hero p{font-size:20px}}` +
    // Alignment: the copy column follows, and the paragraph stops centring.
    `.bk-hero.al-l{text-align:left}.bk-hero.al-l p{margin-left:0}` +
    `.bk-hero.al-r{text-align:right}.bk-hero.al-r p{margin-right:0}` +
    `.bk-hero-in{margin:0 auto;width:100%;position:relative}.bk-hero.al-l .bk-hero-in{margin-left:0}.bk-hero.al-r .bk-hero-in{margin-right:0}` +
    // Type scale.
    `.bk-hero.sz-md h2{font-size:28px}@media(min-width:768px){.bk-hero.sz-md h2{font-size:36px}}` +
    `.bk-hero.sz-xl h2{font-size:40px;line-height:1.08}@media(min-width:768px){.bk-hero.sz-xl h2{font-size:60px}}` +
    `.bk-hero.sz-2xl h2{font-size:44px;line-height:1.02;letter-spacing:-.02em}@media(min-width:768px){.bk-hero.sz-2xl h2{font-size:76px}}` +
    `.bk-hero.up h2{text-transform:uppercase;letter-spacing:.02em}` +
    `.bk-hero.serif h2{font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-weight:700}` +
    // The kicker: a short label above the title, three ways.
    `.bk-hero-k{display:inline-block;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;margin:0 0 14px}` +
    `.bk-hero-k.k-pill{padding:6px 14px;border-radius:999px;border:1px solid currentColor}` +
    `.bk-hero-k.k-line{padding-left:36px;position:relative}.bk-hero-k.k-line::before{content:"";position:absolute;left:0;top:50%;width:26px;height:2px;background:currentColor}` +
    `.bk-hero:not(.al-l):not(.al-r) .bk-hero-k.k-line{padding-left:0}.bk-hero:not(.al-l):not(.al-r) .bk-hero-k.k-line::before{display:none}` +
    // A photograph behind the copy, and the colour laid over it.
    `.bk-hero-bg{position:absolute;inset:0;background-size:cover;background-position:center}` +
    `.bk-hero-ov{position:absolute;inset:0}` +
    // A minimum height centres the copy vertically.
    `.bk-hero.mh{display:flex;align-items:center}` +
    // Buttons under the copy.
    `.bk-hero-cta{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:26px}` +
    `.bk-hero.al-l .bk-hero-cta{justify-content:flex-start}.bk-hero.al-r .bk-hero-cta{justify-content:flex-end}` +
    `.bk-hero-b{display:inline-flex;align-items:center;justify-content:center;padding:14px 28px;font-weight:800;font-size:15px;` +
    `line-height:1.2;text-decoration:none;border:2px solid transparent;transition:transform .15s,opacity .15s;font-family:inherit}` +
    `.bk-hero-b:hover{opacity:.92}.bk-hero-b:active{transform:scale(.98)}` +
    `.bk-hero-b.o{background:transparent!important;border-color:currentColor}` +
    `.bk-hero-b.l{background:transparent!important;padding-left:6px;padding-right:6px;text-decoration:underline;text-underline-offset:5px}` +
    // The highlighted phrase: a brush-stroke underline, or a marker band.
    `.bk-hero-hl.hl-u{background-repeat:no-repeat;background-size:100% .22em;background-position:0 92%;padding:0 .04em}` +
    `.bk-hero-hl.hl-m{padding:0 .18em;border-radius:.2em;color:#fff}`,

  render(block: any, _ctx: BlockContext): string {
    const c = block?.content || {};

    const align = oneOf(c.align, ['left', 'center', 'right'] as const, 'center');
    const size = oneOf(c.titleSize, ['md', 'lg', 'xl', '2xl'] as const, 'lg');
    const radius = num(c.radius, 0, 0, 200);
    const maxWidth = num(c.maxWidth, 0, 0, 1600);
    const minHeight = num(c.minHeight, 0, 0, 1400);
    const bgImage = c.bgImage ? safeUrl(c.bgImage) : '';

    const style =
      `background:${safeBackground(c.bgColor, '#f9fafb')};` +
      `padding-top:${num(c.paddingTop, 48, 0, 400)}px;` +
      `padding-bottom:${num(c.paddingBottom, 48, 0, 400)}px;` +
      `margin-top:${num(c.marginTop, 0, -200, 400)}px;` +
      `margin-bottom:${num(c.marginBottom, 24, -200, 400)}px` +
      (radius ? `;border-radius:${radius}px` : '') +
      (minHeight ? `;min-height:${minHeight}px` : '');

    const classes =
      'bk bk-hero' +
      (align === 'left' ? ' al-l' : align === 'right' ? ' al-r' : '') +
      (size !== 'lg' ? ` sz-${size}` : '') +
      (c.uppercase ? ' up' : '') +
      (c.titleFont === 'serif' ? ' serif' : '') +
      (minHeight ? ' mh' : '');

    const titleColor = safeColor(c.titleColor, '#111827');
    const title = String(c.title || 'Headline goes here');
    const subtitle = String(c.subtitle || 'Subheadline goes here to explain the offer.');
    const kickerText = String(c.kicker ?? '').trim().slice(0, 80);
    const kickerStyle = oneOf(c.kickerStyle, ['plain', 'pill', 'line'] as const, 'plain');
    const kicker = kickerText
      ? `<span class="bk-hero-k${kickerStyle === 'plain' ? '' : ` k-${kickerStyle}`}" style="color:${safeColor(c.kickerColor, titleColor)}">${esc(kickerText)}</span>`
      : '';

    // The photograph and its overlay sit under the copy. The overlay is
    // rendered whenever there is a picture, defaulting to a soft darkening,
    // because white type on an unknown photograph is unreadable half the time.
    const backdrop = bgImage
      ? `<div class="bk-hero-bg" style="background-image:url(&quot;${esc(bgImage)}&quot;)"></div>` +
        `<div class="bk-hero-ov" style="background:${safeBackground(c.overlayColor, 'rgba(10,12,20,0.45)')}"></div>`
      : '';

    // Buttons. The primary reads the brand colour; the secondary is an
    // outline in the title colour unless told otherwise.
    const ctaText = String(c.ctaText ?? '').trim().slice(0, 48);
    const ctaHref = ctaText ? safeUrl(c.ctaUrl || '/products') : '';
    const ctaRadius = num(c.ctaRadius, 12, 0, 999);
    const secondaryText = String(c.secondaryText ?? '').trim().slice(0, 48);
    const secondaryHref = secondaryText ? safeUrl(c.secondaryUrl || '/products') : '';
    const secondaryStyle = oneOf(c.secondaryStyle, ['outline', 'link', 'filled'] as const, 'outline');
    const buttons: string[] = [];
    if (ctaText && ctaHref) {
      buttons.push(
        `<a class="bk-hero-b" href="${esc(ctaHref)}" style="background:${safeColor(c.ctaBg, '#ea580c')};` +
          `color:${safeColor(c.ctaColor, '#ffffff')};border-radius:${ctaRadius}px">${esc(ctaText)}</a>`
      );
    }
    if (secondaryText && secondaryHref) {
      const colour = safeColor(c.secondaryColor, titleColor);
      const cls = secondaryStyle === 'link' ? ' l' : secondaryStyle === 'outline' ? ' o' : '';
      const fill = secondaryStyle === 'filled' ? `background:${colour};color:${safeColor(c.ctaColor, '#ffffff')};` : `color:${colour};`;
      buttons.push(`<a class="bk-hero-b${cls}" href="${esc(secondaryHref)}" style="${fill}border-radius:${ctaRadius}px">${esc(secondaryText)}</a>`);
    }
    const ctas = buttons.length ? `<div class="bk-hero-cta">${buttons.join('')}</div>` : '';

    const inner =
      kicker +
      `<h2 style="color:${titleColor}">${titleHtml(title, String(c.highlight ?? ''), safeColor(c.highlightColor, '#ea580c'), oneOf(c.highlightStyle, ['color', 'underline', 'mark'] as const, 'color'))}</h2>` +
      `<p style="color:${safeColor(c.subtitleColor, '#4b5563')}">${esc(subtitle)}</p>` +
      ctas;

    return (
      `<div class="${classes}" style="${style}">` +
      backdrop +
      `<div class="bk-hero-in"${maxWidth ? ` style="max-width:${maxWidth}px"` : ''}>${inner}</div>` +
      `</div>`
    );
  },
};
