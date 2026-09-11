import type { BlockRenderer } from './types.js';
import { imageBlock } from './image.js';
import { checkoutBlock } from './checkout.js';
import { videoBlock } from './video.js';
import { buttonBlock } from './button.js';
import { whatsappBlock } from './whatsapp.js';
import { audioBlock } from './audio.js';
import { spacerBlock } from './spacer.js';
import { heroBlock } from './hero.js';
import { sliderBlock } from './slider.js';
import { productsBlock } from './products.js';
import { siteHeaderBlock } from './siteHeader.js';
import { siteFooterBlock } from './siteFooter.js';
import { textBlock } from './text.js';
import { headerBlock } from './header.js';
import { countdownBlock } from './countdown.js';
import { productDetailBlock } from './productDetail.js';
import { infoCardBlock } from './infoCard.js';
import { featureListBlock } from './featureList.js';
import { quoteBlock } from './quote.js';
import { chipsBlock } from './chips.js';
import { galleryBlock } from './gallery.js';

/**
 * The renderer registry.
 *
 * A block type is compilable exactly when it appears here. Adding one widens
 * coverage automatically: a page becomes eligible the moment every block on it
 * is registered, with no flag to flip and no data migration.
 *
 * Scope must follow real usage. Run `scripts/landing-block-usage.ts` against the
 * production database before adding a renderer — the first version of this plan
 * chose seven types from the builder's palette, four of which no page had ever
 * used.
 */
const RENDERERS: BlockRenderer[] = [
  imageBlock,
  checkoutBlock,
  videoBlock,
  buttonBlock,
  whatsappBlock,
  audioBlock,
  spacerBlock,
  heroBlock,
  sliderBlock,
  productsBlock,
  siteHeaderBlock,
  siteFooterBlock,
  textBlock,
  headerBlock,
  countdownBlock,
  productDetailBlock,
  infoCardBlock,
  featureListBlock,
  quoteBlock,
  chipsBlock,
  galleryBlock,
];

export const registry = new Map<string, BlockRenderer>(
  RENDERERS.map((renderer) => [renderer.type, renderer])
);

export function rendererFor(type: string): BlockRenderer | undefined {
  return registry.get(type);
}

export function supportedTypes(): Set<string> {
  return new Set(registry.keys());
}

export type { BlockRenderer, BlockContext, ImageDimensions } from './types.js';
