import type { BlockDefinition, BlockCategory } from './define.js';
import { header } from './header.js';
import { hero } from './hero.js';
import { text } from './text.js';
import { image } from './image.js';
import { video } from './video.js';
import { button } from './button.js';
import { whatsapp } from './whatsapp.js';
import { countdown } from './countdown.js';
import { spacer } from './spacer.js';
import { slider } from './slider.js';
import { products } from './products.js';
import { audio } from './audio.js';
import { expressCheckout } from './expressCheckout.js';
import { siteHeader } from './siteHeader.js';
import { siteFooter } from './siteFooter.js';
import { productDetail } from './productDetail.js';
import { infoCard } from './infoCard.js';
import { featureList } from './featureList.js';
import { quote } from './quote.js';
import { chips } from './chips.js';
import { gallery } from './gallery.js';

export type { BlockDefinition, BlockCategory, BlockMeta, BlockLabel, InspectorGroup } from './define.js';
export { packOption } from './expressCheckout.js';

/**
 * Every block the platform knows, in palette order.
 *
 * Adding a block means adding one file and one line here. The validator's type
 * list, both builders' defaults, the palette and the compiler coverage check
 * all read this array; nothing else has to change for a new type to exist.
 */
export const BLOCKS: readonly BlockDefinition[] = [
  siteHeader,
  siteFooter,
  expressCheckout,
  productDetail,
  button,
  countdown,
  products,
  video,
  slider,
  image,
  audio,
  hero,
  infoCard,
  featureList,
  quote,
  chips,
  gallery,
  header,
  text,
  spacer,
  whatsapp,
];

const byType = new Map<string, BlockDefinition>(BLOCKS.map((b) => [b.type, b]));

/**
 * The type strings as a non-empty tuple, which is what `z.enum` insists on.
 * Derived from BLOCKS so the two can never disagree.
 */
export const BLOCK_TYPES = BLOCKS.map((b) => b.type) as unknown as readonly [string, ...string[]];

/** The union of every block type. What `EditorBlock.type` is typed as. */
export type BlockType =
  | 'site_header'
  | 'site_footer'
  | 'express_checkout'
  | 'product_detail'
  | 'button'
  | 'countdown'
  | 'products'
  | 'video'
  | 'slider'
  | 'image'
  | 'audio'
  | 'hero'
  | 'info_card'
  | 'feature_list'
  | 'quote'
  | 'chips'
  | 'gallery'
  | 'header'
  | 'text'
  | 'spacer'
  | 'whatsapp';

export function getBlock(type: string): BlockDefinition | undefined {
  return byType.get(type);
}

export function isBlockType(type: unknown): type is BlockType {
  return typeof type === 'string' && byType.has(type);
}

/**
 * A fresh copy of a block's defaults, so two blocks added in a row never share
 * a `links` array or an `options` array by reference.
 */
export function defaultsFor(type: string): Record<string, unknown> {
  const def = byType.get(type);
  if (!def) return {};
  return JSON.parse(JSON.stringify(def.defaults)) as Record<string, unknown>;
}

/** The palette, grouped the way the library shows it. */
export function catalogue(category?: BlockCategory): BlockDefinition[] {
  return category ? BLOCKS.filter((b) => b.meta.category === category) : [...BLOCKS];
}

/** Types the compiler renders; a page made only of these compiles. */
export function compiledTypes(): Set<string> {
  return new Set(BLOCKS.filter((b) => b.compiled).map((b) => b.type));
}
