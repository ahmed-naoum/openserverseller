import { esc, safeUrl, safeColor, num, oneOf } from '../escape.js';
import { SLIDER_RUNTIME } from '../runtime/slider.js';
import type { BlockRenderer, BlockContext } from './types.js';

/**
 * Ported from BlockRenderer.tsx `case 'slider'` (:244) and SliderBlock (:664).
 *
 * Two modes share one card. `autoplayMode:'marquee'` is a CSS animation over
 * three copies of the slides; anything else is a track the runtime translates a
 * page at a time. Every live slider today is the second kind, at one card per
 * view, but the marquee is what the newest builder writes, so both ship.
 *
 * React builds `@keyframes marquee-${block.id}` and a hover rule per block, from
 * an author-controlled id, into a `<style>` tag inside the body. Here the
 * keyframes are global and everything that varies per block — gap, card width,
 * marquee duration, glow colour — is a custom property on the container. That
 * removes the injection surface escape.ts warns about and stops a page with
 * three sliders shipping three near-identical stylesheets.
 */

const CHEVRON =
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"` +
  ` stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`;
const CHEVRON_LEFT = `${CHEVRON}<path d="m15 18-6-6 6-6"/></svg>`;
const CHEVRON_RIGHT = `${CHEVRON}<path d="m9 18 6-6-6-6"/></svg>`;

/** The `startIndices` of SliderBlock (:715-731), needed here for the dot count. */
export function startIndices(total: number, per: number, by: 'card' | 'page'): number[] {
  const starts: number[] = [];
  if (by === 'page') {
    for (let i = 0; i < total; i += per) {
      const idx = Math.min(i, Math.max(0, total - per));
      if (!starts.includes(idx)) starts.push(idx);
    }
  } else {
    for (let i = 0; i <= total - per; i++) starts.push(i);
  }
  if (starts.length === 0) starts.push(0);
  return starts;
}

interface CardOptions {
  /** Card index within the emitted list, for the entrance stagger. */
  idx: number;
  /** 0.12s per card in the sliding modes, 0.1s in the marquee. Both are React's. */
  stagger: number;
  cardStyle: string;
  hoverClass: string;
  shadowClass: string;
  mediaClass: string;
  mediaHeight: string;
  fitClass: string;
  entrance: boolean;
  titleColor: string;
  descColor: string;
  /** Cards below this index are on screen before any scroll, so they load eagerly. */
  eagerCount: number;
  /** True when this block is the page's first — its opening card may be the LCP. */
  lcp: boolean;
}

function card(slide: any, o: CardOptions): string {
  const raw = String(slide?.mediaUrl || '');
  const url = raw ? safeUrl(raw) : '';
  // React tests the resolved URL, so a query string or a proxied path decides
  // this the same way there as here.
  const isVideo = /\.(mp4|webm|ogg)$/i.test(url);

  // React sets no loading attribute at all, so every card image is eager there.
  // Lazy is the better default below the fold, but applying it to the cards on
  // screen at load — and to a slider that opens the page — would make the
  // compiled version slower than the React one it replaces. Same rule as
  // image.ts: the first two blocks are above the fold.
  const eager = o.idx < o.eagerCount;
  const priority = o.lcp && o.idx === 0 ? ' fetchpriority="high"' : '';

  const media = url
    ? `<div class="bk-sl-m ${o.mediaClass} ${o.fitClass}" style="height:${o.mediaHeight}">` +
      (isVideo
        ? `<video src="${esc(url)}" autoplay loop muted playsinline crossorigin="anonymous"></video>`
        : `<img src="${esc(url)}" alt="${esc(slide?.title || '')}"` +
          ` loading="${eager ? 'eager' : 'lazy'}"${priority}>`) +
      `</div>`
    : // React keys the media wrapper on `slide.mediaUrl` being truthy, not on the
      // URL surviving validation — so a rejected URL still leaves the box out.
      raw
      ? `<div class="bk-sl-m ${o.mediaClass} ${o.fitClass}" style="height:${o.mediaHeight}"></div>`
      : '';

  const title = String(slide?.title || '');
  const description = String(slide?.description || '');

  const delay = o.entrance ? `;animation-delay:${o.idx * o.stagger}s` : '';

  return (
    `<div class="bk-sl-c${o.shadowClass}${o.hoverClass}" style="${o.cardStyle}${delay}">` +
    media +
    `<div class="bk-sl-b">` +
    (title ? `<h3 style="color:${o.titleColor}">${esc(title)}</h3>` : '') +
    (description ? `<p style="color:${o.descColor}">${esc(description)}</p>` : '') +
    `</div></div>`
  );
}

export const sliderBlock: BlockRenderer = {
  type: 'slider',

  css:
    `.bk-sl{position:relative;max-width:896px;margin-left:auto;margin-right:auto;` +
    `-webkit-user-select:none;user-select:none}` +
    `.bk-sl.mq{max-width:none;overflow:hidden}` +
    `.bk-sl-v{overflow:hidden;padding-left:16px;padding-right:16px}` +
    `@media(min-width:640px){.bk-sl-v{padding-left:24px;padding-right:24px}}` +
    `.bk-sl-t{display:flex;gap:var(--sl-gap);transition:transform .5s ease-in-out}` +
    `.bk-sl-i{flex:0 0 var(--sl-w);min-width:0}` +
    // Fade only ever applies at one card per view, so the track stops being a
    // flex row and the cards stack on top of each other instead.
    `.bk-sl-t.fade{display:block;position:relative;width:100%;gap:0}` +
    `.bk-sl-t.fade .bk-sl-i{position:absolute;top:0;left:0;width:100%;opacity:0;` +
    `transition:opacity .6s ease-in-out;pointer-events:none;z-index:0}` +
    `.bk-sl-t.fade .bk-sl-i.is-on{position:relative;opacity:1;pointer-events:auto;z-index:1}` +
    `.bk-sl-t.zoom .bk-sl-i{transform:scale(.93);opacity:.5;` +
    `transition:transform .6s cubic-bezier(.16,1,.3,1),opacity .6s cubic-bezier(.16,1,.3,1)}` +
    `.bk-sl-t.zoom .bk-sl-i.is-vis{transform:scale(1);opacity:1}` +
    // The marquee shifts by exactly one of the three copies, so the seam lands
    // on an identical frame and the loop is invisible.
    `.bk-sl-mt{display:flex;width:max-content;gap:var(--sl-gap);` +
    `animation:bksl-mq var(--sl-dur) linear infinite}` +
    `.bk-sl-mt.pz:hover{animation-play-state:paused}` +
    `@keyframes bksl-mq{0%{transform:translate3d(0,0,0)}100%{transform:translate3d(-33.3333%,0,0)}}` +
    `.bk-sl-mi{flex-shrink:0;width:var(--sl-w);max-width:var(--sl-mw)}` +
    `.bk-sl-c{overflow:hidden;display:flex;flex-direction:column;height:100%;` +
    `transition:all .4s cubic-bezier(.16,1,.3,1)}` +
    `.bk-sl-m{width:100%;background:#f3f4f6;overflow:hidden;position:relative}` +
    // mediaHeight100 lets the image take the leftover height; otherwise the box
    // is a fixed band the text sits below.
    `.bk-sl-m.gr{flex:1 1 0%}` +
    `.bk-sl-m.fx{flex-shrink:0}` +
    `.bk-sl-m img,.bk-sl-m video{width:100%;height:100%;display:block}` +
    `.bk-sl-m.cv img,.bk-sl-m.cv video{object-fit:cover}` +
    `.bk-sl-m.ct img,.bk-sl-m.ct video{object-fit:contain}` +
    `.bk-sl-b{padding:20px;flex:1 1 0%;display:flex;flex-direction:column;` +
    `justify-content:center;text-align:var(--sl-ta,left)}` +
    `@media(min-width:640px){.bk-sl:not(.mq) .bk-sl-b{padding:24px}}` +
    `.bk-sl-b h3{font-size:20px;line-height:1.25;font-weight:900;margin:0 0 8px}` +
    `.bk-sl-b p{font-size:14px;line-height:1.625;margin:0}` +
    // Above two cards per view the type drops a step, in both modes.
    `.bk-sl.sm .bk-sl-b h3{font-size:16px}` +
    `.bk-sl.sm .bk-sl-b p{font-size:12px}` +
    `.bk-sl.mq .bk-sl-b h3{font-size:18px;margin-bottom:6px}` +
    `.bk-sl.mq .bk-sl-b p{font-size:12px}` +
    `.bk-sl.mq.sm .bk-sl-b h3{font-size:14px}` +
    `.bk-sl.mq.sm .bk-sl-b p{font-size:11px}` +
    `.bk-sl-c.sh-s{box-shadow:0 1px 2px 0 rgba(0,0,0,.05)}` +
    `.bk-sl-c.sh-m{box-shadow:0 10px 15px -3px rgba(0,0,0,.1),0 4px 6px -4px rgba(0,0,0,.1)}` +
    `.bk-sl-c.sh-l{box-shadow:0 20px 25px -5px rgba(0,0,0,.1),0 8px 10px -6px rgba(0,0,0,.1)}` +
    `.bk-sl-c.sh-x{box-shadow:0 25px 50px -12px rgba(0,0,0,.25)}` +
    `.bk-sl-c.hv-lift:hover{transform:translateY(-8px) translateZ(0);` +
    `box-shadow:0 20px 25px -5px rgba(0,0,0,.15),0 10px 10px -5px rgba(0,0,0,.05)!important}` +
    `.bk-sl-c.hv-scale:hover{transform:scale(1.03) translateZ(0)}` +
    `.bk-sl-c.hv-glow:hover{box-shadow:0 0 25px 3px var(--sl-glow)!important}` +
    `.bk-sl-c.hv-gray{filter:grayscale(85%)}` +
    `.bk-sl-c.hv-gray:hover{filter:grayscale(0)}` +
    `@keyframes bksl-fu{from{opacity:0;transform:translate3d(0,35px,0)}` +
    `to{opacity:1;transform:translate3d(0,0,0)}}` +
    `@keyframes bksl-fi{from{opacity:0}to{opacity:1}}` +
    `@keyframes bksl-zi{from{opacity:0;transform:scale3d(.94,.94,.94)}` +
    `to{opacity:1;transform:scale3d(1,1,1)}}` +
    `.bk-sl.ent .bk-sl-c{opacity:0}` +
    `.bk-sl.ent.in-view .bk-sl-c{animation-duration:.75s;animation-fill-mode:forwards;` +
    `animation-timing-function:cubic-bezier(.16,1,.3,1)}` +
    `.bk-sl.ent-fu.in-view .bk-sl-c{animation-name:bksl-fu}` +
    `.bk-sl.ent-fi.in-view .bk-sl-c{animation-name:bksl-fi}` +
    `.bk-sl.ent-zi.in-view .bk-sl-c{animation-name:bksl-zi}` +
    `.bk-sl-a{position:absolute;top:50%;transform:translateY(-50%);width:40px;height:40px;` +
    `border:0;border-radius:50%;background:rgba(255,255,255,.9);` +
    `-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);` +
    `box-shadow:0 10px 15px -3px rgba(0,0,0,.1),0 4px 6px -4px rgba(0,0,0,.1);` +
    `display:flex;align-items:center;justify-content:center;color:#374151;cursor:pointer;` +
    `z-index:10;transition:background .2s,transform .2s}` +
    `.bk-sl-a:hover{background:#fff;transform:translateY(-50%) scale(1.1)}` +
    `.bk-sl-a.l{left:0}.bk-sl-a.r{right:0}` +
    `.bk-sl-d{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:20px}` +
    `.bk-sl-d button{width:10px;height:10px;padding:0;border:0;border-radius:999px;` +
    `cursor:pointer;opacity:.4;background:var(--sl-dot);transition:all .3s}` +
    `.bk-sl-d button:hover{opacity:.7}` +
    `.bk-sl-d button.is-on{width:28px;opacity:1}` +
    `.bk-sl-n{text-align:center;margin-top:8px;font-size:10px;font-weight:700;color:#9ca3af}`,

  runtime: SLIDER_RUNTIME,

  render(block: any, ctx: BlockContext): string {
    const c = block?.content || {};
    const slides: any[] = Array.isArray(c.slides) ? c.slides : [];

    const wrapStyle =
      `padding-top:${num(c.paddingTop, 24, 0, 400)}px;` +
      `padding-bottom:${num(c.paddingBottom, 24, 0, 400)}px;` +
      `margin-top:${num(c.marginTop, 0, -200, 400)}px;` +
      `margin-bottom:${num(c.marginBottom, 0, -200, 400)}px`;

    if (!slides.length) {
      // React draws a dashed box reading "Slider — Aucune carte / Ajoutez des
      // cartes dans les propriétés" here. That is an instruction to the person
      // editing the page, and a customer should never be shown it — the same
      // call image.ts makes for a source-less image block. The spacing is kept
      // so the rest of the page sits where it did.
      return `<div class="bk bk-sl" style="${wrapStyle}"></div>`;
    }

    const per = num(c.cardsPerView || 1, 1, 1, 12);
    const gap = num(c.cardGap, 16, 0, 200);
    const marquee = c.autoplayMode === 'marquee';
    const by = oneOf(c.slideBy, ['card', 'page'] as const, 'card');
    const starts = startIndices(slides.length, per, by);

    const titleColor = safeColor(c.titleColor, '#111827');
    const descColor = safeColor(c.descColor, '#6b7280');
    const dotColor = safeColor(c.dotColor, '#f97316');

    // `${dotColor}66` in the original: 8-digit hex alpha, ~40%. Only valid on a
    // 6-digit hex, so anything else glows in the flat colour rather than
    // producing a malformed value that drops the shadow entirely.
    const glow = /^#[0-9a-f]{6}$/i.test(dotColor) ? `${dotColor}66` : dotColor;

    const borderWidth = num(c.cardBorderWidth, 0, 0, 40);
    const cardStyle =
      `background:${safeColor(c.cardBg, '#ffffff')};` +
      `border-radius:${num(c.cardRadius, 20, 0, 200)}px;` +
      (borderWidth > 0
        ? `border:${borderWidth}px solid ${safeColor(c.cardBorderColor, '#e5e7eb')}`
        : `border:none`);

    const shadow = String(c.cardShadow ?? 'md');
    // 'lg' maps to shadow-xl and 'xl' to shadow-2xl in the original — the names
    // are one step apart from Tailwind's, and matching them would visibly
    // flatten every card that asks for the two largest.
    const shadowClass =
      shadow === 'none'
        ? ''
        : shadow === 'sm'
          ? ' sh-s'
          : shadow === 'lg'
            ? ' sh-l'
            : shadow === 'xl'
              ? ' sh-x'
              : ' sh-m';

    const hoverClass =
      c.hoverEffect === 'lift'
        ? ' hv-lift'
        : c.hoverEffect === 'scale'
          ? ' hv-scale'
          : c.hoverEffect === 'glow'
            ? ' hv-glow'
            : c.hoverEffect === 'grayscale'
              ? ' hv-gray'
              : '';

    const entrance = oneOf(
      c.entranceAnimation,
      ['fade-up', 'fade-in', 'zoom-in', 'none'] as const,
      'none'
    );
    const entranceClass =
      entrance === 'fade-up'
        ? ' ent ent-fu'
        : entrance === 'fade-in'
          ? ' ent ent-fi'
          : entrance === 'zoom-in'
            ? ' ent ent-zi'
            : '';

    // The alignment of the card copy, applied to the same element React puts it
    // on. Not a builder control: V1 writes 'left' into a new slider and V2 and
    // every template write 'center', so dropping it would left-align nearly
    // every slider on the platform.
    const align = oneOf(c.textAlign, ['left', 'center', 'right'] as const, 'left');

    const mediaHeight = c.mediaHeight100 === true ? '100%' : `${num(c.mediaHeight || 280, 280, 0, 4000)}px`;
    const cardOpts = {
      stagger: marquee ? 0.1 : 0.12,
      cardStyle,
      hoverClass,
      shadowClass,
      mediaClass: c.mediaHeight100 === true ? 'gr' : 'fx',
      mediaHeight,
      fitClass: c.mediaFit === 'contain' ? 'ct' : 'cv',
      entrance: entrance !== 'none',
      titleColor,
      descColor,
      eagerCount: ctx.index < 2 ? per : 0,
      lcp: ctx.index === 0,
    };

    // The cards are only ever as wide as the gaps left over, which is the one
    // number both modes compute the same way.
    const inset = (gap * (per - 1)) / per;
    const small = per > 2 ? ' sm' : '';

    // Without JS the entrance rule would leave every card at opacity:0 forever.
    // React has no such state — no JS means no page at all — but a compiled page
    // is real HTML, and it should not be blank in a browser that never runs the
    // observer.
    const noscript = cardOpts.entrance
      ? `<noscript><style>.bk-sl.ent .bk-sl-c{opacity:1}</style></noscript>`
      : '';

    if (marquee) {
      // Three copies, as in React: the animation travels exactly one copy, so
      // the loop closes on an identical frame.
      const tripled = [...slides, ...slides, ...slides];
      const vars =
        `${wrapStyle};--sl-gap:${gap}px;--sl-glow:${glow};--sl-ta:${align};` +
        `--sl-dur:${num(c.marqueeSpeed, 20, 1, 600)}s;` +
        `--sl-w:calc((100vw - 32px) / ${per} - ${inset}px);` +
        `--sl-mw:calc(900px / ${per} - ${inset}px)`;

      const cards = tripled
        .map((slide, idx) => `<div class="bk-sl-mi">${card(slide, { ...cardOpts, idx })}</div>`)
        .join('');

      return (
        `<div class="bk bk-sl mq${small}${entranceClass}" style="${vars}"` +
        ` data-sl data-sl-mq="on" data-sl-ent="${cardOpts.entrance ? 'on' : 'off'}">` +
        noscript +
        `<div class="bk-sl-v"><div class="bk-sl-mt${c.pauseOnHover !== false ? ' pz' : ''}">` +
        cards +
        `</div></div></div>`
      );
    }

    const fade = c.transitionEffect === 'fade' && per === 1;
    const zoom = c.transitionEffect === 'zoom';

    const vars =
      `${wrapStyle};--sl-gap:${gap}px;--sl-glow:${glow};--sl-dot:${dotColor};` +
      `--sl-ta:${align};--sl-w:calc(100% / ${per} - ${inset}px)`;

    const cards = slides
      .map((slide, idx) => {
        // Card 0 is the one on screen at load, so it carries the state the
        // runtime would otherwise have to apply before first paint.
        const state = fade
          ? idx === 0
            ? ' is-on'
            : ''
          : zoom && idx < per
            ? ' is-vis'
            : '';
        return `<div class="bk-sl-i${state}">${card(slide, { ...cardOpts, idx })}</div>`;
      })
      .join('');

    const arrows =
      c.showArrows !== false && starts.length > 1
        ? `<button type="button" class="bk-sl-a l" data-sl-prev aria-label="Précédent">` +
          `${CHEVRON_LEFT}</button>` +
          `<button type="button" class="bk-sl-a r" data-sl-next aria-label="Suivant">` +
          `${CHEVRON_RIGHT}</button>`
        : '';

    const dots =
      c.showDots !== false && starts.length > 1
        ? `<div class="bk-sl-d">` +
          starts
            .map(
              (_, idx) =>
                `<button type="button" data-sl-dot${idx === 0 ? ' class="is-on"' : ''}` +
                ` aria-label="Carte ${idx + 1}"></button>`
            )
            .join('') +
          `</div>`
        : '';

    // The counter is not gated on showDots — React renders it whenever there is
    // more than one page.
    const counter =
      starts.length > 1
        ? `<div class="bk-sl-n" data-sl-n>1 / ${starts.length}</div>`
        : '';

    return (
      `<div class="bk bk-sl${small}${entranceClass}" style="${vars}"` +
      ` data-sl data-sl-per="${per}" data-sl-gap="${gap}" data-sl-by="${by}"` +
      ` data-sl-auto="${c.autoPlay !== false ? 'on' : 'off'}"` +
      ` data-sl-speed="${num(c.autoPlaySpeed || 4000, 4000, 100, 600000)}"` +
      ` data-sl-fade="${fade ? 'on' : 'off'}" data-sl-zoom="${zoom ? 'on' : 'off'}"` +
      ` data-sl-ent="${cardOpts.entrance ? 'on' : 'off'}">` +
      noscript +
      `<div class="bk-sl-v"><div class="bk-sl-t${fade ? ' fade' : ''}${zoom ? ' zoom' : ''}"` +
      ` data-sl-track>${cards}</div></div>` +
      arrows +
      dots +
      counter +
      `</div>`
    );
  },
};
