import { esc, safeUrl, safeColor, num, oneOf, jsonForScript } from '../escape.js';
import { WHATSAPP_RUNTIME } from '../runtime/whatsapp.js';
import type { BlockRenderer, BlockContext } from './types.js';

/**
 * Ported from components/public/WhatsAppWidget.tsx.
 *
 * Unlike every other block this one renders NOTHING in the page flow —
 * BlockRenderer returns null for `whatsapp` outside the editor. The widget is a
 * fixed-position overlay that ReferralForm mounts separately
 * (ReferralForm.tsx:740), so document.ts emits this markup as a sibling of the
 * page container rather than inside it.
 *
 * `render` takes whatever content the caller resolved and draws it. Which
 * source wins — the block, or `settings.whatsappWidget` — is document.ts's
 * decision (`whatsappContent`), because a page can carry the widget in settings
 * with no `whatsapp` block at all and there would then be nothing here to ask.
 */

const ICON_TYPES = ['whatsapp', 'message-circle', 'message-square', 'headset', 'bot'] as const;
const ANIMATIONS = ['none', 'pulse', 'bounce', 'shake', 'rubberBand'] as const;
const POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'] as const;
const STYLES = ['bubble', 'pill'] as const;

/** Inline SVG, since lucide-react is a React component library. */
function icon(type: string, size: number): string {
  const open = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"`;
  switch (type) {
    case 'message-circle':
      return `${open} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
    case 'message-square':
      return `${open} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    case 'headset':
      return `${open} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14v-3a9 9 0 0 1 18 0v3"/><path d="M21 16a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2zM3 16a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z"/></svg>`;
    case 'bot':
      return `${open} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M12 8V4M8 4h8"/><circle cx="8.5" cy="14" r="1"/><circle cx="15.5" cy="14" r="1"/></svg>`;
    default:
      // The official WhatsApp glyph, copied verbatim from IconRenderer.
      return `${open} fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;
  }
}

export const whatsappBlock: BlockRenderer = {
  type: 'whatsapp',

  css:
    `.wa{position:fixed;display:flex;font-family:inherit;z-index:99999}` +
    `.wa.t{flex-direction:column-reverse}` +
    `.wa.b{flex-direction:column}` +
    `.wa.l{align-items:flex-start}` +
    `.wa.r{align-items:flex-end}` +
    // Visibility is per-viewport, matching the md: breakpoint the React classes use.
    // Restore before hide, never the other way round: the two desktop rules have
    // equal specificity, so on an element carrying BOTH classes the last one
    // wins. Hidden-everywhere has to stay hidden on desktop, which means
    // `.wa.no-d` must come after `.wa.no-m`.
    `.wa.no-m{display:none}` +
    `@media(min-width:768px){.wa.no-m{display:flex}.wa.no-d{display:none}}` +
    `.wa-panel{display:none;width:340px;max-width:calc(100vw - 32px);background:#fff;` +
    `border-radius:24px;box-shadow:0 25px 50px -12px rgba(0,0,0,.25);border:1px solid #f3f4f6;` +
    `flex-direction:column;overflow:hidden}` +
    `.wa.open .wa-panel{display:flex}` +
    `.wa.b .wa-panel{margin-bottom:16px}.wa.t .wa-panel{margin-top:16px}` +
    `.wa-h{padding:16px;color:#fff;display:flex;align-items:center;justify-content:space-between}` +
    `.wa-h-l{display:flex;align-items:center;gap:12px}` +
    `.wa-av{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.1);` +
    `display:flex;align-items:center;justify-content:center;flex-shrink:0}` +
    `.wa-h3{margin:0;font-size:14px;font-weight:800;line-height:1.2}` +
    `.wa-sub{font-size:10px;opacity:.8;font-weight:500}` +
    `.wa-x{background:none;border:0;color:#fff;cursor:pointer;padding:4px;border-radius:50%;` +
    `display:flex;line-height:0}` +
    `.wa-conv{padding:16px;min-height:180px;max-height:260px;overflow-y:auto;background:#e5ddd5}` +
    `.wa-msg{display:flex;gap:8px;align-items:flex-start;max-width:85%}` +
    `.wa-pic{width:32px;height:32px;border-radius:50%;object-fit:cover;background:#fff;flex-shrink:0}` +
    `.wa-ini{width:32px;height:32px;border-radius:50%;background:#059669;color:#fff;display:flex;` +
    `align-items:center;justify-content:center;font-weight:700;font-size:12px;flex-shrink:0;` +
    `text-transform:uppercase}` +
    `.wa-bub{background:#fff;border-radius:16px;border-top-left-radius:0;padding:12px;` +
    `box-shadow:0 4px 6px -1px rgba(0,0,0,.1);display:flex;flex-direction:column}` +
    `.wa-nick{font-size:10px;font-weight:700;color:#059669;margin-bottom:2px}` +
    `.wa-txt{margin:0;font-size:12px;color:#1f2937;line-height:1.6;white-space:pre-line;` +
    `word-break:break-word}` +
    `.wa-time{font-size:9px;color:#9ca3af;align-self:flex-end;margin-top:4px}` +
    `.wa-form{padding:12px;background:#f9fafb;border-top:1px solid #f3f4f6;display:flex;` +
    `align-items:center;gap:8px}` +
    `.wa-in{flex:1;background:#fff;border:1px solid #e5e7eb;border-radius:999px;` +
    `padding:8px 16px;font:inherit;font-size:12px;font-weight:500;min-width:0}` +
    `.wa-in:focus{outline:none;border-color:#10b981;box-shadow:0 0 0 1px #10b981}` +
    `.wa-send{width:32px;height:32px;border-radius:50%;border:0;color:#fff;cursor:pointer;` +
    `display:flex;align-items:center;justify-content:center;flex-shrink:0}` +
    `.wa-send:disabled{opacity:.4;pointer-events:none}` +
    `.wa-fab{border:0;color:#fff;cursor:pointer;display:flex;align-items:center;` +
    `justify-content:center;flex-shrink:0}` +
    `.wa-fab.bubble{width:56px;height:56px;border-radius:50%}` +
    `.wa-fab.pill{gap:8px;padding:12px 20px;border-radius:999px;font-weight:700;font-size:14px}` +
    `.wa.open .wa-fab.pill{display:none}` +
    `.wa-wrap{position:relative}` +
    `.wa-badge{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;display:flex;` +
    `align-items:center;justify-content:center;background:#ef4444;color:#fff;font-size:10px;` +
    `font-weight:900;border-radius:999px;padding:0 4px;border:2px solid #fff}` +
    `.wa.open .wa-badge{display:none}` +
    `.wa-note{position:relative;display:flex;width:100%}` +
    `.wa.b .wa-note{margin-bottom:20px}.wa.t .wa-note{margin-top:20px}` +
    `.wa.l .wa-note{justify-content:flex-start}.wa.r .wa-note{justify-content:flex-end}` +
    `.wa.open .wa-note,.wa-note.gone{display:none}` +
    `.wa-note-i{position:relative;background:#fff;border-radius:24px;border:1px solid #f3f4f6;` +
    `box-shadow:0 10px 40px -10px rgba(0,0,0,.15);padding:16px 24px;max-width:280px;` +
    `animation:wa-fadeInUp .4s cubic-bezier(.16,1,.3,1)}` +
    `.wa-note-t{margin:0;font-size:15px;font-weight:700;color:#1f2937;line-height:1.35}` +
    `.wa-note-x{position:absolute;top:-10px;right:-10px;width:28px;height:28px;background:#f3f4f6;` +
    `border:1px solid #e5e7eb;border-radius:50%;display:flex;align-items:center;` +
    `justify-content:center;color:#6b7280;cursor:pointer;line-height:0}` +
    `@keyframes wa-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}` +
    `@keyframes wa-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}` +
    `@keyframes wa-shake{0%,100%{transform:rotate(0)}20%{transform:rotate(-8deg)}` +
    `40%{transform:rotate(8deg)}60%{transform:rotate(-4deg)}80%{transform:rotate(4deg)}}` +
    `@keyframes wa-rubber{0%{transform:scaleX(1) scaleY(1)}30%{transform:scaleX(1.15) scaleY(.85)}` +
    `40%{transform:scaleX(.85) scaleY(1.15)}50%{transform:scaleX(1.05) scaleY(.95)}` +
    `65%{transform:scaleX(.98) scaleY(1.02)}75%{transform:scaleX(1.02) scaleY(.98)}` +
    `100%{transform:scaleX(1) scaleY(1)}}` +
    `@keyframes wa-fadeInUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}` +
    `@media(prefers-reduced-motion:reduce){.wa-fab{animation:none!important}}`,

  runtime: WHATSAPP_RUNTIME,

  render(block: any, ctx: BlockContext): string {
    const c = block?.content || {};

    // Belt and braces. `whatsappContent` already refuses to hand over a block
    // that opted out, but this renderer is reachable from the registry like any
    // other and must not draw a widget the page switched off.
    if (c.enableWidget === false) return '';

    const phone = String(c.phoneNumber || '').replace(/\D/g, '');
    // Without a number the send button is permanently disabled, so the whole
    // widget is decoration. React still renders it; there is no reason to ship
    // 2 KB of markup that cannot do anything.
    if (!phone) return '';

    const iconColor = safeColor(c.iconColor, '#25D366');
    const headerBg = safeColor(c.headerBg, '#25D366');
    const iconType = oneOf(c.iconType, ICON_TYPES, 'whatsapp');
    const iconStyle = oneOf(c.iconStyle, STYLES, 'bubble');
    const animation = oneOf(c.animation, ANIMATIONS, 'none');
    const position = oneOf(c.position, POSITIONS, 'bottom-right');

    const isTop = position === 'top-right' || position === 'top-left';
    const isLeft = position === 'bottom-left' || position === 'top-left';
    const offsetX = num(c.offsetX, 24, 0, 400);
    const offsetY = num(c.offsetY, 24, 0, 400);

    const classes = ['wa', isTop ? 't' : 'b', isLeft ? 'l' : 'r'];
    if (c.showOnDesktop === false) classes.push('no-d');
    if (c.showOnMobile === false) classes.push('no-m');

    const pos =
      `${isTop ? 'top' : 'bottom'}:${offsetY}px;${isLeft ? 'left' : 'right'}:${offsetX}px`;

    // Defaults copied from the component's destructuring block (lines 59-83).
    const nickname = String(c.nickname || ctx.influencerName || 'Nitso');
    const headline = String(c.headline || "Let's chat on WhatsApp");
    const subHeadline = String(c.subHeadline || 'Répond généralement instantanément');
    const welcome = String(c.welcomeMessage || 'How can I help you? 😊');
    const hoverText = String(c.hoverText || 'WhatsApp');
    const badgeCount = num(c.badgeCount, 0, 0, 999);
    const badgeMessage = String(c.badgeMessage || '');
    const avatar = safeUrl(c.profileImage || ctx.influencerAvatar || '');

    const anim =
      animation !== 'none'
        ? `animation:wa-${animation === 'rubberBand' ? 'rubber' : animation} ` +
          `${animation === 'shake' ? '0.6s' : '2s'} ease-in-out infinite;`
        : '';

    const parts: string[] = [];
    parts.push(`<div class="${classes.join(' ')}" data-wa style="${pos}">`);

    // Panel
    parts.push(`<div class="wa-panel">`);
    parts.push(
      `<div class="wa-h" style="background:${headerBg}">` +
        `<div class="wa-h-l"><div class="wa-av">${icon(iconType, 24)}</div>` +
        `<div><h3 class="wa-h3">${esc(headline)}</h3>` +
        `<span class="wa-sub">${esc(subHeadline)}</span></div></div>` +
        `<button type="button" class="wa-x" data-wa-close aria-label="Fermer">` +
        `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">` +
        `<path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg></button></div>`
    );
    parts.push(
      `<div class="wa-conv"><div class="wa-msg">` +
        (avatar
          ? `<img class="wa-pic" src="${esc(avatar)}" alt="${esc(nickname)}" width="32" height="32">`
          : `<div class="wa-ini">${esc(nickname.charAt(0))}</div>`) +
        `<div class="wa-bub"><span class="wa-nick">${esc(nickname)}</span>` +
        `<p class="wa-txt">${esc(welcome)}</p>` +
        // Filled by the runtime — a compiled page has no idea what time the
        // visitor will open it.
        `<span class="wa-time" data-wa-time></span></div></div></div>`
    );
    parts.push(
      `<form class="wa-form" data-wa-form>` +
        `<input class="wa-in" type="text" data-wa-input placeholder="Écrivez votre message..." ` +
        `aria-label="Message">` +
        `<button class="wa-send" type="submit" style="background:${iconColor}" aria-label="Envoyer">` +
        `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
        `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
        `<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>` +
        `</svg></button></form>`
    );
    parts.push(`</div>`);

    // Notification bubble
    if (badgeMessage) {
      parts.push(
        `<div class="wa-note" data-wa-note><div class="wa-note-i">` +
          `<button type="button" class="wa-note-x" data-wa-note-close aria-label="Fermer">` +
          `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
          `stroke-width="2" stroke-linecap="round" aria-hidden="true">` +
          `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` +
          `<p class="wa-note-t" dir="auto">${esc(badgeMessage)}</p></div></div>`
      );
    }

    // Floating button
    const badge = badgeCount
      ? `<span class="wa-badge">${badgeCount > 9 ? '9+' : badgeCount}</span>`
      : '';
    parts.push(`<div class="wa-wrap">`);
    if (iconStyle === 'pill') {
      parts.push(
        `<button type="button" class="wa-fab pill" data-wa-toggle title="${esc(hoverText)}" ` +
          `style="background:${iconColor};box-shadow:0 10px 25px ${iconColor}44;${anim}">` +
          `${icon(iconType, 20)}<span>${esc(hoverText || 'Chat on WhatsApp')}</span></button>`
      );
    } else {
      parts.push(
        `<button type="button" class="wa-fab bubble" data-wa-toggle title="${esc(hoverText)}" ` +
          `style="background:${iconColor};box-shadow:0 10px 25px ${iconColor}44;${anim}">` +
          `<span data-wa-icon>${icon(iconType, 32)}</span></button>`
      );
    }
    parts.push(badge);
    parts.push(`</div>`);

    const cfg = {
      code: ctx.code,
      phone,
      preSetMessage: String(c.preSetMessage || ''),
      useWebOnDesktop: c.useWhatsappWebOnDesktop !== false,
      openOnLoad: !!c.openOnLoad,
    };
    parts.push(
      `<script type="application/json" data-wa-cfg>${jsonForScript(cfg)}</script>`
    );

    parts.push(`</div>`);
    return parts.join('');
  },
};
