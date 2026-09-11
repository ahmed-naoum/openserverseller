import React from 'react';
import BlockRenderer from '../helper/sitebuilder/BlockRenderer';
import { BACKEND_URL } from '../../lib/api';
import { ensureDocument, resolveDocument, themeFromStore } from '@shared/document/index.js';
import type { AnyNode, PageDocument, PageKind, NodeStyle } from '@shared/document/index.js';

/**
 * A page document rendered by the React storefront: sections with their
 * background and padding, rows as real columns, blocks through the same
 * BlockRenderer the builder uses.
 *
 * The compiled page is what customers normally get. This is the fallback —
 * the SPA route in development, or a page the compiler declines — and it
 * used to flatten the tree to a list of blocks, which lost every section
 * background and every row. A dark theme rendered as light text on white.
 * Now the structure survives; only the compiler's pixel-perfect CSS does not.
 */

const SHADOW: Record<string, string> = {
  sm: '0 1px 2px 0 rgba(0,0,0,.05)',
  md: '0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1)',
  lg: '0 10px 15px -3px rgba(0,0,0,.1),0 4px 6px -4px rgba(0,0,0,.1)',
  xl: '0 20px 25px -5px rgba(0,0,0,.1),0 8px 10px -6px rgba(0,0,0,.1)',
};

function css(style: NodeStyle | undefined): React.CSSProperties {
  if (!style) return {};
  const out: React.CSSProperties = {};
  if (style.paddingTop !== undefined) out.paddingTop = style.paddingTop;
  if (style.paddingBottom !== undefined) out.paddingBottom = style.paddingBottom;
  if (style.paddingLeft !== undefined) out.paddingLeft = style.paddingLeft;
  if (style.paddingRight !== undefined) out.paddingRight = style.paddingRight;
  if (style.marginTop !== undefined) out.marginTop = style.marginTop;
  if (style.marginBottom !== undefined) out.marginBottom = style.marginBottom;
  if (style.backgroundImage) {
    const overlay = style.overlay ? `linear-gradient(${style.overlay},${style.overlay}),` : '';
    const base = style.background && !String(style.background).startsWith('linear') ? ` ${style.background}` : '';
    out.background = `${overlay}url("${String(style.backgroundImage).startsWith('/') ? `${BACKEND_URL}${style.backgroundImage}` : style.backgroundImage}") center/cover no-repeat${base}`;
  } else if (style.background) out.background = style.background;
  if (style.borderRadius !== undefined) out.borderRadius = style.borderRadius;
  if (style.borderWidth) out.border = `${style.borderWidth}px solid ${style.borderColor || '#e2e8f0'}`;
  if (style.shadow && SHADOW[style.shadow]) out.boxShadow = SHADOW[style.shadow];
  if (style.align) out.alignItems = style.align === 'start' ? 'flex-start' : style.align === 'end' ? 'flex-end' : 'center';
  return out;
}

const ROW_CSS = `.sd-row{display:grid;width:100%;align-items:start}.sd-col{min-width:0;display:flex;flex-direction:column}@media(max-width:639px){.sd-row{grid-template-columns:1fr!important}}`;

function Node({ node, storeId }: { node: AnyNode; storeId: number | null }) {
  if (node.hidden) return null;
  if (node.type === 'block') {
    // The WhatsApp widget is a fixed overlay the storefront draws itself.
    if (node.block === 'whatsapp') return null;
    // No binding runs here (the compiler does that), so a products block gets
    // the store id and loads the catalogue itself.
    const content = node.block === 'products' && storeId ? { ...node.props, storeId } : node.props;
    return <BlockRenderer blocks={[{ id: node.id, type: node.block as any, content }]} />;
  }
  if (node.type === 'layout') {
    const count = node.children.length;
    const columns = Array.isArray(node.columns) && node.columns.length ? node.columns.map((c) => `${c}fr`).join(' ') : `repeat(${Math.max(1, count)},1fr)`;
    return (
      <div className="sd-row" style={{ gridTemplateColumns: columns, gap: node.gap ?? 16, ...css(node.style) }}>
        {node.children.map((child) => (
          <div key={child.id} className="sd-col">
            <Node node={child} storeId={storeId} />
          </div>
        ))}
      </div>
    );
  }
  const inner = node.children.map((child) => <Node key={child.id} node={child} storeId={storeId} />);
  if (node.implicit) return <>{inner}</>;
  return (
    <section style={{ width: '100%', ...css(node.style) }}>
      {node.style?.maxWidth ? <div style={{ maxWidth: node.style.maxWidth, margin: '0 auto', width: '100%' }}>{inner}</div> : inner}
    </section>
  );
}

interface Props {
  structure: unknown;
  kind?: PageKind;
  store: { id?: number; primaryColor?: unknown; secondaryColor?: unknown; fontFamily?: unknown } | null | undefined;
  className?: string;
}

export function documentOf(structure: unknown, kind: PageKind = 'home'): PageDocument {
  return ensureDocument(structure, kind);
}

export default function StoreDocument({ structure, kind = 'home', store, className = '' }: Props) {
  const theme = themeFromStore(store);
  const doc = resolveDocument(ensureDocument(structure, kind), theme);
  const bg = (doc.settings as any)?.backgroundColor;
  return (
    <div className={className} style={{ background: bg || undefined, fontFamily: theme.font ? `'${theme.font}', system-ui, sans-serif` : undefined }}>
      <style>{ROW_CSS}</style>
      {doc.root.map((section) => (
        <Node key={section.id} node={section} storeId={Number.isInteger(store?.id) ? Number(store!.id) : null} />
      ))}
    </div>
  );
}
