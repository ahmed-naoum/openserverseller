import type { AnyNode, PageDocument } from './types.js';
import { isBlock, isLayout } from './types.js';

/**
 * A compact view of a document for whoever cannot read the whole thing: the
 * layers panel, and an agent that has to decide what to do next without
 * paying for every prop of every block on every turn.
 *
 *   section#page (implicit)
 *     block#b1 hero "Offre Spéciale !"
 *     layout#l1 row [7,5]
 *       block#b2 image
 *       block#b3 express_checkout "اطلب الآن" ⇐ product=$page.product
 */

export interface OutlineNode {
  id: string;
  type: 'section' | 'layout' | 'block';
  block?: string;
  label?: string;
  /** The most title-like prop, for a glance. */
  text?: string;
  hidden?: boolean;
  locked?: boolean;
  columns?: number[];
  bind?: Record<string, string>;
  children?: OutlineNode[];
}

/** Props that usually say what a block is about, in the order to try them. */
const GLANCE_PROPS = ['title', 'text', 'brandText', 'headline', 'buttonText', 'alt', 'url'];

function glance(node: AnyNode): string | undefined {
  if (!isBlock(node)) return undefined;
  for (const key of GLANCE_PROPS) {
    const v = node.props?.[key];
    if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 60);
  }
  return undefined;
}

export function outlineTree(doc: PageDocument): OutlineNode[] {
  const build = (node: AnyNode): OutlineNode => {
    const out: OutlineNode = { id: node.id, type: node.type };
    if (node.label) out.label = node.label;
    if (node.hidden) out.hidden = true;
    if (node.locked) out.locked = true;
    if (isBlock(node)) {
      out.block = node.block;
      const text = glance(node);
      if (text) out.text = text;
      if (node.bind && Object.keys(node.bind).length) out.bind = { ...node.bind };
    } else {
      if (isLayout(node) && node.columns) out.columns = [...node.columns];
      out.children = node.children.map(build);
    }
    return out;
  };
  return doc.root.map(build);
}

export function outlineText(doc: PageDocument): string {
  const lines: string[] = [];
  const emit = (node: AnyNode, depth: number) => {
    const indent = '  '.repeat(depth);
    const parts: string[] = [`${node.type}#${node.id}`];
    if (isBlock(node)) parts.push(node.block);
    if (isLayout(node)) parts.push(node.layout + (node.columns ? ` [${node.columns.join(',')}]` : ''));
    if (node.type === 'section' && node.implicit) parts.push('(implicit)');
    if (node.label) parts.push(`"${node.label}"`);
    const text = glance(node);
    if (text && !node.label) parts.push(`"${text}"`);
    if (node.hidden) parts.push('(hidden)');
    if (node.locked) parts.push('(locked)');
    if (isBlock(node) && node.bind) {
      parts.push('⇐ ' + Object.entries(node.bind).map(([k, v]) => `${k}=${v}`).join(' '));
    }
    lines.push(indent + parts.join(' '));
    if (!isBlock(node)) node.children.forEach((c) => emit(c, depth + 1));
  };
  doc.root.forEach((s) => emit(s, 0));
  return lines.join('\n');
}
