import type { BlockNode, PageDocument, PageKind, SectionNode } from './types.js';
import { DOCUMENT_VERSION, isBlock, isSection } from './types.js';

/**
 * Between the flat page every landing page is today and the tree.
 *
 * A flat page is `[{ id, type, content }, ...]` or `{ blocks: [...], settings }`.
 * Both shapes are in production. Either becomes one IMPLICIT section holding
 * the same blocks in the same order, and an implicit section renders no markup
 * of its own — so a migrated page compiles to exactly the bytes it did before.
 * That is the property that lets the tree land underneath thousands of live
 * pages without any of them being re-saved, and it is what `roundTrips` tests.
 *
 * The reverse direction exists so nothing has to change in storage yet: a
 * page that is still just a list of blocks can be saved back as one.
 */

export interface LegacyBlock {
  id: string;
  type: string;
  content?: Record<string, unknown>;
}

export type LegacyStructure = LegacyBlock[] | { blocks: LegacyBlock[]; settings?: Record<string, unknown> };

/** The id the migration gives the wrapper. Stable, so re-migrating is idempotent. */
export const IMPLICIT_SECTION_ID = 'page';

export function isLegacy(value: unknown): value is LegacyStructure {
  if (Array.isArray(value)) return true;
  return !!value && typeof value === 'object' && Array.isArray((value as any).blocks) && (value as any).version === undefined;
}

export function isDocument(value: unknown): value is PageDocument {
  return !!value && typeof value === 'object' && (value as any).version === DOCUMENT_VERSION && Array.isArray((value as any).root);
}

export function fromLegacy(structure: LegacyStructure, kind: PageKind = 'landing'): PageDocument {
  const list = Array.isArray(structure) ? structure : structure.blocks ?? [];
  const settings = Array.isArray(structure) ? {} : { ...(structure.settings ?? {}) };

  const children: BlockNode[] = list
    .filter((b) => b && typeof b === 'object' && typeof b.id === 'string' && typeof b.type === 'string')
    .map((b) => ({
      id: b.id,
      type: 'block',
      block: b.type,
      // Never share the stored object: the document is edited in place by
      // applyOps on a clone, but the caller's structure must stay untouched.
      props: JSON.parse(JSON.stringify(b.content ?? {})),
    }));

  const section: SectionNode = {
    id: IMPLICIT_SECTION_ID,
    type: 'section',
    implicit: true,
    children,
  };

  return { version: DOCUMENT_VERSION, kind, settings, root: [section] };
}

/**
 * Whether the document is still, structurally, a flat page: one implicit
 * section whose children are all blocks. Such a document can be stored in the
 * old shape with nothing lost.
 */
export function roundTrips(doc: PageDocument): boolean {
  if (doc.root.length !== 1) return false;
  const [section] = doc.root;
  if (!isSection(section) || !section.implicit) return false;
  if (section.style || section.label || section.hidden || section.responsive) return false;
  return section.children.every((c) => isBlock(c) && !c.style && !c.hidden && !c.responsive && !c.bind);
}

/** The flat shape, or null when the tree has structure the flat shape cannot hold. */
export function toLegacy(doc: PageDocument): { blocks: LegacyBlock[]; settings: Record<string, unknown> } | null {
  if (!roundTrips(doc)) return null;
  const [section] = doc.root;
  return {
    blocks: section.children.map((c) => {
      const b = c as BlockNode;
      return { id: b.id, type: b.block, content: JSON.parse(JSON.stringify(b.props ?? {})) };
    }),
    settings: JSON.parse(JSON.stringify(doc.settings ?? {})),
  };
}

/** Accept either shape and always return a document. */
export function ensureDocument(value: unknown, kind: PageKind = 'landing'): PageDocument {
  if (isDocument(value)) return value;
  if (isLegacy(value)) return fromLegacy(value, kind);
  return { version: DOCUMENT_VERSION, kind, settings: {}, root: [] };
}

/**
 * The blocks of ANY stored structure, in the flat shape every existing reader
 * expects — a bare array, `{ blocks, settings }`, or a version 3 document.
 *
 * Nine places across both apps used to open the structure with their own copy
 * of `Array.isArray(s) ? s : s.blocks || []`. A tree carries `root`, not
 * `blocks`, so each of those would have read a tree-shaped page as empty: the
 * pack matcher would have priced its leads at retail, the thank-you page would
 * have rendered nothing. This is the one reader they all share now.
 */
export function flatBlocks(structure: unknown): LegacyBlock[] {
  if (!structure) return [];
  let value: any = structure;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) return value as LegacyBlock[];
  if (isDocument(value)) {
    const out: LegacyBlock[] = [];
    const visit = (node: any) => {
      if (!node) return;
      if (node.type === 'block') out.push({ id: node.id, type: node.block, content: node.props ?? {} });
      else if (Array.isArray(node.children)) node.children.forEach(visit);
    };
    value.root.forEach(visit);
    return out;
  }
  return Array.isArray(value?.blocks) ? (value.blocks as LegacyBlock[]) : [];
}

/** Page settings of any stored shape. A bare array has none. */
export function settingsOf(structure: unknown): Record<string, unknown> {
  if (!structure || Array.isArray(structure)) return {};
  let value: any = structure;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (Array.isArray(value)) return {};
  return value?.settings && typeof value.settings === 'object' ? value.settings : {};
}
