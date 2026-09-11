import { esc, safeUrl, safeColor, num } from '../escape.js';
import type { BlockRenderer, BlockContext } from './types.js';

/**
 * The page's own footer: brand line, link columns, trust badges, social links,
 * copyright.
 *
 * The counterpart to siteHeader, and it exists for the same reason: chrome that
 * the storefront app wrapped around a compiled page dragged the whole React
 * bundle onto a page that needed none of it. Here it is markup and a stylesheet,
 * and it costs nothing to render.
 *
 * No runtime at all. A footer that needs script is a footer doing something it
 * should not.
 */

/** Beyond these the layout stops being a footer and starts being a sitemap. */
const MAX_COLUMNS = 4;
const MAX_LINKS_PER_COLUMN = 8;
const MAX_BADGES = 4;

interface FooterLink {
  label: string;
  url: string;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

/** Same rule as the header: fragments by pattern, everything else via safeUrl. */
function linkList(raw: unknown, limit: number): FooterLink[] {
  if (!Array.isArray(raw)) return [];
  const out: FooterLink[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const label = String((entry as any).label ?? '').trim().slice(0, 60);
    if (!label) continue;

    const rawUrl = String((entry as any).url ?? '').trim();
    const url = rawUrl.startsWith('#')
      ? (/^#[A-Za-z0-9_-]+$/.test(rawUrl) ? rawUrl : '')
      : safeUrl(rawUrl);
    if (!url) continue;

    out.push({ label, url });
    if (out.length >= limit) break;
  }

  return out;
}

function columns(raw: unknown): FooterColumn[] {
  if (!Array.isArray(raw)) return [];
  const out: FooterColumn[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const title = String((entry as any).title ?? '').trim().slice(0, 60);
    const links = linkList((entry as any).links, MAX_LINKS_PER_COLUMN);
    // A column with a heading and nothing under it is a gap in the grid, not a
    // column. Both halves have to survive for it to render.
    if (!title || !links.length) continue;

    out.push({ title, links });
    if (out.length >= MAX_COLUMNS) break;
  }

  return out;
}

/** The social platforms worth an icon, each as a single path. */
const SOCIALS: { key: string; label: string; path: string }[] = [
  {
    key: 'instagram',
    label: 'Instagram',
    path:
      'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5z' +
      'M16 11.4A4 4 0 1 1 12.6 8 4 4 0 0 1 16 11.4zM17.5 6.5h.01',
  },
  {
    key: 'facebook',
    label: 'Facebook',
    path: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z',
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    path:
      'M21 8.5a6.5 6.5 0 0 1-5-2.3V15a6 6 0 1 1-6-6c.3 0 .7 0 1 .1v3.2a2.8 2.8 0 1 0 2 2.7V2h3a6.5 6.5 0 0 0 5 5z',
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    path:
      'M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.2-5.3A8.5 8.5 0 1 1 21 11.5z',
  },
];

export const siteFooterBlock: BlockRenderer = {
  type: 'site_footer',

  css:
    `.bk-sf{width:100%}` +
    `.bk-sf-in{max-width:1152px;margin:0 auto;padding:0 16px}` +
    `.bk-sf-top{display:grid;gap:32px;grid-template-columns:1fr}` +
    `.bk-sf-brand{display:flex;flex-direction:column;gap:12px}` +
    `.bk-sf-brand img{display:block;width:auto;object-fit:contain}` +
    `.bk-sf-name{font-size:20px;font-weight:900;letter-spacing:-.02em;margin:0}` +
    `.bk-sf-about{font-size:13px;line-height:1.7;margin:0;max-width:44ch}` +
    `.bk-sf-col h4{font-size:11px;font-weight:900;text-transform:uppercase;` +
    `letter-spacing:.12em;margin:0 0 14px}` +
    `.bk-sf-col ul{list-style:none;margin:0;padding:0;display:flex;` +
    `flex-direction:column;gap:9px}` +
    `.bk-sf-col a{font-size:13px;font-weight:600;text-decoration:none;opacity:.75}` +
    `.bk-sf-col a:hover{opacity:1;text-decoration:underline}` +
    `.bk-sf-badges{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}` +
    `.bk-sf-badge{display:inline-flex;align-items:center;gap:6px;font-size:11px;` +
    `font-weight:800;padding:7px 12px;border-radius:999px;border:1px solid}` +
    `.bk-sf-soc{display:flex;gap:10px;margin-top:4px}` +
    `.bk-sf-soc a{display:inline-flex;align-items:center;justify-content:center;` +
    `width:38px;height:38px;border-radius:12px;border:1px solid;text-decoration:none}` +
    `.bk-sf-soc svg{width:18px;height:18px;display:block}` +
    `.bk-sf-bot{margin-top:36px;padding-top:20px;border-top:1px solid;` +
    `display:flex;flex-wrap:wrap;gap:10px;align-items:center;` +
    `justify-content:space-between;font-size:12px;font-weight:600}` +
    `.bk-sf-bot p{margin:0}` +
    `@media(min-width:640px){.bk-sf-top{grid-template-columns:repeat(2,1fr)}}` +
    `@media(min-width:1024px){` +
    `.bk-sf-top{grid-template-columns:1.4fr repeat(3,1fr)}` +
    `.bk-sf-in{padding:0 24px}}`,

  render(block: any, ctx: BlockContext): string {
    const c = block?.content || {};

    const bg = safeColor(c.bgColor, '#0f172a');
    const fg = safeColor(c.textColor, '#ffffff');
    // The quiet colour: link text, the blurb, the copyright line. Separate from
    // the heading colour so a light footer stays readable — inheriting one
    // colour for both is what makes a white-on-white footer.
    const muted = safeColor(c.mutedColor, 'rgba(255,255,255,0.7)');
    const line = safeColor(c.borderColor, 'rgba(255,255,255,0.14)');

    const padTop = num(c.paddingTop, 48, 0, 200);
    const padBottom = num(c.paddingBottom, 32, 0, 200);

    // ── brand column ──────────────────────────────────────────────────────
    const logoUrl = safeUrl(c.logoUrl);
    const logoHeight = num(c.logoHeight, 40, 16, 120);
    const dims = logoUrl ? ctx.probeImage(logoUrl) : null;
    const logoWidth =
      dims && dims.height > 0 ? Math.round((dims.width / dims.height) * logoHeight) : 0;
    const logo = logoUrl
      ? `<img src="${esc(logoUrl)}" alt="" style="height:${logoHeight}px"` +
        (logoWidth ? ` width="${logoWidth}" height="${logoHeight}"` : '') +
        ` loading="lazy" decoding="async">`
      : '';

    const brandText = String(c.brandText ?? '').trim().slice(0, 60);
    const about = String(c.about ?? '').trim().slice(0, 400);

    const badgeList = Array.isArray(c.badges)
      ? c.badges
          .map((b: unknown) => String(b ?? '').trim().slice(0, 40))
          .filter(Boolean)
          .slice(0, MAX_BADGES)
      : [];
    const badges = badgeList.length
      ? `<div class="bk-sf-badges">` +
        badgeList
          .map(
            (b: string) =>
              `<span class="bk-sf-badge" style="color:${muted};border-color:${line}">${esc(b)}</span>`
          )
          .join('') +
        `</div>`
      : '';

    const socialLinks = SOCIALS.map((s) => {
      const url = safeUrl((c.socials || {})[s.key]);
      if (!url) return '';
      return (
        `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" ` +
        `aria-label="${esc(s.label)}" style="color:${muted};border-color:${line}">` +
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ` +
        `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
        `<path d="${s.path}"/></svg></a>`
      );
    }).join('');
    const socials = socialLinks ? `<div class="bk-sf-soc">${socialLinks}</div>` : '';

    const brandColumn =
      logo || brandText || about || badges || socials
        ? `<div class="bk-sf-brand">` +
          logo +
          (brandText ? `<p class="bk-sf-name" style="color:${fg}">${esc(brandText)}</p>` : '') +
          (about ? `<p class="bk-sf-about" style="color:${muted}">${esc(about)}</p>` : '') +
          badges +
          socials +
          `</div>`
        : '';

    // ── link columns ──────────────────────────────────────────────────────
    const cols = columns(c.columns)
      .map(
        (col) =>
          `<div class="bk-sf-col"><h4 style="color:${fg}">${esc(col.title)}</h4><ul>` +
          col.links
            .map(
              (l) =>
                `<li><a href="${esc(l.url)}" style="color:${muted}">${esc(l.label)}</a></li>`
            )
            .join('') +
          `</ul></div>`
      )
      .join('');

    const top = brandColumn || cols ? `<div class="bk-sf-top">${brandColumn}${cols}</div>` : '';

    // ── bottom line ───────────────────────────────────────────────────────
    const copyright = String(c.copyright ?? '').trim().slice(0, 160);
    const note = String(c.note ?? '').trim().slice(0, 160);
    const bottom =
      copyright || note
        ? `<div class="bk-sf-bot" style="border-color:${line};color:${muted}">` +
          (copyright ? `<p>${esc(copyright)}</p>` : '') +
          (note ? `<p>${esc(note)}</p>` : '') +
          `</div>`
        : '';

    if (!top && !bottom) return '';

    return (
      `<footer class="bk bk-sf" style="background:${bg};color:${fg};` +
      `padding-top:${padTop}px;padding-bottom:${padBottom}px">` +
      `<div class="bk-sf-in">${top}${bottom}</div>` +
      `</footer>`
    );
  },
};
