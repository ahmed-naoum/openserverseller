import type {
  AnyNode,
  BlockNode,
  ContainerNode,
  LayoutNode,
  NodeId,
  PageDocument,
} from './types.js';
import { isBlock, isContainer, isLayout, isSection } from './types.js';
import { accepts, clone, find, maxDepth, nodeCount, subtreeDepth, subtreeIds, binds as allBinds } from './tree.js';
import { MAX_BINDS, MAX_BYTES, MAX_DEPTH, MAX_LABEL, MAX_NODES, NODE_ID } from './limits.js';
import { getBlock } from '../blocks/index.js';

/**
 * The command layer. Every change to a document goes through `applyOps`.
 *
 * The canvas dispatches an op when a person drags a block. An agent dispatches
 * the same op when a person asks for a store in a sentence. A template is a
 * list of them replayed. Undo is the inverse list this function hands back.
 * There is no second way to change a document, which is what makes the
 * editor, the API and the agent refuse the same things for the same reasons.
 *
 * Pure. The input document is never touched; the result carries a new one.
 * Every op is validated against the block registry and the limits before it
 * lands, and a batch is atomic by default: one refused op and the caller gets
 * the original document back with the refusal explained. An agent fixing a
 * typo and re-sending is cheaper than a store left half-built.
 */

export type Op =
  /** Insert a subtree. `parentId` null means the root; the node must then be a section. */
  | { op: 'insert'; parentId: NodeId | null; index: number; node: AnyNode }
  | { op: 'remove'; nodeId: NodeId }
  /**
   * Move a node. `index` is its position in the destination AFTER it has been
   * taken out of wherever it was — so moving a node one step down within the
   * same parent is `index + 1`, and the inverse of any move is a move back to
   * the original index.
   */
  | { op: 'move'; nodeId: NodeId; parentId: NodeId | null; index: number }
  /**
   * Set a field. `path` is dotted — `props.title`, `style.paddingTop`,
   * `responsive.md.hidden`, `columns`, `label`. `value: undefined` deletes.
   */
  | { op: 'set'; nodeId: NodeId; path: string; value: unknown }
  /** Bind a prop to compile-time data, or `null` to unbind. */
  | { op: 'bind'; nodeId: NodeId; prop: string; expression: string | null }
  /** Put contiguous siblings into a new layout. */
  | { op: 'wrap'; nodeIds: NodeId[]; wrapperId: NodeId; layout: 'row' | 'grid'; columns?: number[] }
  /** Copy a subtree beside itself. New ids come from `idFor` or the option's generator. */
  | { op: 'duplicate'; nodeId: NodeId; idFor?: Record<NodeId, NodeId> }
  /** Apply a named preset from the block's definition. Expands to `set` ops. */
  | { op: 'applyPreset'; nodeId: NodeId; preset: string }
  | { op: 'setPage'; path: string; value: unknown }
  | { op: 'rename'; nodeId: NodeId; label: string | null };

export interface Refusal {
  /** Position in the batch. */
  index: number;
  op: Op;
  reason: string;
}

export interface ApplyResult {
  doc: PageDocument;
  /** Ops that undo what was applied, already in the order to apply them. */
  inverse: Op[];
  applied: number;
  refused: Refusal[];
}

export interface ApplyOptions {
  /**
   * All-or-nothing (default). With `false`, refused ops are skipped and the
   * rest still land — for an editor that wants to keep what it can.
   */
  atomic?: boolean;
  /** Id generator for `duplicate` when the op names none. */
  newId?: () => NodeId;
}

class Refused extends Error {}

/** A random id, from the platform's crypto where it exists. */
export function makeId(): NodeId {
  const c = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

/**
 * The bind expression grammar. `$page.product`, `$store.cart`,
 * `$collection(summer-2026)`. Deliberately not a language: a name, an optional
 * dotted path, and at most one bracketed argument of safe characters.
 */
export const BIND_EXPRESSION = /^\$[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*(\([A-Za-z0-9_-]{1,64}\))?$/;

// ───────────────────────────────────────────────────────────── helpers

function childrenOf(doc: PageDocument, parentId: NodeId | null): AnyNode[] {
  if (parentId === null) return doc.root;
  const located = find(doc, parentId);
  if (!located) throw new Refused(`no node "${parentId}"`);
  if (!isContainer(located.node)) throw new Refused(`"${parentId}" is a block and cannot hold children`);
  return located.node.children;
}

function validateId(id: unknown): NodeId {
  if (typeof id !== 'string' || !NODE_ID.test(id)) {
    throw new Refused(`invalid node id ${JSON.stringify(id)}`);
  }
  return id;
}

/** A subtree is acceptable only if every node in it would be, one by one. */
function validateSubtree(node: AnyNode, existing: Set<NodeId>): void {
  validateId(node.id);
  if (existing.has(node.id)) throw new Refused(`duplicate node id "${node.id}"`);
  existing.add(node.id);

  if (node.label !== undefined && node.label !== null) {
    if (typeof node.label !== 'string' || node.label.length > MAX_LABEL) {
      throw new Refused(`label on "${node.id}" must be a string of at most ${MAX_LABEL} characters`);
    }
  }

  if (isBlock(node)) {
    validateBlock(node);
    return;
  }

  if (isLayout(node)) {
    if (node.layout !== 'row' && node.layout !== 'grid') {
      throw new Refused(`layout "${node.id}" must be a row or a grid`);
    }
    validateColumns(node.columns, node.id);
  } else if (!isSection(node)) {
    throw new Refused(`unknown node type on "${(node as any)?.id}"`);
  }

  if (!Array.isArray(node.children)) throw new Refused(`"${node.id}" has no children array`);
  for (const child of node.children) {
    if (!accepts(node, child)) {
      throw new Refused(`a ${(child as AnyNode).type} cannot sit inside a ${node.type} ("${node.id}")`);
    }
    validateSubtree(child, existing);
  }
}

function validateColumns(columns: unknown, id: NodeId): void {
  if (columns === undefined) return;
  if (!Array.isArray(columns) || !columns.length || columns.length > 12) {
    throw new Refused(`columns on "${id}" must be 1 to 12 fractions`);
  }
  for (const c of columns) {
    if (!Number.isInteger(c) || c < 1 || c > 12) throw new Refused(`columns on "${id}" must be whole twelfths`);
  }
}

function validateBlock(node: BlockNode): void {
  const def = getBlock(node.block);
  if (!def) throw new Refused(`unknown block type "${node.block}" on "${node.id}"`);

  const props = node.props ?? {};
  if (typeof props !== 'object' || Array.isArray(props)) throw new Refused(`props on "${node.id}" must be an object`);
  const parsed = def.schema.safeParse(props);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Refused(`${node.block} "${node.id}": ${first?.path.join('.') || 'props'} ${first?.message ?? 'invalid'}`);
  }

  for (const [prop, expression] of Object.entries(node.bind ?? {})) {
    validateBind(def.binds, node, prop, expression);
  }
}

function validateBind(allowed: readonly string[], node: BlockNode, prop: string, expression: unknown): void {
  if (!allowed.includes(prop)) {
    throw new Refused(`${node.block} "${node.id}" has no bindable prop "${prop}"`);
  }
  if (typeof expression !== 'string' || !BIND_EXPRESSION.test(expression)) {
    throw new Refused(`bind on "${node.id}.${prop}" is not a valid expression`);
  }
}

/** Walk a dotted path, creating objects as needed, and set or delete the leaf. */
function setPath(target: Record<string, any>, segments: string[], value: unknown): unknown {
  let cursor: any = target;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const next = segments[i + 1];
    if (cursor[seg] === undefined || cursor[seg] === null || typeof cursor[seg] !== 'object') {
      cursor[seg] = /^\d+$/.test(next) ? [] : {};
    }
    cursor = cursor[seg];
  }
  const leaf = segments[segments.length - 1];
  const previous = cursor[leaf];
  if (value === undefined) {
    if (Array.isArray(cursor) && /^\d+$/.test(leaf)) cursor.splice(Number(leaf), 1);
    else delete cursor[leaf];
    pruneEmpty(target, segments.slice(0, -1));
  } else {
    cursor[leaf] = value;
  }
  return previous;
}

/**
 * After a delete, drop the objects on the path that are now empty, innermost
 * first. Setting `style.marginTop` on a node with no `style` creates the
 * object; undoing that set must leave the node exactly as it was, not with an
 * empty `style: {}` — otherwise undo-then-compare never matches and the
 * history is full of phantom changes. Arrays are left alone (removing an
 * element is a different edit), and so are the containers that must exist.
 */
function pruneEmpty(target: Record<string, any>, segments: string[]): void {
  for (let i = segments.length - 1; i >= 0; i--) {
    const parent = getPath(target, segments.slice(0, i)) as Record<string, any> | undefined;
    const key = segments[i];
    const value = parent?.[key];
    if (Array.isArray(value)) return;
    if (!value || typeof value !== 'object' || Object.keys(value).length) return;
    // A block always has `props`; a page always has `settings`. Emptying
    // either is fine, removing it is not.
    if (i === 0 && (key === 'props' || key === 'settings')) return;
    delete parent[key];
  }
}

function getPath(target: any, segments: string[]): unknown {
  let cursor = target;
  for (const seg of segments) {
    if (cursor === undefined || cursor === null) return undefined;
    cursor = cursor[seg];
  }
  return cursor;
}

/** Which top-level fields `set` may touch, per node type. */
function settablePath(node: AnyNode, segments: string[]): void {
  const head = segments[0];
  const common = new Set(['label', 'hidden', 'locked', 'style', 'responsive']);
  if (common.has(head)) {
    if (head === 'responsive' && segments[1] !== 'md' && segments[1] !== 'sm') {
      throw new Refused(`responsive overrides are "md" or "sm", not "${segments[1]}"`);
    }
    return;
  }
  if (isBlock(node) && head === 'props') return;
  if (isLayout(node) && (head === 'columns' || head === 'gap' || head === 'layout')) return;
  throw new Refused(`"${segments.join('.')}" is not a field of a ${node.type}`);
}

function checkLimits(doc: PageDocument): void {
  const count = nodeCount(doc);
  if (count > MAX_NODES) throw new Refused(`page would have ${count} nodes, over the ${MAX_NODES} limit`);
  const depth = maxDepth(doc);
  if (depth > MAX_DEPTH) throw new Refused(`page would be nested ${depth} deep, over the ${MAX_DEPTH} limit`);
  const bindCount = allBinds(doc).length;
  if (bindCount > MAX_BINDS) throw new Refused(`page would bind ${bindCount} values, over the ${MAX_BINDS} limit`);
  const bytes = JSON.stringify(doc).length;
  if (bytes > MAX_BYTES) throw new Refused(`page would be ${Math.round(bytes / 1024)} KB, over the ${MAX_BYTES / 1024} KB limit`);
}

// ───────────────────────────────────────────────────────────── the ops

/** Each returns the ops that undo it, in the order to apply them. */
type Applier = (doc: PageDocument, op: any, options: Required<ApplyOptions>) => Op[];

const insert: Applier = (doc, op: Extract<Op, { op: 'insert' }>) => {
  const node = clone(op.node);
  const existing = new Set(doc.root.flatMap(subtreeIds));
  validateSubtree(node, existing);

  if (op.parentId === null) {
    if (!isSection(node)) throw new Refused(`only a section can sit at the root; "${node.id}" is a ${node.type}`);
  } else {
    const parent = find(doc, op.parentId);
    if (!parent) throw new Refused(`no node "${op.parentId}"`);
    if (!isContainer(parent.node)) throw new Refused(`"${op.parentId}" is a block and cannot hold children`);
    if (!accepts(parent.node, node)) throw new Refused(`a ${node.type} cannot sit inside a ${parent.node.type}`);
    if (parent.depth + subtreeDepth(node) > MAX_DEPTH) {
      throw new Refused(`inserting "${node.id}" there would nest deeper than ${MAX_DEPTH}`);
    }
  }

  const list = childrenOf(doc, op.parentId);
  const index = Math.max(0, Math.min(list.length, Math.trunc(op.index)));
  list.splice(index, 0, node);
  return [{ op: 'remove', nodeId: node.id }];
};

const remove: Applier = (doc, op: Extract<Op, { op: 'remove' }>) => {
  const located = find(doc, op.nodeId);
  if (!located) throw new Refused(`no node "${op.nodeId}"`);
  if (located.node.locked) throw new Refused(`"${op.nodeId}" is locked`);
  const list = located.parent ? located.parent.children : doc.root;
  const [removed] = list.splice(located.index, 1);
  return [{ op: 'insert', parentId: located.parent?.id ?? null, index: located.index, node: removed }];
};

const move: Applier = (doc, op: Extract<Op, { op: 'move' }>) => {
  const located = find(doc, op.nodeId);
  if (!located) throw new Refused(`no node "${op.nodeId}"`);
  if (located.node.locked) throw new Refused(`"${op.nodeId}" is locked`);

  const node = located.node;
  if (op.parentId === null) {
    if (!isSection(node)) throw new Refused(`only a section can sit at the root`);
  } else {
    if (subtreeIds(node).includes(op.parentId)) {
      throw new Refused(`cannot move "${op.nodeId}" into its own descendant`);
    }
    const dest = find(doc, op.parentId);
    if (!dest) throw new Refused(`no node "${op.parentId}"`);
    if (!isContainer(dest.node)) throw new Refused(`"${op.parentId}" is a block and cannot hold children`);
    if (!accepts(dest.node, node)) throw new Refused(`a ${node.type} cannot sit inside a ${dest.node.type}`);
    if (dest.depth + subtreeDepth(node) > MAX_DEPTH) {
      throw new Refused(`moving "${op.nodeId}" there would nest deeper than ${MAX_DEPTH}`);
    }
  }

  const fromList = located.parent ? located.parent.children : doc.root;
  fromList.splice(located.index, 1);
  const toList = childrenOf(doc, op.parentId);
  const index = Math.max(0, Math.min(toList.length, Math.trunc(op.index)));
  toList.splice(index, 0, node);

  return [{ op: 'move', nodeId: op.nodeId, parentId: located.parent?.id ?? null, index: located.index }];
};

const set: Applier = (doc, op: Extract<Op, { op: 'set' }>) => {
  const located = find(doc, op.nodeId);
  if (!located) throw new Refused(`no node "${op.nodeId}"`);
  const node = located.node;

  const segments = String(op.path ?? '').split('.').filter(Boolean);
  if (!segments.length) throw new Refused('empty path');
  settablePath(node, segments);

  if (segments[0] === 'label' && op.value !== undefined && op.value !== null) {
    if (typeof op.value !== 'string' || op.value.length > MAX_LABEL) {
      throw new Refused(`label must be a string of at most ${MAX_LABEL} characters`);
    }
  }

  const previous = setPath(node as any, segments, op.value === null ? undefined : op.value);

  // Re-validate what the write could have broken.
  if (isBlock(node)) validateBlock(node);
  if (isLayout(node)) validateColumns(node.columns, node.id);
  if (segments[0] === 'responsive' && segments[2] === 'columns' && isLayout(node)) {
    validateColumns((node.responsive as any)?.[segments[1]]?.columns, node.id);
  }
  // A section a person has styled is no longer the invisible wrapper the
  // migration made. Its markup now has to exist for the style to land on.
  if (isSection(node) && node.implicit) delete node.implicit;

  return [{ op: 'set', nodeId: op.nodeId, path: segments.join('.'), value: previous }];
};

const bind: Applier = (doc, op: Extract<Op, { op: 'bind' }>) => {
  const located = find(doc, op.nodeId);
  if (!located) throw new Refused(`no node "${op.nodeId}"`);
  if (!isBlock(located.node)) throw new Refused(`only a block can be bound`);
  const node = located.node;
  const def = getBlock(node.block);
  if (!def) throw new Refused(`unknown block type "${node.block}"`);

  const previous = node.bind?.[op.prop] ?? null;
  if (op.expression === null) {
    if (node.bind) delete node.bind[op.prop];
    if (node.bind && !Object.keys(node.bind).length) delete node.bind;
  } else {
    validateBind(def.binds, node, op.prop, op.expression);
    node.bind = { ...(node.bind ?? {}), [op.prop]: op.expression };
  }
  return [{ op: 'bind', nodeId: op.nodeId, prop: op.prop, expression: previous }];
};

const wrap: Applier = (doc, op: Extract<Op, { op: 'wrap' }>) => {
  if (!Array.isArray(op.nodeIds) || !op.nodeIds.length) throw new Refused('wrap needs at least one node');
  validateId(op.wrapperId);
  if (find(doc, op.wrapperId)) throw new Refused(`duplicate node id "${op.wrapperId}"`);
  if (op.layout !== 'row' && op.layout !== 'grid') throw new Refused('a wrapper is a row or a grid');
  validateColumns(op.columns, op.wrapperId);

  const located = op.nodeIds.map((id) => {
    const l = find(doc, id);
    if (!l) throw new Refused(`no node "${id}"`);
    if (!l.parent) throw new Refused(`"${id}" is a section and cannot be wrapped`);
    if (l.node.locked) throw new Refused(`"${id}" is locked`);
    return l;
  });

  const parent = located[0].parent as ContainerNode;
  const first = located[0].index;
  located.forEach((l, k) => {
    if (l.parent !== parent) throw new Refused('wrapped nodes must share a parent');
    if (l.index !== first + k) throw new Refused('wrapped nodes must be contiguous and in order');
  });

  const wrapper: LayoutNode = { id: op.wrapperId, type: 'layout', layout: op.layout, children: [] };
  if (op.columns) wrapper.columns = op.columns;
  const deepest = Math.max(...located.map((l) => subtreeDepth(l.node)));
  if (located[0].depth + deepest > MAX_DEPTH) {
    throw new Refused(`wrapping would nest deeper than ${MAX_DEPTH}`);
  }

  const taken = parent.children.splice(first, located.length) as LayoutNode['children'];
  wrapper.children = taken;
  parent.children.splice(first, 0, wrapper);

  const inverse: Op[] = op.nodeIds.map((id, k) => ({ op: 'move', nodeId: id, parentId: parent.id, index: first + k }));
  inverse.push({ op: 'remove', nodeId: op.wrapperId });
  return inverse;
};

const duplicate: Applier = (doc, op: Extract<Op, { op: 'duplicate' }>, options) => {
  const located = find(doc, op.nodeId);
  if (!located) throw new Refused(`no node "${op.nodeId}"`);

  const copy = clone(located.node);
  const existing = new Set(doc.root.flatMap(subtreeIds));
  const mapping = op.idFor ?? {};
  const rename = (node: AnyNode) => {
    const next = mapping[node.id] ?? options.newId();
    validateId(next);
    if (existing.has(next)) throw new Refused(`duplicate node id "${next}"`);
    existing.add(next);
    node.id = next;
    delete node.locked;
    if (isContainer(node)) node.children.forEach(rename);
  };
  rename(copy);

  const list = (located.parent ? located.parent.children : doc.root) as AnyNode[];
  list.splice(located.index + 1, 0, copy);
  return [{ op: 'remove', nodeId: copy.id }];
};

const applyPreset: Applier = (doc, op: Extract<Op, { op: 'applyPreset' }>, options) => {
  const located = find(doc, op.nodeId);
  if (!located) throw new Refused(`no node "${op.nodeId}"`);
  if (!isBlock(located.node)) throw new Refused('presets apply to blocks');
  const def = getBlock(located.node.block);
  const preset = def?.presets?.[op.preset];
  if (!preset) throw new Refused(`${located.node.block} has no preset "${op.preset}"`);

  const inverse: Op[] = [];
  for (const [key, value] of Object.entries(preset)) {
    inverse.unshift(...set(doc, { op: 'set', nodeId: op.nodeId, path: `props.${key}`, value }, options));
  }
  return inverse;
};

const setPage: Applier = (doc, op: Extract<Op, { op: 'setPage' }>) => {
  const segments = String(op.path ?? '').split('.').filter(Boolean);
  if (!segments.length) throw new Refused('empty path');
  if (segments[0] === 'kind') {
    const kinds = ['landing', 'home', 'collection', 'product', 'cart', 'checkout', 'thankyou', 'page'];
    if (!kinds.includes(String(op.value))) throw new Refused(`unknown page kind "${op.value}"`);
  } else if (segments[0] !== 'settings') {
    throw new Refused(`"${segments.join('.')}" is not a page field`);
  }
  const previous = setPath(doc as any, segments, op.value === null ? undefined : op.value);
  return [{ op: 'setPage', path: segments.join('.'), value: previous }];
};

const rename: Applier = (doc, op: Extract<Op, { op: 'rename' }>) => {
  const located = find(doc, op.nodeId);
  if (!located) throw new Refused(`no node "${op.nodeId}"`);
  if (op.label !== null && (typeof op.label !== 'string' || op.label.length > MAX_LABEL)) {
    throw new Refused(`label must be a string of at most ${MAX_LABEL} characters`);
  }
  const previous = located.node.label ?? null;
  if (op.label === null || op.label === '') delete located.node.label;
  else located.node.label = op.label;
  return [{ op: 'rename', nodeId: op.nodeId, label: previous }];
};

const APPLIERS: Record<Op['op'], Applier> = {
  insert,
  remove,
  move,
  set,
  bind,
  wrap,
  duplicate,
  applyPreset,
  setPage,
  rename,
};

// ───────────────────────────────────────────────────────────── entry

export function applyOps(doc: PageDocument, ops: Op[], options: ApplyOptions = {}): ApplyResult {
  const resolved: Required<ApplyOptions> = { atomic: options.atomic ?? true, newId: options.newId ?? makeId };

  let working = clone(doc);
  const inverse: Op[] = [];
  const refused: Refusal[] = [];
  let applied = 0;

  ops.forEach((op, index) => {
    const applier = APPLIERS[op?.op as Op['op']];
    const before = working;
    // Each op works on its own copy so a refusal mid-op (validation after a
    // partial write) cannot leave the working document torn.
    working = clone(working);
    try {
      if (!applier) throw new Refused(`unknown op "${(op as any)?.op}"`);
      const undo = applier(working, op, resolved);
      checkLimits(working);
      inverse.unshift(...undo);
      applied++;
    } catch (err) {
      working = before;
      if (!(err instanceof Refused)) throw err;
      refused.push({ index, op, reason: err.message });
    }
  });

  if (resolved.atomic && refused.length) {
    return { doc, inverse: [], applied: 0, refused };
  }
  return { doc: working, inverse, applied, refused };
}

/** Validate a whole document the way `applyOps` validates an insert. */
export function validateDocument(doc: PageDocument): string[] {
  const problems: string[] = [];
  try {
    if (!doc || doc.version !== 3) throw new Refused('not a version 3 document');
    if (!Array.isArray(doc.root)) throw new Refused('root must be an array of sections');
    const existing = new Set<NodeId>();
    for (const section of doc.root) {
      if (!isSection(section)) throw new Refused(`root child "${(section as any)?.id}" is not a section`);
      validateSubtree(section, existing);
    }
    checkLimits(doc);
  } catch (err) {
    if (!(err instanceof Refused)) throw err;
    problems.push(err.message);
  }
  return problems;
}
