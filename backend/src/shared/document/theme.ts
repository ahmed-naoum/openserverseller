import type { AnyNode, PageDocument } from './types.js';
import type { LegacyBlock } from './migrate.js';

/**
 * Theme tokens: the handful of values a whole store shares.
 *
 * A block prop may carry a token instead of a literal — `themeColor:
 * "$primary"` — and follow the store's brand colour until a seller overrides
 * it on that block. That is how one change recolours a store, and how an
 * agent restyles one with a single command instead of two hundred.
 *
 * Resolution happens at the last moment before rendering, in the storefront
 * and in the compiler, through `resolveTokens`. The editor keeps the token
 * so the link survives; only what the visitor sees is resolved.
 *
 * Tokens are a fixed set, not a language. `$primary` resolves; `$primaryDark`
 * does not exist and stays as typed, which the colour allow-lists then
 * reject — visible, not silent.
 */

export interface Theme {
  primary: string;
  secondary: string;
  bg: string;
  text: string;
  muted: string;
  font: string;
}

export const DEFAULT_THEME: Theme = {
  primary: '#f97316',
  secondary: '#1e293b',
  bg: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  font: 'Inter',
};

export const TOKEN_NAMES = ['primary', 'secondary', 'bg', 'text', 'muted', 'font'] as const;
export type TokenName = (typeof TOKEN_NAMES)[number];

const TOKEN = /^\$([a-z]+)$/;

/** A store row's theme fields, as a Theme. Missing fields fall to the defaults. */
export function themeFromStore(store: { primaryColor?: unknown; secondaryColor?: unknown; fontFamily?: unknown } | null | undefined): Theme {
  return {
    ...DEFAULT_THEME,
    primary: typeof store?.primaryColor === 'string' && store.primaryColor ? store.primaryColor : DEFAULT_THEME.primary,
    secondary: typeof store?.secondaryColor === 'string' && store.secondaryColor ? store.secondaryColor : DEFAULT_THEME.secondary,
    font: typeof store?.fontFamily === 'string' && store.fontFamily ? store.fontFamily : DEFAULT_THEME.font,
  };
}

/** A landing page has no store; its theme colour stands in for `$primary`. */
export function themeFromLandingPage(landingPage: { themeColor?: unknown } | null | undefined): Theme {
  return {
    ...DEFAULT_THEME,
    primary: typeof landingPage?.themeColor === 'string' && landingPage.themeColor ? landingPage.themeColor : DEFAULT_THEME.primary,
  };
}

export function isToken(value: unknown): value is `$${TokenName}` {
  return typeof value === 'string' && TOKEN.test(value) && (TOKEN_NAMES as readonly string[]).includes(value.slice(1));
}

/** One value: a token becomes its theme value, anything else passes through. */
export function resolveValue(value: unknown, theme: Theme): unknown {
  if (!isToken(value)) return value;
  return theme[value.slice(1) as TokenName];
}

/**
 * Every string in a props object, recursively. Returns a new object; the
 * input is not touched, so the editor's document keeps its tokens.
 */
export function resolveProps<T>(props: T, theme: Theme): T {
  if (Array.isArray(props)) return props.map((v) => resolveProps(v, theme)) as unknown as T;
  if (props && typeof props === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props as Record<string, unknown>)) out[k] = resolveProps(v, theme);
    return out as T;
  }
  return resolveValue(props, theme) as T;
}

/** Flat blocks with their content resolved. What a storefront renderer gets. */
export function resolveBlocks(blocks: LegacyBlock[], theme: Theme): LegacyBlock[] {
  return blocks.map((b) => ({ ...b, content: resolveProps(b.content ?? {}, theme) }));
}

/** A document with every block's props and every node style resolved. */
export function resolveDocument(doc: PageDocument, theme: Theme): PageDocument {
  const visit = (node: AnyNode): AnyNode => {
    const style = node.style ? resolveProps(node.style, theme) : node.style;
    if (node.type === 'block') return { ...node, style, props: resolveProps(node.props ?? {}, theme) };
    return { ...node, style, children: node.children.map(visit) } as AnyNode;
  };
  return { ...doc, root: doc.root.map((s) => visit(s) as PageDocument['root'][number]) };
}
