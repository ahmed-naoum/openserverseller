import type { AnyNode, LayoutNode, NodeStyle, PageDocument, SectionNode } from '../../shared/document/types.js';
import { isBlock, isLayout, isSection } from '../../shared/document/types.js';
import type { LegacyBlock } from '../../shared/document/migrate.js';
import { safeColor, safeBackground, safeUrl, safeIdent, num } from './escape.js';

/**
 * Renders the structure of a tree document — sections and layouts — around
 * the blocks the existing renderers produce.
 *
 * A page that is still a flat list never reaches this file: `roundTrips()`
 * says so and `renderDocument` takes the old path, byte for byte. Only a page
 * with real structure — a styled section, a row of columns, a responsive
 * override — is rendered here. That is the line that lets the tree land
 * underneath every live page without changing one of them.
 *
 * Everything is CSS. Columns are a grid, stacking on phones by default, and
 * responsive overrides become media rules keyed on a per-node class. There is
 * no script in a layout, and there never should be.
 */

export const LAYOUT_CSS =
  `.sec{width:100%}` +
  `.sec-in{margin:0 auto;width:100%}` +
  `.lay{display:grid;gap:16px;width:100%;align-items:start}` +
  `.col{min-width:0;display:flex;flex-direction:column}`;

/** Breakpoints match the builder: `md` is tablets and below, `sm` phones. */
const MEDIA: Record<'md' | 'sm', string> = {
  md: '(max-width:1023px)',
  sm: '(max-width:639px)',
};

const SHADOW: Record<string, string> = {
  sm: '0 1px 2px 0 rgba(0,0,0,.05)',
  md: '0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1)',
  lg: '0 10px 15px -3px rgba(0,0,0,.1),0 4px 6px -4px rgba(0,0,0,.1)',
  xl: '0 20px 25px -5px rgba(0,0,0,.1),0 8px 10px -6px rgba(0,0,0,.1)',
};

const LENGTHS: [keyof NodeStyle, string][] = [
  ['paddingTop', 'padding-top'],
  ['paddingBottom', 'padding-bottom'],
  ['paddingLeft', 'padding-left'],
  ['paddingRight', 'padding-right'],
  ['marginTop', 'margin-top'],
  ['marginBottom', 'margin-bottom'],
];

/** The shared style set as CSS declarations, every value through the allow-lists. */
export function styleDeclarations(style: NodeStyle | undefined): string {
  if (!style) return '';
  const out: string[] = [];

  for (const [key, prop] of LENGTHS) {
    const v = style[key];
    if (v !== undefined && v !== null) out.push(`${prop}:${num(v, 0, 0, 2000)}px`);
  }
  // A section can carry a colour, a gradient, a photograph, and a colour laid
  // over the photograph — the reference designs' opening bands are all four.
  // One `background` declaration: the overlay is a flat gradient layer, the
  // photograph covers, and a plain colour rides on the last layer.
  const image = style.backgroundImage ? safeUrl(style.backgroundImage) : '';
  const base = style.background ? safeBackground(style.background, 'transparent') : '';
  if (image) {
    const overlay = style.overlay ? safeColor(style.overlay, '') : '';
    const layers = [
      overlay && overlay !== 'transparent' ? `linear-gradient(${overlay},${overlay})` : '',
      `url(&quot;${image}&quot;) center/cover no-repeat${base && !base.startsWith('linear') ? ` ${base}` : ''}`,
    ].filter(Boolean);
    out.push(`background:${layers.join(',')}`);
  } else if (base) out.push(`background:${base}`);
  if (style.borderRadius !== undefined) out.push(`border-radius:${num(style.borderRadius, 0, 0, 500)}px`);
  if (style.borderWidth) {
    out.push(`border:${num(style.borderWidth, 1, 0, 50)}px solid ${safeColor(style.borderColor, '#e2e8f0')}`);
  }
  if (style.shadow && SHADOW[style.shadow]) out.push(`box-shadow:${SHADOW[style.shadow]}`);
  if (style.align) {
    const map = { start: 'flex-start', center: 'center', end: 'flex-end' } as const;
    out.push(`align-items:${map[style.align] ?? 'stretch'}`);
  }
  return out.join(';');
}

function columnsTrack(columns: number[] | undefined, count: number): string {
  if (Array.isArray(columns) && columns.length) {
    return columns.map((c) => `${num(c, 1, 1, 12)}fr`).join(' ');
  }
  return `repeat(${Math.max(1, Math.min(12, count))},1fr)`;
}

function cls(node: AnyNode): string {
  return `n-${safeIdent(node.id, 'x')}`;
}

export interface TreeRender {
  html: string;
  /** Per-node responsive rules. Empty when no node needs any. */
  css: string;
}

/**
 * `renderBlock` receives each block in document order with its running index,
 * hidden or not, so indices line up with the flat list the rest of the
 * compiler computed its context from.
 */
export function renderTree(
  doc: PageDocument,
  renderBlock: (block: LegacyBlock, index: number) => string
): TreeRender {
  let index = 0;
  const rules: string[] = [];

  const responsiveRules = (node: AnyNode): void => {
    const selector = `.${cls(node)}`;
    for (const bp of ['md', 'sm'] as const) {
      const override = node.responsive?.[bp];
      const decls: string[] = [];
      if (override?.hidden) decls.push('display:none');
      if (override?.style) {
        const s = styleDeclarations(override.style);
        if (s) decls.push(s);
      }
      if (isLayout(node) && override?.columns) {
        decls.push(`grid-template-columns:${columnsTrack(override.columns, node.children.length)}`);
      } else if (isLayout(node) && bp === 'sm' && !override?.columns) {
        // Phones stack a row by default. A seller who wants two columns on a
        // phone says so with an `sm.columns` override, and then this rule is
        // not emitted for that node.
        decls.push('grid-template-columns:1fr');
      }
      if (decls.length) rules.push(`@media ${MEDIA[bp]}{${selector}{${decls.join(';')}}}`);
    }
  };

  const render = (node: AnyNode): string => {
    if (isBlock(node)) {
      const i = index++;
      if (node.hidden) return '';
      return renderBlock({ id: node.id, type: node.block, content: node.props ?? {} }, i);
    }

    if (isLayout(node)) return renderLayout(node);
    return renderSection(node);
  };

  const renderSection = (node: SectionNode): string => {
    const inner = node.children.map(render).join('');
    if (node.hidden) return '';
    // The wrapper the migration made carries no style and no markup.
    if (node.implicit) return inner;

    responsiveRules(node);
    const style = styleDeclarations(node.style);
    const maxWidth = node.style?.maxWidth ? `max-width:${num(node.style.maxWidth, 1152, 280, 1920)}px` : '';
    return (
      `<section class="sec ${cls(node)}"${style ? ` style="${style}"` : ''}>` +
      (maxWidth ? `<div class="sec-in" style="${maxWidth}">${inner}</div>` : inner) +
      `</section>`
    );
  };

  const renderLayout = (node: LayoutNode): string => {
    const cols = node.children.map((child) => {
      const html = render(child);
      return `<div class="col">${html}</div>`;
    });
    if (node.hidden) return '';

    // The column track is a class rule, not an inline style: the phone and
    // tablet rules responsiveRules() emits are class rules too, and an inline
    // declaration would beat both — the row would never stack on a phone.
    rules.push(`.${cls(node)}{grid-template-columns:${columnsTrack(node.columns, node.children.length)}}`);
    responsiveRules(node);
    const decls = [
      node.gap !== undefined ? `gap:${num(node.gap, 16, 0, 200)}px` : '',
      styleDeclarations(node.style),
    ]
      .filter(Boolean)
      .join(';');
    return `<div class="lay ${cls(node)}"${decls ? ` style="${decls}"` : ''}>${cols.join('')}</div>`;
  };

  const html = doc.root.map((section) => (isSection(section) ? renderSection(section) : '')).join('');
  return { html, css: rules.join('') };
}
