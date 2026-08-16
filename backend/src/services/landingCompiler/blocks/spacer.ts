import { num } from '../escape.js';
import type { BlockRenderer, BlockContext } from './types.js';

/**
 * Ported from BlockRenderer.tsx `case 'spacer'` (:234) — a bare div with a
 * height and nothing else.
 *
 * The one detail worth care is `content.height || 32`. It is an OR, not a
 * default parameter, so an explicit `0` is falsy and falls through to 32 rather
 * than collapsing the gap. Production has a spacer stored exactly that way, and
 * `num(c.height, 32)` alone would render it 0px and quietly reflow the page
 * against its React original.
 */
export const spacerBlock: BlockRenderer = {
  type: 'spacer',

  // No stylesheet: BASE_CSS already gives `.bk` its full width, and the height
  // is per-block, so a shared rule would have nothing to say.

  render(block: any, _ctx: BlockContext): string {
    const c = block?.content || {};
    // Clamped before the OR so a negative stored height cannot emit a negative
    // CSS length; React would pass it straight through for the browser to drop.
    const height = num(c.height, 32, 0, 2000) || 32;
    return `<div class="bk" style="height:${height}px"></div>`;
  },
};
