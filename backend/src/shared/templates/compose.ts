import type { PageDocument, PageKind, SectionNode, AnyNode, NodeStyle } from '../document/types.js';
import { defaultsFor } from '../blocks/index.js';
import { resolveDocument } from '../document/theme.js';
import { KITS, type Kit } from './kits.js';

/**
 * The vocabulary a complete store is written in.
 *
 * A theme, and a design the OpenDesign engine composes, are both lists of
 * sections: a hero, a trust strip, the catalogue, a promotion, the steps,
 * the reviews, the questions, the closing call to action. Each of those is a
 * small arrangement of registry blocks — a slider used as a card grid, a row
 * of heroes used as a stat strip — and this file is where those arrangements
 * live, once, so twelve themes and an infinite number of generated designs
 * agree on what "a testimonial section" is while each still chooses its own
 * variant, colours and copy.
 *
 * Brand colours are tokens (`$primary`, `$secondary`, `$bg`, `$text`,
 * `$muted`) so a seller who changes one brand value recolours the whole
 * store. Everything a token cannot express — the accent, the card surface, a
 * soft tint for an alternating band, the ink on the primary colour — is a
 * literal carried by a `Look`, which a theme derives from its palette.
 *
 * Pure TypeScript, shared with the frontend through the `@shared` alias.
 */

export type Shadow = 'none' | 'sm' | 'md' | 'lg' | 'xl';

export interface Look {
  /** True when the page ground is dark and the text light. */
  dark: boolean;
  /** A literal secondary highlight colour. Not a token: there is no `$accent`. */
  accent: string;
  /** Ink that reads on the primary colour. */
  onPrimary: string;
  /** Ink that reads on the secondary colour. */
  onSecondary: string;
  /** Card surface and its border. */
  card: string;
  cardBorder: string;
  /** A soft tint for alternating bands. */
  band: string;
  /** Corner radius scale for cards and buttons. */
  radius: number;
  shadow: Shadow;
  /** How everything is drawn: type scale, alignment, corners, tiles, spacing. */
  kit: Kit;
  /** The literal palette, for the few places a token cannot go (gradients). */
  palette: PaletteLike;
}

export interface Slide {
  title: string;
  description: string;
  mediaUrl?: string;
}

export interface Stat {
  value: string;
  label: string;
}

export interface Faq {
  q: string;
  a: string;
}

export interface Quote {
  name: string;
  city: string;
  text: string;
  stars?: number;
}

// ─────────────────────────────────────────────── primitives

export function block(id: string, type: string, overrides: Record<string, unknown> = {}, bind?: Record<string, string>): AnyNode {
  const node: AnyNode = { id, type: 'block', block: type, props: { ...defaultsFor(type), ...overrides } };
  if (bind) (node as any).bind = bind;
  return node;
}

export function row(id: string, columns: number[], children: AnyNode[], gap = 24, style?: NodeStyle): AnyNode {
  const node: AnyNode = { id, type: 'layout', layout: 'row', columns, gap, children } as AnyNode;
  if (style) node.style = style;
  return node;
}

export function section(id: string, children: AnyNode[], style?: NodeStyle, label?: string): SectionNode {
  const s: SectionNode = { id, type: 'section', children: children as SectionNode['children'] };
  if (style) s.style = style;
  if (label) s.label = label;
  return s;
}

export function page(kind: PageKind, root: SectionNode[], settings: Record<string, unknown> = { maxWidth: 1600 }): PageDocument {
  return { version: 3, kind, settings, root };
}

export function heading(id: string, text: string, opts: { align?: 'left' | 'center' | 'right'; color?: string; paddingTop?: number; paddingBottom?: number; look?: Look; size?: 'sm' | 'md' | 'lg' | 'xl' } = {}): AnyNode {
  const h = opts.look?.kit.heading;
  return block(id, 'text', {
    text, isHeading: true, align: opts.align ?? h?.align ?? 'center', color: opts.color ?? '$text', verticalAlign: 'top',
    size: opts.size ?? h?.size ?? 'md', uppercase: h?.uppercase ?? false, weight: h?.weight ?? 'bold', tracking: h?.tracking ?? 'normal',
    paddingTop: opts.paddingTop ?? 8, paddingBottom: opts.paddingBottom ?? 4,
  });
}

export function para(id: string, text: string, opts: { align?: 'left' | 'center' | 'right'; color?: string; paddingTop?: number; paddingBottom?: number } = {}): AnyNode {
  return block(id, 'text', {
    text, isHeading: false, align: opts.align ?? 'center', color: opts.color ?? '$muted', verticalAlign: 'top',
    paddingTop: opts.paddingTop ?? 0, paddingBottom: opts.paddingBottom ?? 8,
  });
}

/** A big centred statement: the hero block with no band of its own. */
export function statement(id: string, title: string, subtitle: string, opts: { titleColor?: string; subtitleColor?: string; paddingTop?: number; paddingBottom?: number; bg?: string; look?: Look; kicker?: string; kickerColor?: string; align?: 'left' | 'center' | 'right'; titleSize?: 'md' | 'lg' | 'xl' | '2xl'; maxWidth?: number } = {}): AnyNode {
  const h = opts.look?.kit.hero;
  return block(id, 'hero', {
    title, subtitle, bgColor: opts.bg ?? 'transparent', titleColor: opts.titleColor ?? '$text', subtitleColor: opts.subtitleColor ?? '$muted',
    align: opts.align ?? h?.align ?? 'center', titleSize: opts.titleSize ?? h?.titleSize ?? 'lg', uppercase: h?.uppercase ?? false,
    kicker: opts.kicker ?? '', kickerStyle: h?.kicker ?? 'plain', kickerColor: opts.kickerColor ?? '$primary',
    maxWidth: opts.maxWidth ?? 0,
    paddingTop: opts.paddingTop ?? 24, paddingBottom: opts.paddingBottom ?? 8, marginBottom: 0,
  });
}

export interface ButtonOptions {
  link?: string;
  bg?: string;
  color?: string;
  radius?: number;
  paddingX?: number;
  paddingY?: number;
  textSize?: number;
  border?: { width: number; color: string };
  stickyMobile?: boolean;
  animation?: 'none' | 'bounceVertical' | 'scale' | 'fade' | 'appear';
  paddingTop?: number;
  paddingBottom?: number;
}

export function button(id: string, text: string, look: Look, opts: ButtonOptions = {}): AnyNode {
  return block(id, 'button', {
    text,
    behavior: 'link',
    link: opts.link ?? '/products',
    bgColor: opts.bg ?? '$primary',
    textColor: opts.color ?? look.onPrimary,
    textSize: opts.textSize ?? look.kit.button.textSize,
    buttonBorderRadius: opts.radius ?? look.kit.button.radius,
    buttonPaddingX: opts.paddingX ?? look.kit.button.paddingX,
    buttonPaddingY: opts.paddingY ?? look.kit.button.paddingY,
    buttonBorderWidth: opts.border?.width ?? 0,
    buttonBorderColor: opts.border?.color ?? 'transparent',
    stickyMobile: opts.stickyMobile ?? false,
    stickyDesktop: false,
    animationLayout: opts.animation ?? 'none',
    paddingTop: opts.paddingTop ?? 4,
    paddingBottom: opts.paddingBottom ?? 12,
  });
}

/** A link styled as a quiet outline button, for the second call to action. */
export function ghostButton(id: string, text: string, look: Look, opts: ButtonOptions = {}): AnyNode {
  return button(id, text, look, {
    bg: 'transparent', color: opts.color ?? '$text', border: { width: 2, color: opts.border?.color ?? '$primary' }, ...opts,
  });
}

export function spacer(id: string, height = 24): AnyNode {
  return block(id, 'spacer', { height });
}

/** A photograph. `maxHeight` keeps a tall picture from swallowing the page. */
export function picture(id: string, url: string, opts: { alt?: string; maxHeight?: number; width?: number; paddingTop?: number; paddingBottom?: number } = {}): AnyNode {
  return block(id, 'image', {
    url, alt: opts.alt ?? '', width: opts.width ?? 100, maxHeight: opts.maxHeight ?? 640,
    paddingTop: opts.paddingTop ?? 0, paddingBottom: opts.paddingBottom ?? 0, marginTop: 0, marginBottom: 0,
  });
}

/** The same slides with pictures attached where a URL is given. */
export function pics(slides: Slide[], urls: (string | undefined)[]): Slide[] {
  return slides.map((s, i) => (urls[i] ? { ...s, mediaUrl: urls[i] } : s));
}

// ─────────────────────────────────────────────── card grids built on the slider

export interface CardsOptions {
  perView?: number;
  align?: 'left' | 'center' | 'right';
  cardBg?: string;
  cardBorder?: string;
  radius?: number;
  shadow?: Shadow;
  titleColor?: string;
  descColor?: string;
  hover?: 'none' | 'lift' | 'scale' | 'glow';
  entrance?: 'none' | 'fade-up' | 'fade-in' | 'zoom-in';
  mediaHeight?: number;
  paddingTop?: number;
  paddingBottom?: number;
}

/**
 * A static grid of cards: the slider with exactly as many cards as it shows,
 * no arrows, no dots, no autoplay. Every card carries a surface, a border and
 * a radius, which is what makes it a card rather than two lines of text.
 */
export function cards(id: string, slides: Slide[], look: Look, opts: CardsOptions = {}): AnyNode {
  return block(id, 'slider', {
    slides: slides.map((s) => ({ title: s.title, description: s.description, mediaUrl: s.mediaUrl ?? '' })),
    cardsPerView: opts.perView ?? Math.min(4, Math.max(1, slides.length)),
    cardGap: 16,
    autoPlay: false,
    showArrows: false,
    showDots: false,
    mediaHeight: opts.mediaHeight ?? 200,
    mediaFit: 'cover',
    titleColor: opts.titleColor ?? '$text',
    descColor: opts.descColor ?? '$muted',
    cardBg: opts.cardBg ?? look.card,
    cardRadius: opts.radius ?? look.kit.card.radius,
    cardBorderWidth: look.kit.card.border ? 1 : 0,
    cardBorderColor: opts.cardBorder ?? look.cardBorder,
    cardShadow: opts.shadow ?? (look.dark ? look.shadow : look.kit.card.shadow),
    textAlign: opts.align ?? look.kit.card.align,
    hoverEffect: opts.hover ?? 'lift',
    entranceAnimation: opts.entrance ?? 'fade-up',
    dotColor: '$primary',
    paddingTop: opts.paddingTop ?? 8,
    paddingBottom: opts.paddingBottom ?? 8,
  });
}

/** The same cards, moving: a continuous marquee for tickers and logo strips. */
export function marquee(id: string, slides: Slide[], look: Look, opts: CardsOptions & { speed?: number } = {}): AnyNode {
  return block(id, 'slider', {
    slides: slides.map((s) => ({ title: s.title, description: s.description, mediaUrl: '' })),
    cardsPerView: opts.perView ?? 4,
    cardGap: 16,
    autoPlay: true,
    autoplayMode: 'marquee',
    marqueeSpeed: opts.speed ?? 28,
    pauseOnHover: true,
    showArrows: false,
    showDots: false,
    titleColor: opts.titleColor ?? '$text',
    descColor: opts.descColor ?? '$muted',
    cardBg: opts.cardBg ?? look.card,
    cardRadius: opts.radius ?? look.kit.card.radius,
    cardBorderWidth: look.kit.card.border ? 1 : 0,
    cardBorderColor: opts.cardBorder ?? look.cardBorder,
    cardShadow: opts.shadow ?? 'none',
    textAlign: opts.align ?? look.kit.card.align,
    paddingTop: opts.paddingTop ?? 4,
    paddingBottom: opts.paddingBottom ?? 4,
  });
}

/** A carousel: one or two cards at a time, autoplaying, with dots. */
export function carousel(id: string, slides: Slide[], look: Look, opts: CardsOptions & { transition?: 'fade' | 'zoom' | 'slide'; speed?: number } = {}): AnyNode {
  const per = opts.perView ?? 1;
  return block(id, 'slider', {
    slides: slides.map((s) => ({ title: s.title, description: s.description, mediaUrl: s.mediaUrl ?? '' })),
    cardsPerView: per,
    cardGap: 16,
    autoPlay: true,
    autoPlaySpeed: opts.speed ?? 4500,
    pauseOnHover: true,
    showArrows: per > 1,
    showDots: true,
    transitionEffect: opts.transition ?? (per === 1 ? 'fade' : 'slide'),
    mediaHeight: opts.mediaHeight ?? 220,
    mediaFit: 'cover',
    titleColor: opts.titleColor ?? '$text',
    descColor: opts.descColor ?? '$muted',
    cardBg: opts.cardBg ?? look.card,
    cardRadius: opts.radius ?? look.kit.card.radius,
    cardBorderWidth: look.kit.card.border ? 1 : 0,
    cardBorderColor: opts.cardBorder ?? look.cardBorder,
    cardShadow: opts.shadow ?? (look.dark ? look.shadow : look.kit.card.shadow),
    textAlign: opts.align ?? (look.kit.card.align === 'left' ? 'left' : 'center'),
    dotColor: '$primary',
    hoverEffect: opts.hover ?? 'none',
    paddingTop: opts.paddingTop ?? 8,
    paddingBottom: opts.paddingBottom ?? 8,
  });
}

// ─────────────────────────────────────────────── products

export interface ProductsOptions {
  layout?: 'grid' | 'slider';
  cols?: number;
  cardBg?: string;
  radius?: number;
  shadow?: Shadow;
  titleColor?: string;
  descColor?: string;
  priceColor?: string;
  btnBg?: string;
  btnColor?: string;
  animation?: 'default' | 'smooth' | 'bounce' | 'continuous';
  paddingTop?: number;
  paddingBottom?: number;
}

export function products(id: string, bindTo: string, look: Look, opts: ProductsOptions = {}): AnyNode {
  return block(
    id,
    'products',
    {
      layoutType: opts.layout ?? 'grid',
      gridCols: opts.cols ?? 3,
      showPrice: true,
      cardBg: opts.cardBg ?? look.card,
      cardRadius: opts.radius ?? look.kit.product.radius,
      cardShadow: opts.shadow ?? (look.dark ? look.shadow : look.kit.product.shadow),
      cardStyle: look.kit.product.cardStyle,
      imageHeight: look.kit.product.imageHeight,
      imageFit: look.kit.product.imageFit,
      buttonStyle: look.kit.product.buttonStyle,
      buttonRadius: look.kit.product.buttonRadius,
      titleAlign: look.kit.product.titleAlign,
      titleColor: opts.titleColor ?? '$text',
      descColor: opts.descColor ?? '$muted',
      priceColor: opts.priceColor ?? '$primary',
      btnBg: opts.btnBg ?? '$primary',
      btnColor: opts.btnColor ?? look.onPrimary,
      animationType: opts.animation ?? 'smooth',
      autoPlay: true,
      autoPlaySpeed: 3500,
      paddingTop: opts.paddingTop ?? 8,
      paddingBottom: opts.paddingBottom ?? 8,
    },
    { items: bindTo }
  );
}

// ─────────────────────────────────────────────── sections

export interface InfoCardSpec {
  badge?: string;
  title: string;
  subtitle?: string;
  rows?: { label: string; value: string }[];
  progress?: { label: string; value: string; pct: number };
  figure?: string;
  figureCaption?: string;
  cta?: string;
  ctaLink?: string;
  /** Glass over a dark band. */
  dark?: boolean;
  align?: 'left' | 'center' | 'right';
}

/** The floating card of the reference designs: rows, a progress bar, a figure, a button. */
export function infoCard(id: string, look: Look, o: InfoCardSpec): AnyNode {
  const dark = o.dark ?? look.dark;
  return block(id, 'info_card', {
    badge: o.badge ?? '',
    badgeColor: dark ? look.accent : '$primary',
    title: o.title,
    subtitle: o.subtitle ?? '',
    rows: o.rows ?? [],
    progressLabel: o.progress?.label ?? '',
    progressValue: o.progress?.value ?? '',
    progressPct: o.progress?.pct ?? -1,
    progressColor: '$primary',
    figure: o.figure ?? '',
    figureCaption: o.figureCaption ?? '',
    figureColor: '$primary',
    ctaText: o.cta ?? '',
    ctaUrl: o.ctaLink ?? '/products',
    ctaBg: dark ? '#ffffff' : '$primary',
    ctaColor: dark ? '#0f172a' : look.onPrimary,
    style: 'glass',
    bgColor: dark ? 'rgba(15,23,42,0.62)' : 'rgba(255,255,255,0.88)',
    textColor: dark ? '#ffffff' : '#0f172a',
    mutedColor: dark ? 'rgba(255,255,255,0.72)' : '#475569',
    borderColor: dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.7)',
    radius: Math.max(12, look.radius),
    maxWidth: 400,
    align: o.align ?? 'right',
    paddingTop: 8,
    paddingBottom: 8,
  });
}

export interface HeroSectionOptions {
  variant: 'center' | 'split' | 'stacked';
  kicker?: string;
  kickerStyle?: 'plain' | 'pill' | 'line';
  title: string;
  subtitle: string;
  cta: string;
  ctaLink?: string;
  secondaryCta?: string;
  secondaryLink?: string;
  secondaryStyle?: 'outline' | 'link' | 'filled';
  /** Cards shown beside the copy in the split variant, or under it otherwise. */
  highlights?: Slide[];
  /** A photograph: beside the copy in the split variant, under it otherwise. Empty means none. */
  image?: string;
  /** A photograph behind the whole band, copy and card included. */
  bgImage?: string;
  /** A colour laid over `bgImage`; rgba for transparency. */
  overlay?: string;
  /** The band's ground: a colour token or a linear-gradient(...). */
  background?: string;
  /** A floating info card beside the copy. Implies a left-aligned, two-column band. */
  card?: InfoCardSpec;
  align?: 'left' | 'center';
  size?: 'lg' | 'xl' | '2xl';
  uppercase?: boolean;
  serif?: boolean;
  /** A word or phrase of the title drawn in the brand colour. */
  highlight?: string;
  titleColor?: string;
  subtitleColor?: string;
  ctaBg?: string;
  ctaColor?: string;
  ctaRadius?: number;
  paddingTop?: number;
  paddingBottom?: number;
  minHeight?: number;
  maxWidth?: number;
  countdown?: string;
}

export function heroSection(id: string, look: Look, o: HeroSectionOptions): SectionNode {
  const titleColor = o.titleColor ?? '$text';
  const subtitleColor = o.subtitleColor ?? '$muted';
  const twoColumns = Boolean(o.card) || (o.variant === 'split' && Boolean(o.image || o.highlights?.length));
  const align = o.align ?? (twoColumns ? 'left' : 'center');
  const hasPics = Boolean(o.highlights?.some((h) => h.mediaUrl));

  // The copy is one hero block now: kicker, title, subtitle and the buttons
  // inline — which is what lets it sit in a column beside a card or a picture.
  const heroBlock = block(`${id}-h`, 'hero', {
    kicker: o.kicker ?? '',
    kickerStyle: o.kickerStyle ?? (o.kicker ? 'line' : 'plain'),
    kickerColor: o.ctaBg ?? '$primary',
    title: o.title,
    subtitle: o.subtitle,
    highlight: o.highlight ?? '',
    highlightColor: '$primary',
    bgColor: 'transparent',
    titleColor,
    subtitleColor,
    align,
    titleSize: o.size ?? (twoColumns ? 'xl' : 'lg'),
    titleFont: o.serif ? 'serif' : 'inherit',
    uppercase: Boolean(o.uppercase),
    maxWidth: twoColumns ? 640 : 0,
    ctaText: o.cta,
    ctaUrl: o.ctaLink ?? '/products',
    ctaBg: o.ctaBg ?? '$primary',
    ctaColor: o.ctaColor ?? look.onPrimary,
    ctaRadius: o.ctaRadius ?? look.radius,
    secondaryText: o.secondaryCta ?? '',
    secondaryUrl: o.secondaryLink ?? '/products',
    secondaryStyle: o.secondaryStyle ?? 'outline',
    secondaryColor: titleColor,
    paddingTop: 8,
    paddingBottom: 8,
    marginBottom: 0,
  });
  const countdown = o.countdown ? [block(`${id}-cd`, 'countdown', { text: o.countdown, paddingTop: 4, paddingBottom: 8 })] : [];

  const style: NodeStyle = {
    background: o.background ?? '$bg',
    paddingTop: o.paddingTop ?? 56,
    paddingBottom: o.paddingBottom ?? 48,
    maxWidth: o.maxWidth ?? 1200,
  };
  if (o.bgImage) {
    style.backgroundImage = o.bgImage;
    style.overlay = o.overlay ?? 'rgba(8,10,18,0.5)';
  }
  const rowStyle: NodeStyle = { align: 'center' };
  if (o.minHeight) rowStyle.paddingTop = Math.round(o.minHeight / 8);
  if (o.minHeight) rowStyle.paddingBottom = Math.round(o.minHeight / 8);

  const highlightCards = (top = 20) =>
    o.highlights?.length
      ? [cards(`${id}-hl`, o.highlights, look, { perView: Math.min(3, o.highlights.length), align: 'center', paddingTop: top, mediaHeight: hasPics ? 180 : 0, cardBg: o.bgImage ? (look.dark ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.85)') : undefined })]
      : [];

  if (o.card) {
    const side = infoCard(`${id}-card`, look, { dark: o.card.dark ?? (Boolean(o.bgImage) || look.dark), ...o.card });
    return section(id, [
      row(`${id}-r`, [7, 5], [
        { id: `${id}-c`, type: 'layout', layout: 'row', columns: [12], gap: 0, children: [heroBlock, ...countdown] } as AnyNode,
        side,
      ], 32, rowStyle),
      ...(o.variant === 'split' ? [] : highlightCards(24)),
    ], style, 'Accroche');
  }

  if (o.variant === 'split' && (o.image || o.highlights?.length)) {
    // A photograph takes the side column when there is one; the highlight
    // carousel takes it otherwise, and the highlights become cards below.
    const side = o.image
      ? picture(`${id}-img`, o.image, { alt: o.title, maxHeight: 560 })
      : carousel(`${id}-hl`, o.highlights!, look, { perView: 1, transition: 'fade', speed: 3800, mediaHeight: hasPics ? 220 : 0, shadow: 'lg' });
    const below = o.image ? highlightCards(24) : [];
    return section(id, [row(`${id}-r`, [7, 5], [
      { id: `${id}-c`, type: 'layout', layout: 'row', columns: [12], gap: 0, children: [heroBlock, ...countdown] } as AnyNode,
      side,
    ], 32, rowStyle), ...below], style, 'Accroche');
  }

  const banner = o.image ? [picture(`${id}-img`, o.image, { alt: o.title, maxHeight: 620, paddingTop: 16 })] : [];
  if (o.variant === 'stacked' && o.highlights?.length) {
    return section(id, [heroBlock, ...countdown, ...banner, ...highlightCards()], style, 'Accroche');
  }
  return section(id, [heroBlock, ...countdown, ...banner], style, 'Accroche');
}

export interface TitledOptions {
  title?: string;
  subtitle?: string;
  background?: string;
  titleColor?: string;
  subtitleColor?: string;
  paddingTop?: number;
  paddingBottom?: number;
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
}

function titled(id: string, o: TitledOptions, big = false, look?: Look): AnyNode[] {
  const out: AnyNode[] = [];
  if (!o.title) return out;
  const align = o.align ?? look?.kit.heading.align ?? 'center';
  if (big) out.push(statement(`${id}-t`, o.title, o.subtitle ?? '', { titleColor: o.titleColor, subtitleColor: o.subtitleColor, paddingTop: 0, paddingBottom: 12, look, align: o.align ?? look?.kit.hero.align, titleSize: look?.kit.hero.titleSize === '2xl' ? 'xl' : 'lg' }));
  else {
    out.push(heading(`${id}-t`, o.title, { align, color: o.titleColor, look }));
    if (o.subtitle) out.push(para(`${id}-s`, o.subtitle, { align, color: o.subtitleColor }));
  }
  return out;
}

/** A gradient over a flat colour when the kit wants one, else the colour itself. Tokens become their literals, since a gradient cannot carry one. */
export function gradientOf(look: Look, background: string): string {
  if (look.kit.hero.band !== 'gradient') return background;
  const lit = background === '$bg' ? look.palette.bg : background === '$secondary' ? look.palette.secondary : background === '$primary' ? look.palette.primary : background;
  if (!/^#[0-9a-f]{6}$/i.test(lit)) return background;
  const towards = look.dark ? mix(lit, '#ffffff', 0.08) : mix(lit, '#000000', 0.05);
  const tint = mix(look.palette.primary, look.dark ? '#000000' : '#ffffff', look.dark ? 0.72 : 0.82);
  return `linear-gradient(135deg, ${lit} 0%, ${towards} 55%, ${tint} 100%)`;
}

function bandStyle(o: TitledOptions, fallbackBg: string, top = 48, bottom = 56, look?: Look): NodeStyle {
  const k = look?.kit.section;
  const style: NodeStyle = {
    background: o.background ?? fallbackBg,
    paddingTop: Math.round((o.paddingTop ?? top) * (k?.spacing ?? 1)),
    paddingBottom: Math.round((o.paddingBottom ?? bottom) * (k?.spacing ?? 1)),
    maxWidth: o.maxWidth ?? k?.maxWidth ?? 1200,
  };
  if (k?.divider && look) {
    style.borderWidth = 1;
    style.borderColor = look.cardBorder;
  }
  return style;
}

/** Trust points: three or four short reasons, as cards, a ticker, or a bare row. */
export function uspSection(id: string, look: Look, slides: Slide[], o: TitledOptions & { variant?: 'cards' | 'marquee' | 'plain'; cardBg?: string; cardBorder?: string } = {}): SectionNode {
  const variant = o.variant ?? 'cards';
  const children = titled(id, o, false, look);
  if (variant === 'marquee') children.push(marquee(`${id}-m`, slides, look, { cardBg: o.cardBg, cardBorder: o.cardBorder, titleColor: o.titleColor, descColor: o.subtitleColor }));
  else if (variant === 'plain') children.push(cards(`${id}-c`, slides, look, { perView: Math.min(4, slides.length), align: 'center', cardBg: 'transparent', cardBorder: 'transparent', shadow: 'none', hover: 'none', titleColor: o.titleColor, descColor: o.subtitleColor }));
  else children.push(cards(`${id}-c`, slides, look, { perView: Math.min(4, slides.length), cardBg: o.cardBg, cardBorder: o.cardBorder, titleColor: o.titleColor, descColor: o.subtitleColor }));
  return section(id, children, bandStyle(o, look.band, variant === 'marquee' ? 24 : 40, variant === 'marquee' ? 24 : 48, look), 'Garanties');
}

/** The catalogue on the home page, or a related-products strip on a product page. */
export function productsSection(id: string, look: Look, o: TitledOptions & ProductsOptions & { bind?: string; ctaText?: string; ctaLink?: string; big?: boolean } = {}): SectionNode {
  const children = titled(id, o, o.big ?? false, look);
  children.push(products(`${id}-g`, o.bind ?? '$catalogue', look, o));
  if (o.ctaText) children.push(button(`${id}-b`, o.ctaText, look, { link: o.ctaLink ?? '/products', paddingTop: 16 }));
  return section(id, children, bandStyle(o, '$bg', 48, 56, look), 'Produits');
}

/** A band of big numbers. */
export function statsSection(id: string, look: Look, stats: Stat[], o: TitledOptions & { valueColor?: string; labelColor?: string } = {}): SectionNode {
  const cols = stats.map((s, i) => statement(`${id}-${i}`, s.value, s.label, { titleColor: o.valueColor ?? '$primary', subtitleColor: o.labelColor ?? o.subtitleColor ?? '$muted', paddingTop: 8, paddingBottom: 8, look, align: look.kit.heading.align, titleSize: look.kit.hero.titleSize === 'md' ? 'lg' : look.kit.hero.titleSize }));
  const children = titled(id, o, false, look);
  children.push(row(`${id}-r`, stats.map(() => Math.floor(12 / stats.length)), cols, 16));
  return section(id, children, bandStyle(o, look.band, 32, 32, look), 'Chiffres clés');
}

/** A coloured band with a statement and a button: a promotion, a collection, an offer. */
export function promoSection(id: string, look: Look, o: TitledOptions & { title: string; cta: string; ctaLink?: string; ctaBg?: string; ctaColor?: string; countdown?: string; variant?: 'center' | 'split'; radius?: number; secondaryCta?: string; secondaryLink?: string; image?: string }): SectionNode {
  const bg = o.background ?? '$secondary';
  const titleColor = o.titleColor ?? look.onSecondary;
  const subtitleColor = o.subtitleColor ?? titleColor;
  const copy: AnyNode[] = [statement(`${id}-h`, o.title, o.subtitle ?? '', { titleColor, subtitleColor, paddingTop: 8, paddingBottom: 8, look, titleSize: look.kit.hero.titleSize === '2xl' ? 'xl' : look.kit.hero.titleSize })];
  if (o.countdown) copy.push(block(`${id}-cd`, 'countdown', { text: o.countdown, paddingTop: 0, paddingBottom: 8 }));
  const actions: AnyNode[] = [button(`${id}-b`, o.cta, look, { link: o.ctaLink ?? '/products', bg: o.ctaBg ?? '$primary', color: o.ctaColor ?? look.onPrimary, paddingTop: 8 })];
  if (o.secondaryCta) actions.push(ghostButton(`${id}-b2`, o.secondaryCta, look, { link: o.secondaryLink ?? '/products', color: titleColor, border: { width: 2, color: titleColor }, paddingTop: 0 }));

  const style: NodeStyle = { background: gradientOf(look, bg), paddingTop: Math.round((o.paddingTop ?? 40) * look.kit.section.spacing), paddingBottom: Math.round((o.paddingBottom ?? 40) * look.kit.section.spacing), maxWidth: o.maxWidth ?? look.kit.section.maxWidth, borderRadius: o.radius ?? look.kit.section.radius };
  if (o.image) {
    // Copy and buttons on the left, the picture on the right, whatever the variant.
    return section(id, [row(`${id}-r`, [7, 5], [
      { id: `${id}-c`, type: 'layout', layout: 'row', columns: [12], gap: 0, children: [...copy, ...actions] } as AnyNode,
      picture(`${id}-img`, o.image, { alt: o.title, maxHeight: 480 }),
    ], 32, { align: 'center' })], style, 'Promotion');
  }
  if (o.variant === 'split') {
    return section(id, [row(`${id}-r`, [8, 4], [
      { id: `${id}-c`, type: 'layout', layout: 'row', columns: [12], gap: 0, children: copy } as AnyNode,
      { id: `${id}-a`, type: 'layout', layout: 'row', columns: [12], gap: 0, children: actions } as AnyNode,
    ], 24, { align: 'center' })], style, 'Promotion');
  }
  return section(id, [...copy, ...actions], style, 'Promotion');
}

/** How to order, in three or four numbered steps. */
export function stepsSection(id: string, look: Look, steps: Slide[], o: TitledOptions & { variant?: 'cards' | 'columns' } = {}): SectionNode {
  const children = titled(id, o, false, look);
  if (o.variant === 'columns') {
    const cols = steps.map((s, i) => ({
      id: `${id}-c${i}`, type: 'layout', layout: 'row', columns: [12], gap: 0,
      children: [heading(`${id}-h${i}`, s.title, { align: 'left', color: o.titleColor, look, size: 'md' }), para(`${id}-p${i}`, s.description, { align: 'left', color: o.subtitleColor })],
    }) as AnyNode);
    children.push(row(`${id}-r`, steps.map(() => Math.floor(12 / steps.length)), cols, 24));
  } else {
    children.push(cards(`${id}-c`, steps, look, { perView: Math.min(4, steps.length), titleColor: o.titleColor, descColor: o.subtitleColor, entrance: 'zoom-in' }));
  }
  return section(id, children, bandStyle(o, '$bg', 48, 56, look), 'Comment commander');
}

/** Customer reviews as a carousel or as a grid of cards. */
export function testimonialsSection(id: string, look: Look, quotes: Quote[], o: TitledOptions & { variant?: 'carousel' | 'grid'; cardBg?: string; cardBorder?: string } = {}): SectionNode {
  const slides: Slide[] = quotes.map((q) => ({
    title: `${'★'.repeat(Math.max(1, Math.min(5, q.stars ?? 5)))}  ${q.name} · ${q.city}`,
    description: `« ${q.text} »`,
  }));
  const children = titled(id, o, false, look);
  if (o.variant === 'grid') children.push(cards(`${id}-c`, slides, look, { perView: Math.min(3, slides.length), cardBg: o.cardBg, cardBorder: o.cardBorder, titleColor: o.titleColor, descColor: o.subtitleColor, entrance: 'fade-in' }));
  else children.push(carousel(`${id}-c`, slides, look, { perView: slides.length > 3 ? 2 : 1, cardBg: o.cardBg, cardBorder: o.cardBorder, titleColor: o.titleColor, descColor: o.subtitleColor, speed: 5200 }));
  return section(id, children, bandStyle(o, look.band, 48, 56, look), 'Avis clients');
}

/** Frequently asked questions, as two columns of question and answer. */
export function faqSection(id: string, look: Look, faqs: Faq[], o: TitledOptions & { variant?: 'columns' | 'cards' } = {}): SectionNode {
  const children = titled(id, o, false, look);
  if (o.variant === 'cards') {
    children.push(cards(`${id}-c`, faqs.map((f) => ({ title: f.q, description: f.a })), look, { perView: Math.min(2, faqs.length), titleColor: o.titleColor, descColor: o.subtitleColor, hover: 'none', entrance: 'none' }));
    if (faqs.length > 2) children.push(cards(`${id}-c2`, faqs.slice(2, 4).map((f) => ({ title: f.q, description: f.a })), look, { perView: Math.min(2, faqs.length - 2), titleColor: o.titleColor, descColor: o.subtitleColor, hover: 'none', entrance: 'none', paddingTop: 0 }));
  } else {
    const half = Math.ceil(faqs.length / 2);
    const col = (items: Faq[], k: number): AnyNode => ({
      id: `${id}-col${k}`, type: 'layout', layout: 'row', columns: [12], gap: 0,
      children: items.flatMap((f, i) => [
        heading(`${id}-q${k}${i}`, f.q, { align: 'left', color: o.titleColor, paddingTop: 12, paddingBottom: 0, look, size: 'sm' }),
        para(`${id}-a${k}${i}`, f.a, { align: 'left', color: o.subtitleColor, paddingBottom: 12 }),
      ]),
    }) as AnyNode;
    children.push(row(`${id}-r`, [6, 6], [col(faqs.slice(0, half), 0), col(faqs.slice(half), 1)], 32));
  }
  return section(id, children, bandStyle(o, '$bg', 48, 56, look), 'Questions fréquentes');
}

/** A single-column story: a heading and two or three paragraphs beside a highlight card. */
export function storySection(id: string, look: Look, o: TitledOptions & { title: string; paragraphs: string[]; highlights?: Slide[]; cta?: string; ctaLink?: string; image?: string }): SectionNode {
  const copy: AnyNode[] = [
    heading(`${id}-t`, o.title, { align: 'left', color: o.titleColor, paddingTop: 0, look, size: look.kit.heading.size === 'md' ? 'lg' : look.kit.heading.size }),
    ...o.paragraphs.map((p, i) => para(`${id}-p${i}`, p, { align: 'left', color: o.subtitleColor, paddingBottom: 10 })),
  ];
  if (o.cta) copy.push(ghostButton(`${id}-b`, o.cta, look, { link: o.ctaLink ?? '/products', color: o.titleColor ?? '$text', paddingTop: 8 }));
  const left = { id: `${id}-c`, type: 'layout', layout: 'row', columns: [12], gap: 0, children: copy } as AnyNode;
  const children: AnyNode[] = o.image
    ? [row(`${id}-r`, [6, 6], [left, picture(`${id}-img`, o.image, { alt: o.title, maxHeight: 520 })], 40, { align: 'center' })]
    : o.highlights?.length
      ? [row(`${id}-r`, [7, 5], [left, cards(`${id}-hl`, o.highlights, look, { perView: 1, align: 'left', titleColor: o.titleColor, descColor: o.subtitleColor, entrance: 'fade-in' })], 32, { align: 'center' })]
      : copy;
  return section(id, children, bandStyle(o, look.band, 48, 56, look), 'Notre histoire');
}

/** A list of check-marked points, alone or beside a picture. */
export function featureSection(id: string, look: Look, o: TitledOptions & { kicker?: string; text?: string; items: { title: string; text?: string; icon?: string }[]; columns?: number; marker?: 'check' | 'dot' | 'number' | 'icon'; image?: string; imageSide?: 'left' | 'right'; cta?: string; ctaLink?: string; uppercase?: boolean }): SectionNode {
  const list = block(`${id}-fl`, 'feature_list', {
    kicker: o.kicker ?? '', title: o.title ?? '', text: o.text ?? '', items: o.items,
    columns: o.columns ?? (o.image ? 1 : 2), marker: o.marker ?? 'check', align: o.image ? 'left' : (o.align === 'center' ? 'center' : 'left'),
    titleSize: look.kit.heading.size === 'xl' ? 'xl' : 'lg', uppercase: o.uppercase ?? look.kit.heading.uppercase,
    titleColor: o.titleColor ?? '$text', textColor: o.subtitleColor ?? '$muted', markerColor: '$primary',
    ctaText: o.cta ?? '', ctaUrl: o.ctaLink ?? '/products', ctaBg: '$primary', ctaColor: look.onPrimary,
  });
  const children: AnyNode[] = o.image
    ? [row(`${id}-r`, o.imageSide === 'left' ? [6, 6] : [6, 6], o.imageSide === 'left' ? [picture(`${id}-img`, o.image, { alt: o.title, maxHeight: 520 }), list] : [list, picture(`${id}-img`, o.image, { alt: o.title, maxHeight: 520 })], 40, { align: 'center' })]
    : [list];
  return section(id, children, bandStyle(o, '$bg', 48, 56, look), 'Points forts');
}

/** One customer, in large type, on a band. */
export function quoteSection(id: string, look: Look, q: Quote, o: TitledOptions & { kicker?: string; size?: 'md' | 'lg' | 'xl'; serif?: boolean } = {}): SectionNode {
  const dark = o.background ? o.background === '$secondary' || o.background === '$primary' || (/^#[0-9a-f]{6}$/i.test(o.background) && isDark(o.background)) : look.dark;
  return section(id, [block(`${id}-q`, 'quote', {
    text: q.text, author: q.name, role: q.city, stars: q.stars ?? 5, kicker: o.kicker ?? '',
    align: o.align === 'left' ? 'left' : 'center', size: o.size ?? 'lg', serif: o.serif ?? (look.kit.hero.titleSize === 'xl' && look.kit.heading.uppercase),
    textColor: o.titleColor ?? (dark ? '#ffffff' : '$text'), mutedColor: o.subtitleColor ?? (dark ? 'rgba(255,255,255,0.72)' : '$muted'), starColor: dark ? '#fde68a' : '#f59e0b',
    maxWidth: 860, paddingTop: 8, paddingBottom: 8,
  })], bandStyle(o, '$secondary', 56, 56, look), 'Témoignage');
}

/** A row of chips: categories, tags, social links. */
export function chipsRow(id: string, look: Look, items: { label: string; url?: string }[], o: { prefix?: string; style?: 'pill' | 'outline' | 'text'; align?: 'left' | 'center' | 'right'; uppercase?: boolean; dark?: boolean; paddingTop?: number; paddingBottom?: number } = {}): AnyNode {
  const dark = o.dark ?? look.dark;
  return block(id, 'chips', {
    items, prefix: o.prefix ?? '', style: o.style ?? 'pill', align: o.align ?? 'center', size: 'md', uppercase: o.uppercase ?? false,
    bgColor: dark ? 'rgba(255,255,255,0.08)' : look.band, textColor: dark ? '#ffffff' : '$text', borderColor: dark ? 'rgba(255,255,255,0.22)' : look.cardBorder,
    paddingTop: o.paddingTop ?? 8, paddingBottom: o.paddingBottom ?? 8,
  });
}

export function chipsSection(id: string, look: Look, items: { label: string; url?: string }[], o: TitledOptions & { prefix?: string; style?: 'pill' | 'outline' | 'text'; uppercase?: boolean } = {}): SectionNode {
  const children = titled(id, o, false, look);
  children.push(chipsRow(`${id}-c`, look, items, { prefix: o.prefix, style: o.style, align: o.align ?? 'center', uppercase: o.uppercase }));
  return section(id, children, bandStyle(o, '$bg', 24, 24, look), 'Catégories');
}

/** Pictures in a mosaic. Rendered only when at least one picture exists. */
export function gallerySection(id: string, look: Look, images: { url: string; alt?: string; caption?: string; href?: string; span?: number; rows?: number }[], o: TitledOptions & { columns?: number; rowHeight?: number } = {}): SectionNode | null {
  const real = images.filter((im) => im.url);
  if (!real.length) return null;
  const children = titled(id, o, false, look);
  children.push(block(`${id}-g`, 'gallery', { images: real, columns: o.columns ?? 4, gap: 12, radius: look.kit.card.radius, rowHeight: o.rowHeight ?? 220, hover: 'zoom' }));
  return section(id, children, bandStyle(o, '$bg', 40, 48, look), 'Galerie');
}

/** Three info cards side by side: live figures, a portfolio, an order box. */
export function dataCardsSection(id: string, look: Look, specs: InfoCardSpec[], o: TitledOptions & { dark?: boolean } = {}): SectionNode {
  const children = titled(id, o, false, look);
  const cols = specs.slice(0, 4).map((spec, i) => infoCard(`${id}-c${i}`, look, { dark: o.dark ?? look.dark, align: 'center', ...spec }));
  children.push(row(`${id}-r`, cols.map(() => Math.floor(12 / cols.length)), cols, 20));
  return section(id, children, bandStyle(o, '$bg', 24, 40, look), 'Cartes chiffrées');
}

/** The urgency strip. */
export function countdownSection(id: string, text: string, o: TitledOptions = {}): SectionNode {
  return section(id, [block(`${id}-cd`, 'countdown', { text, paddingTop: 8, paddingBottom: 8 })], { background: o.background ?? '$bg', paddingTop: o.paddingTop ?? 8, paddingBottom: o.paddingBottom ?? 8, maxWidth: 1200 }, 'Offre limitée');
}

/** The closing call to action. */
export function ctaSection(id: string, look: Look, o: TitledOptions & { title: string; cta: string; ctaLink?: string; ctaBg?: string; ctaColor?: string; secondaryCta?: string; secondaryLink?: string }): SectionNode {
  const bg = o.background ?? '$primary';
  const titleColor = o.titleColor ?? look.onPrimary;
  const children: AnyNode[] = [
    statement(`${id}-h`, o.title, o.subtitle ?? '', { titleColor, subtitleColor: o.subtitleColor ?? titleColor, paddingTop: 8, paddingBottom: 8, look, align: 'center' }),
    button(`${id}-b`, o.cta, look, { link: o.ctaLink ?? '/products', bg: o.ctaBg ?? '$secondary', color: o.ctaColor ?? look.onSecondary, paddingTop: 8 }),
  ];
  if (o.secondaryCta) children.push(ghostButton(`${id}-b2`, o.secondaryCta, look, { link: o.secondaryLink ?? '/products', color: titleColor, border: { width: 2, color: titleColor }, paddingTop: 0 }));
  return section(id, children, { background: gradientOf(look, bg), paddingTop: Math.round((o.paddingTop ?? 48) * look.kit.section.spacing), paddingBottom: Math.round((o.paddingBottom ?? 48) * look.kit.section.spacing), maxWidth: o.maxWidth ?? look.kit.section.maxWidth, borderRadius: look.kit.section.radius }, 'Appel à l’action');
}

/** The WhatsApp bubble. Draws nothing in the flow; the compiler lifts it out as an overlay. */
export function whatsappSection(id: string, o: { headline?: string; nickname?: string; headerBg?: string; welcome?: string } = {}): SectionNode {
  return section(id, [block(`${id}-w`, 'whatsapp', {
    enableWidget: true,
    headline: o.headline ?? 'Une question ? Écrivez-nous',
    nickname: o.nickname ?? 'Service client',
    welcomeMessage: o.welcome ?? 'Bonjour ! Comment pouvons-nous vous aider ?',
    headerBg: o.headerBg ?? '$primary',
    animation: 'pulse',
  })], { paddingTop: 0, paddingBottom: 0 }, 'WhatsApp');
}

// ─────────────────────────────────────────────── chrome

export interface HeaderOptions {
  announcement?: string;
  announcementBg?: string;
  announcementColor?: string;
  bg?: string;
  text?: string;
  border?: string;
  links?: { label: string; url: string }[];
  cta?: string;
  ctaUrl?: string;
  ctaBg?: string;
  ctaColor?: string;
  cartBg?: string;
  align?: 'left' | 'center';
  sticky?: boolean;
  brandAlign?: 'left' | 'center';
  overlay?: boolean;
  linkCase?: 'normal' | 'upper';
  ctaRadius?: number;
  secondary?: string;
  secondaryUrl?: string;
  /** Search and account icons beside the cart. */
  icons?: boolean;
}

export const DEFAULT_LINKS = [
  { label: 'Accueil', url: '/' },
  { label: 'Boutique', url: '/products' },
  { label: 'Livraison', url: '/pages/livraison' },
  { label: 'Contact', url: '/pages/contact' },
];

export function headerPage(look: Look, o: HeaderOptions = {}): PageDocument {
  return page('page', [section('h', [block('sh', 'site_header', {
    brandText: '',
    announcementActive: Boolean(o.announcement),
    announcementText: o.announcement ?? '',
    announcementBg: o.announcementBg ?? '$primary',
    announcementColor: o.announcementColor ?? look.onPrimary,
    bgColor: o.bg ?? '$bg',
    textColor: o.text ?? '$text',
    borderColor: o.border ?? look.cardBorder,
    sticky: o.sticky ?? true,
    align: o.align ?? 'left',
    links: o.links ?? DEFAULT_LINKS,
    showCart: true,
    showSearch: Boolean(o.icons),
    showAccount: Boolean(o.icons),
    cartUrl: '/cart',
    cartBg: o.cartBg ?? look.band,
    ctaText: o.cta ?? 'Commander',
    ctaUrl: o.ctaUrl ?? '/products',
    ctaBg: o.ctaBg ?? '$primary',
    ctaColor: o.ctaColor ?? look.onPrimary,
    ctaRadius: o.ctaRadius ?? 999,
    secondaryText: o.secondary ?? '',
    secondaryUrl: o.secondaryUrl ?? '/pages/contact',
    brandAlign: o.brandAlign ?? 'left',
    overlay: Boolean(o.overlay),
    linkCase: o.linkCase ?? 'normal',
  })], undefined, 'En-tête')], {});
}

export interface FooterOptions {
  about?: string;
  badges?: string[];
  columns?: { title: string; links: { label: string; url: string }[] }[];
  copyright?: string;
  note?: string;
  bg?: string;
  text?: string;
  muted?: string;
  border?: string;
}

export const DEFAULT_FOOTER_COLUMNS = [
  { title: 'Boutique', links: [{ label: 'Tous les produits', url: '/products' }, { label: 'Mon panier', url: '/cart' }, { label: 'Suivre ma commande', url: '/pages/suivi' }] },
  { title: 'Aide', links: [{ label: 'Livraison & retours', url: '/pages/livraison' }, { label: 'Questions fréquentes', url: '/pages/faq' }, { label: 'Nous contacter', url: '/pages/contact' }] },
  { title: 'Informations', links: [{ label: 'À propos', url: '/pages/a-propos' }, { label: 'Conditions générales', url: '/pages/cgv' }, { label: 'Confidentialité', url: '/pages/confidentialite' }] },
];

export function footerPage(look: Look, o: FooterOptions = {}): PageDocument {
  return page('page', [section('f', [block('sf', 'site_footer', {
    brandText: '',
    about: o.about ?? 'Des produits sélectionnés avec soin, livrés partout au Maroc. Vous payez à la réception.',
    badges: o.badges ?? ['Livraison 24/48h', 'Paiement à la livraison', 'Support WhatsApp 7j/7'],
    columns: o.columns ?? DEFAULT_FOOTER_COLUMNS,
    socials: { instagram: '', facebook: '', tiktok: '', whatsapp: '' },
    copyright: o.copyright ?? '© 2026 — Tous droits réservés.',
    note: o.note ?? 'Paiement à la livraison — partout au Maroc',
    bgColor: o.bg ?? '$secondary',
    textColor: o.text ?? look.onSecondary,
    mutedColor: o.muted ?? (look.dark ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.72)'),
    borderColor: o.border ?? 'rgba(255,255,255,0.12)',
    paddingTop: 56,
    paddingBottom: 32,
  })], undefined, 'Pied de page')], {});
}

// ─────────────────────────────────────────────── the product and catalogue templates

export interface DetailOptions {
  buttonText?: string;
  buyNowText?: string;
  priceColor?: string;
  buttonBg?: string;
  buttonColor?: string;
  background?: string;
}

export function productPage(look: Look, o: DetailOptions, after: SectionNode[]): PageDocument {
  return page('product', [
    section('detail', [block('pd', 'product_detail', {
      showGallery: true, showDescription: true, showStock: true, showBuyNow: true,
      buttonText: o.buttonText ?? 'Ajouter au panier',
      buyNowText: o.buyNowText ?? 'Commander maintenant — paiement à la livraison',
      priceColor: o.priceColor ?? '$primary',
      buttonBg: o.buttonBg ?? '$primary',
      buttonColor: o.buttonColor ?? look.onPrimary,
      paddingTop: 24, paddingBottom: 24,
    }, { product: '$page.product' })], { background: o.background ?? '$bg', paddingTop: 8, paddingBottom: 16, maxWidth: 1200 }, 'Fiche produit'),
    ...after,
  ]);
}

export function cataloguePage(look: Look, o: TitledOptions & ProductsOptions & { title: string }, after: SectionNode[] = []): PageDocument {
  return page('collection', [
    section('grid', [
      statement('grid-t', o.title, o.subtitle ?? '', { titleColor: o.titleColor, subtitleColor: o.subtitleColor, paddingTop: 8, paddingBottom: 8, look }),
      products('grid-g', '$page.collection', look, { ...o, cols: o.cols ?? 3, layout: 'grid' }),
    ], bandStyle(o, '$bg', 24, 48, look), 'Catalogue'),
    ...after,
  ]);
}

// ─────────────────────────────────────────────── baking

/**
 * A store row carries a primary colour, a secondary colour and a font, and
 * nothing else: `$bg`, `$text` and `$muted` always resolve to the defaults
 * (white, ink, slate) whatever a theme meant by them, which is how a dark
 * theme came out as dark text on a dark ground. So a finished page keeps
 * `$primary` and `$secondary` — the two values a seller can change — and has
 * the other three written in as the literals the palette chose.
 */
export function bakeTokens(doc: PageDocument, p: PaletteLike): PageDocument {
  return resolveDocument(doc, {
    primary: '$primary',
    secondary: '$secondary',
    font: '$font',
    bg: p.bg,
    text: p.text,
    muted: p.muted,
  });
}

// ─────────────────────────────────────────────── looks

/** Relative luminance, for choosing ink that reads on a colour. */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}

export function isDark(hex: string): boolean {
  return luminance(hex) < 0.35;
}

export function inkOn(hex: string): string {
  return isDark(hex) ? '#ffffff' : '#0f172a';
}

/** Mixes a hex colour towards white or black by a fraction. */
export function mix(hex: string, towards: '#ffffff' | '#000000', amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const t = towards === '#ffffff' ? 255 : 0;
  const c = (v: number) => Math.round(v + (t - v) * amount);
  const r = c((n >> 16) & 255);
  const g = c((n >> 8) & 255);
  const b = c(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export interface PaletteLike {
  primary: string;
  secondary: string;
  bg: string;
  text: string;
  muted: string;
  accent?: string;
}

/** A Look derived from a palette, with overrides for what a theme wants otherwise. */
export function lookFor(p: PaletteLike, overrides: Partial<Look> = {}): Look {
  const dark = isDark(p.bg);
  return {
    dark,
    kit: KITS.clean,
    palette: p,
    accent: p.accent ?? p.primary,
    onPrimary: inkOn(p.primary),
    onSecondary: inkOn(p.secondary),
    card: dark ? mix(p.bg, '#ffffff', 0.06) : '#ffffff',
    cardBorder: dark ? 'rgba(255,255,255,0.10)' : mix(p.bg, '#000000', 0.08),
    band: dark ? mix(p.bg, '#ffffff', 0.035) : mix(p.bg, '#000000', 0.035),
    radius: 16,
    shadow: dark ? 'none' : 'md',
    ...overrides,
  };
}
