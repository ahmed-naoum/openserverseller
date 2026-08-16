import { safeColor, num } from './escape.js';

/**
 * CSS for a compiled page, assembled from only the blocks that appear on it.
 *
 * Written as minified strings rather than generated from a token system: the
 * output is read by browsers, not people, and every byte is on the critical
 * path. Readability lives in these comments instead.
 */

/**
 * The font stack is a deliberate, visible change. The SPA loads Inter and Cairo;
 * a compiled page loads no webfont at all, which removes a render-blocking
 * request and any flash of unstyled text. Arabic copy will render in the
 * device's UI font and will not look identical to Cairo.
 */
const FONT_STACK =
  "system-ui,-apple-system,'Segoe UI',Roboto,'Noto Sans Arabic','Segoe UI Arabic',Arial,sans-serif";

export const BASE_CSS =
  `*,*::before,*::after{box-sizing:border-box}` +
  `html{-webkit-text-size-adjust:100%}` +
  `body{margin:0;font-family:${FONT_STACK};line-height:1.5;-webkit-font-smoothing:antialiased}` +
  `img,video{max-width:100%;height:auto;display:block}` +
  `.pg{margin:0 auto;width:100%}` +
  // Every block shares the same padding/margin contract as BlockRenderer, so the
  // per-block rules only ever need to set what is specific to them.
  `.bk{width:100%}`;

export interface PageStyleInput {
  backgroundColor?: unknown;
  maxWidth?: unknown;
}

/**
 * Page-level rules from `settings`.
 *
 * Colours go through the allow-list even though they are also validated on save:
 * these land inside a `<style>` element where there is no attribute boundary to
 * contain a bad value, so this is the last line rather than the only one.
 */
export function pageCss(settings: PageStyleInput): string {
  const bg = safeColor(settings?.backgroundColor, '#f9fafb');
  const maxWidth = num(settings?.maxWidth, 640, 280, 1600);
  return `body{background:${bg}}.pg{max-width:${maxWidth}px}`;
}

/**
 * Base sheet, page rules, then one stylesheet per block type actually present.
 *
 * `blockCss` is supplied by the caller from the renderer registry rather than
 * looked up here: a renderer owns its own styles, and a second registry in this
 * file is one more place for the two to drift apart.
 */
export function buildCss(blockCss: Iterable<string>, settings: PageStyleInput): string {
  let css = BASE_CSS + pageCss(settings);
  for (const rules of blockCss) {
    if (rules) css += rules;
  }
  return css;
}
