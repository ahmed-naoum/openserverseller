import { z } from 'zod';

/**
 * The one place a block is described.
 *
 * Before this folder existed, a block's shape lived in five files that did not
 * know about each other: the React switch in BlockRenderer.tsx, the compiler
 * renderer under landingCompiler/blocks, the KNOWN_BLOCK_TYPES list in the
 * validator, and a default-content factory in each of the two builders. Adding
 * a field meant remembering all five, and forgetting one was silent — the
 * compiler rendered a default the builder never showed, or the builder saved a
 * key the compiler never read.
 *
 * A definition here is what every one of those consumers reads. The validator
 * derives its type list from the registry. The builders take their defaults
 * from it. The palette takes its labels from it. The inspector, once it is
 * generated rather than hand-written, takes its fields from the schema. And an
 * AI agent asked to build a page receives the same schema as a tool input, so
 * it can only ever produce a block the rest of the system accepts.
 *
 * This folder is imported by BOTH apps — the backend natively, the frontend
 * through the `@shared` alias — so it must stay pure: zod and TypeScript only,
 * no Node, no DOM, no Prisma, no React. Relative imports carry the `.js` suffix
 * the backend's NodeNext resolution requires; Vite resolves them to `.ts`.
 *
 * Schemas are deliberately PERMISSIVE for now: every field optional, unknown
 * keys passed through. Thousands of stored pages predate any schema and carry
 * shapes no definition anticipated (a height as a string, a colour as an empty
 * string). A strict schema would reject them on their next save. The schema
 * describes the intended shape for the inspector and the agent; enforcement
 * arrives block by block, after a dry run against production data — see
 * scripts/landing-validation-dryrun.ts for the precedent.
 */

export type BlockCategory =
  | 'chrome'
  | 'content'
  | 'media'
  | 'commerce'
  | 'conversion'
  | 'engagement';

/** Human-facing text in the three languages the dashboard ships. */
export interface BlockLabel {
  fr: string;
  en: string;
  ar?: string;
}

export interface InspectorGroup {
  title: string;
  fields: string[];
}

export interface BlockMeta {
  label: BlockLabel;
  /** One line, for the palette and for an agent's catalogue. */
  description: BlockLabel;
  category: BlockCategory;
  /** A lucide icon name. The frontend maps it to a component; nothing else reads it. */
  icon: string;
  /** A short badge in the palette ("Essentiel", "Sticky"). */
  badge?: string;
}

export interface BlockDefinition<S extends z.ZodTypeAny = z.ZodTypeAny> {
  /** The discriminator stored on every block. Never renamed once shipped. */
  type: string;
  meta: BlockMeta;
  /** The content shape. Permissive today; see the note above. */
  schema: S;
  /**
   * What a freshly added block carries. Complete and shippable, not empty
   * scaffolding: a seller who drops a block in and saves should get something
   * usable, not a blank to fill field by field. Must validate against `schema`
   * — a test enforces it.
   */
  defaults: z.input<S>;
  /** How the inspector groups the fields. Metadata until the inspector is generated. */
  inspector: { groups: InspectorGroup[] };
  /** Named partial contents a seller or an agent can apply in one step. */
  presets?: Record<string, Partial<z.input<S>>>;
  /**
   * Data this block needs resolved at compile time, as expression names —
   * 'page.product', 'collection'. Empty for a block whose content is entirely
   * in the saved page, which is every block today.
   */
  binds: readonly string[];
  /** Whether a compiled page carrying this block has to ship a script for it. */
  needsRuntime: boolean;
  /**
   * Whether the compiler renders this type today. False means a page carrying
   * it is served by the React fallback instead. Checked against the compiler's
   * registry by a test, so this flag cannot drift from the truth.
   */
  compiled: boolean;
}

export function defineBlock<S extends z.ZodTypeAny>(def: BlockDefinition<S>): BlockDefinition<S> {
  return def;
}

// ─────────────────────────────────────────────────────── shared fragments

/**
 * A CSS length in pixels. Numbers only in the intended shape; the compiler's
 * `num()` still tolerates the strings older rows carry.
 */
export const px = () => z.number().optional();

/**
 * A colour. Free text here on purpose: the compiler passes every colour through
 * `safeColor`, which is the allow-list that matters. A regex at this layer would
 * reject the `rgba(...)` and named colours real pages already use.
 */
export const color = () => z.string().optional();

/** A URL or a root-relative path. `safeUrl` is the gate at render time. */
export const url = () => z.string().optional();

/** The four outer spacing fields nearly every block carries. */
export const spacing = {
  paddingTop: px(),
  paddingBottom: px(),
  marginTop: px(),
  marginBottom: px(),
};

/** The inspector group for `spacing`, so blocks do not each restate it. */
export const SPACING_GROUP: InspectorGroup = {
  title: 'Espacement',
  fields: ['paddingTop', 'paddingBottom', 'marginTop', 'marginBottom'],
};

/** A link entry shared by the header, footer and future navigation blocks. */
export const link = z
  .object({
    label: z.string().optional(),
    url: z.string().optional(),
  })
  .passthrough();
