import { esc, safeUrl, safeColor, num, oneOf } from '../escape.js';
import { BUTTON_RUNTIME } from '../runtime/button.js';
import type { BlockRenderer, BlockContext } from './types.js';

/**
 * Ported from ButtonBlockComponent (BlockRenderer.tsx:1412-1509).
 *
 * The most-placed interactive block on real pages — 23 of 37 — and the one that
 * gates most of the compiler's coverage, because almost every page with a
 * checkout also has a call-to-action above it.
 *
 * framer-motion is replaced with CSS keyframes. The named easings map across;
 * springs do not, but none of the six presets uses one.
 */

const ANIMATIONS = [
  'bounceHorizontal',
  'bounceVertical',
  'rotate',
  'scale',
  'fade',
  'appear',
] as const;

/** Easing values framer accepts that also mean something in CSS. */
const TIMINGS = ['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear'] as const;

export const buttonBlock: BlockRenderer = {
  type: 'button',

  css:
    `.bk-btn{width:100%;display:flex;justify-content:center;position:relative;` +
    `transition:opacity .3s}` +
    `.bk-btn button{display:inline-flex;align-items:center;justify-content:center;` +
    `font-weight:900;cursor:pointer;font-family:inherit;line-height:1.2;` +
    `border-style:solid;transition:transform .15s}` +
    `.bk-btn button:active{transform:scale(.98)}` +
    // Sticky variants. The mobile rule is unconditional and the desktop rule is
    // behind the same 768px breakpoint Tailwind's `md:` uses, so a block with
    // only stickyDesktop stays in the flow on a phone.
    `.bk-btn.sm{position:fixed;bottom:16px;left:0;right:0;padding-left:16px;` +
    `padding-right:16px;z-index:9999}` +
    `.bk-btn.sm button{width:100%}` +
    `@media(min-width:768px){` +
    `.bk-btn.sm{position:relative;bottom:auto;padding-left:0;padding-right:0}` +
    `.bk-btn.sm button{width:auto}` +
    `.bk-btn.sd{position:fixed;bottom:32px;right:32px;left:auto;width:auto;` +
    `padding-left:0;padding-right:0;z-index:9999}` +
    `.bk-btn.sd button{width:auto}}` +
    // Hidden while the checkout is on screen, and hidden until a video reaches
    // showAfterVideoSeconds. Both are driven by the runtime.
    `.bk-btn.off{opacity:0;visibility:hidden;pointer-events:none}` +
    `.bk-btn.pending{display:none}` +
    `@keyframes bkbx{0%,100%{transform:translateX(0)}50%{transform:translateX(12px)}}` +
    `@keyframes bkby{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}` +
    `@keyframes bkrot{0%,100%{transform:rotate(0)}25%{transform:rotate(5deg)}` +
    `75%{transform:rotate(-5deg)}}` +
    `@keyframes bksc{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}` +
    `@keyframes bkfd{0%,100%{opacity:.6}50%{opacity:1}}` +
    `@keyframes bkap{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}` +
    `.bk-btn-bounceHorizontal button{animation:bkbx 1.5s infinite}` +
    `.bk-btn-bounceVertical button{animation:bkby 1.5s infinite}` +
    `.bk-btn-rotate button{animation:bkrot 2s infinite}` +
    `.bk-btn-scale button{animation:bksc 1.5s infinite}` +
    `.bk-btn-fade button{animation:bkfd 2s infinite}` +
    `.bk-btn-appear button{animation:bkap .5s both}` +
    // Respect a visitor who has asked for less motion; framer-motion does not,
    // but a looping CTA is exactly what the setting exists for.
    `@media(prefers-reduced-motion:reduce){.bk-btn button{animation:none}}`,

  runtime: BUTTON_RUNTIME,

  render(block: any, ctx: BlockContext): string {
    const c = block?.content || {};

    // 24px default, unlike the 0 most blocks use.
    const wrapStyle =
      `padding-top:${num(c.paddingTop, 24, 0, 400)}px;` +
      `padding-bottom:${num(c.paddingBottom, 24, 0, 400)}px;` +
      `margin-top:${num(c.marginTop, 0, -200, 400)}px;` +
      `margin-bottom:${num(c.marginBottom, 0, -200, 400)}px`;

    const bg = safeColor(c.bgColor, '#f97316');
    const fg = safeColor(c.textColor, '#ffffff');

    // The shadow is the button colour at 44/255 alpha — an 8-digit hex, so it
    // only works when bgColor is itself hex. A named or rgb() colour would make
    // `${bg}44` invalid, so those fall back to a plain neutral shadow.
    const shadow = /^#[0-9a-f]{6}$/i.test(bg)
      ? `0 10px 30px ${bg}44`
      : '0 10px 30px rgba(0,0,0,.16)';

    const hasBorder = c.buttonBorderWidth !== undefined && c.buttonBorderWidth !== '';
    const border = hasBorder
      ? `${num(c.buttonBorderWidth, 0, 0, 40)}px solid ${safeColor(c.buttonBorderColor, '#f97316')}`
      : 'none';

    const btnStyle =
      `background:${bg};color:${fg};box-shadow:${shadow};` +
      `font-size:${num(c.textSize, 20, 8, 96)}px;` +
      `padding-top:${num(c.buttonPaddingY, 16, 0, 200)}px;` +
      `padding-bottom:${num(c.buttonPaddingY, 16, 0, 200)}px;` +
      `padding-left:${num(c.buttonPaddingX, 40, 0, 300)}px;` +
      `padding-right:${num(c.buttonPaddingX, 40, 0, 300)}px;` +
      `border:${border};` +
      `border-radius:${num(c.buttonBorderRadius, 16, 0, 200)}px`;

    const classes = ['bk', 'bk-btn'];
    if (c.stickyMobile) classes.push('sm');
    if (c.stickyDesktop) classes.push('sd');

    const animation = oneOf(c.animationLayout, ANIMATIONS, '' as any);
    if (animation) classes.push(`bk-btn-${animation}`);

    const timing = oneOf(c.animationTiming, TIMINGS, 'ease-in-out');

    // A button that only appears partway through a video starts hidden. It is
    // `display:none` rather than opacity so it cannot be tapped early, and it is
    // applied in CSS so it is hidden before the runtime executes.
    const showAfter = num(c.showAfterVideoSeconds, 0, 0, 7200);
    if (showAfter > 0) classes.push('pending');

    const behavior = oneOf(c.behavior, ['checkout', 'link'] as const, c.link ? 'link' : 'checkout');
    const href = behavior === 'link' ? safeUrl(c.link) : '';

    const attrs = [
      `class="${classes.join(' ')}"`,
      `style="${wrapStyle}${animation ? `;animation-timing-function:${timing}` : ''}"`,
      `data-btn`,
      behavior === 'checkout' ? `data-btn-checkout` : '',
      href ? `data-btn-href="${esc(href)}"` : '',
      c.stickyMobile || c.stickyDesktop ? `data-btn-sticky` : '',
      showAfter > 0 ? `data-btn-after="${showAfter}"` : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      `<div ${attrs}>` +
      `<button type="button" style="${btnStyle}">` +
      `${esc(c.text || 'Commander Maintenant')}</button>` +
      `</div>`
    );
  },
};
