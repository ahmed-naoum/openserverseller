import type {
  AnyNode,
  BlockNode,
  ContainerChild,
  ContainerNode,
  NodeId,
  PageDocument,
  SectionNode,
} from './types.js';
import { isBlock, isContainer, isSection } from './types.js';

/**
 * Read-only walks over a document. Nothing here mutates; `ops.ts` owns change.
 */

export interface Located {
  node: AnyNode;
  /** null for a top-level section. */
  parent: ContainerNode | null;
  index: number;
  /** 1 for a top-level section. */
  depth: number;
  /** Ids from the root down to and including this node. */
  path: NodeId[];
}

/** Every node, depth-first, in document order. */
export function walk(doc: PageDocument): Located[] {
  const out: Located[] = [];

  const visit = (node: AnyNode, parent: ContainerNode | null, index: number, depth: number, path: NodeId[]) => {
    const here = [...path, node.id];
    out.push({ node, parent, index, depth, path: here });
    if (isContainer(node)) {
      node.children.forEach((child, i) => visit(child, node, i, depth + 1, here));
    }
  };

  doc.root.forEach((section, i) => visit(section, null, i, 1, []));
  return out;
}

/** Locate one node, or undefined. Linear — documents are small by construction. */
export function find(doc: PageDocument, id: NodeId): Located | undefined {
  return walk(doc).find((l) => l.node.id === id);
}

export function nodeCount(doc: PageDocument): number {
  return walk(doc).length;
}

export function maxDepth(doc: PageDocument): number {
  return walk(doc).reduce((m, l) => Math.max(m, l.depth), 0);
}

/** Depth of a subtree on its own, counting its root as 1. */
export function subtreeDepth(node: AnyNode): number {
  if (!isContainer(node)) return 1;
  return 1 + node.children.reduce((m, c) => Math.max(m, subtreeDepth(c)), 0);
}

export function subtreeIds(node: AnyNode): NodeId[] {
  const ids: NodeId[] = [node.id];
  if (isContainer(node)) for (const c of node.children) ids.push(...subtreeIds(c));
  return ids;
}

export function subtreeSize(node: AnyNode): number {
  return subtreeIds(node).length;
}

/** Every block leaf in document order, with the id path that leads to it. */
export function blocks(doc: PageDocument): { node: BlockNode; path: NodeId[] }[] {
  return walk(doc)
    .filter((l): l is Located & { node: BlockNode } => isBlock(l.node))
    .map((l) => ({ node: l.node, path: l.path }));
}

/** Every bind expression on the page, for the limit and for the compiler. */
export function binds(doc: PageDocument): { nodeId: NodeId; prop: string; expression: string }[] {
  const out: { nodeId: NodeId; prop: string; expression: string }[] = [];
  for (const { node } of blocks(doc)) {
    for (const [prop, expression] of Object.entries(node.bind ?? {})) {
      out.push({ nodeId: node.id, prop, expression });
    }
  }
  return out;
}

/**
 * Which node types a container accepts.
 *
 * A section takes layouts and blocks. A layout takes layouts and blocks. A
 * block takes nothing. Sections only ever live at the root, which is why they
 * are absent from both lists — putting a section inside a section is the
 * nesting mistake this rule exists to refuse.
 */
export function accepts(parent: ContainerNode, child: AnyNode): child is ContainerChild {
  if (isSection(child)) return false;
  return isSection(parent) || parent.type === 'layout';
}

/** A structurally shared deep copy of the document — plain data, no methods. */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function sections(doc: PageDocument): SectionNode[] {
  return doc.root;
}
