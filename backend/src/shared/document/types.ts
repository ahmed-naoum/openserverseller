/**
 * The page document: what a builder edits, what an agent operates on, and
 * what the compiler renders.
 *
 * A page is a tree with exactly three kinds of node. That restraint is not a
 * limitation; it is what keeps drag and drop predictable, the layers panel
 * readable, and the compiler simple.
 *
 *   section — a full-width band. The unit a seller reorders and an agent
 *             reasons about. Owns a background, padding and a container width.
 *   layout  — a row of columns or a grid. The only node that positions its
 *             children. Column widths are twelfths, with per-breakpoint
 *             overrides.
 *   block   — a leaf: a heading, an image, a checkout form, a header. Every
 *             block the platform has is one of these. A block never contains
 *             another node.
 *
 * Every existing landing page is a flat list of blocks. `migrate.ts` turns one
 * into a document with a single implicit section, and back again, without
 * changing a byte of what renders — so this shape can land under the existing
 * pages before any of them is re-saved in the new form.
 *
 * Pure TypeScript, shared with the frontend through the `@shared` alias.
 */

export type NodeId = string;

/** Breakpoints an override can target. Base is desktop; `md` is tablet and below, `sm` phones. */
export type Breakpoint = 'md' | 'sm';

export type PageKind =
  | 'landing'
  | 'home'
  | 'collection'
  | 'product'
  | 'cart'
  | 'checkout'
  | 'thankyou'
  | 'page';

/**
 * The style set every node shares: spacing, background, border, visibility.
 * Small on purpose. Block-specific appearance lives in the block's own props,
 * validated by its schema; this is the part the inspector's Style tab shows
 * for any node whatever its type.
 */
export interface NodeStyle {
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  marginTop?: number;
  marginBottom?: number;
  /** A colour, or a linear-gradient(...). */
  background?: string;
  /** A photograph covering the node, under `overlay` and over `background`. */
  backgroundImage?: string;
  /** A colour laid over the photograph (rgba for transparency). */
  overlay?: string;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  /** Section only: the inner container's max width in px. */
  maxWidth?: number;
  /** Horizontal alignment of children inside a column. */
  align?: 'start' | 'center' | 'end';
}

/** Per-breakpoint overrides. Only the keys present override the base. */
export interface ResponsiveOverride {
  hidden?: boolean;
  style?: NodeStyle;
  /** Layout only: column fractions at this breakpoint. */
  columns?: number[];
}

export interface BaseNode {
  id: NodeId;
  /** A name a person or an agent can refer to: "Hero", "Trust badges". */
  label?: string;
  hidden?: boolean;
  /** A locked node refuses move and remove until unlocked. */
  locked?: boolean;
  style?: NodeStyle;
  responsive?: Partial<Record<Breakpoint, ResponsiveOverride>>;
}

export interface SectionNode extends BaseNode {
  type: 'section';
  /**
   * True on the section `migrate.ts` wraps a flat page in. An implicit section
   * renders no markup of its own, so a migrated page compiles byte-identically
   * to its flat original. Editing it in the builder clears the flag.
   */
  implicit?: boolean;
  children: ContainerChild[];
}

export interface LayoutNode extends BaseNode {
  type: 'layout';
  layout: 'row' | 'grid';
  /**
   * Column widths in twelfths — [7, 5] is a 7/12 + 5/12 row. Absent means
   * equal columns. Children fill columns in order; a row with three children
   * and `columns: [6, 6]` wraps the third onto a new line.
   */
  columns?: number[];
  gap?: number;
  children: ContainerChild[];
}

export interface BlockNode extends BaseNode {
  type: 'block';
  /** The registry type: 'express_checkout', 'site_header', ... */
  block: string;
  /** The block's own content, validated by its registry schema. */
  props: Record<string, unknown>;
  /**
   * What the block needs resolved at compile time, by prop name:
   * `{ product: '$page.product' }`, `{ items: '$collection(summer)' }`.
   * Only expressions the block's definition lists in `binds` are accepted.
   */
  bind?: Record<string, string>;
}

export type ContainerChild = LayoutNode | BlockNode;
export type AnyNode = SectionNode | LayoutNode | BlockNode;
export type ContainerNode = SectionNode | LayoutNode;

/** Page-level settings. `passthrough` at the schema level: the legacy `settings` object rides along. */
export interface PageSettings {
  maxWidth?: number;
  background?: string;
  title?: string;
  description?: string;
  /** Whether the store's global header/footer sections show on this page. */
  globalSections?: boolean;
  [key: string]: unknown;
}

export const DOCUMENT_VERSION = 3 as const;

export interface PageDocument {
  version: typeof DOCUMENT_VERSION;
  kind: PageKind;
  settings: PageSettings;
  root: SectionNode[];
}

export function isSection(node: AnyNode | undefined): node is SectionNode {
  return !!node && node.type === 'section';
}
export function isLayout(node: AnyNode | undefined): node is LayoutNode {
  return !!node && node.type === 'layout';
}
export function isBlock(node: AnyNode | undefined): node is BlockNode {
  return !!node && node.type === 'block';
}
export function isContainer(node: AnyNode | undefined): node is ContainerNode {
  return isSection(node) || isLayout(node);
}
