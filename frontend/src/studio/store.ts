import { create } from 'zustand';
import toast from 'react-hot-toast';
import {
  applyOps,
  find,
  makeId,
  type Op,
  type PageDocument,
  type SectionNode,
  type AnyNode,
  type NodeId,
} from '@shared/document/index.js';
import { defaultsFor } from '@shared/blocks/index.js';
import { DEFAULT_THEME, type Theme } from '@shared/document/theme.js';
import { studioApi, type StudioPagePayload, type StudioTarget, type VersionSummary } from './api';
import type { Template } from '@shared/templates/index.js';

/**
 * The editor's state, and the only way it changes: `dispatch(ops)`.
 *
 * Every panel — canvas drag, layers reorder, inspector field, library insert —
 * builds an op and dispatches it. The op runs through the shared `applyOps`
 * right here, so the canvas repaints before the network is involved and the
 * refusal, if there is one, is the same one the server would give. Applied ops
 * queue up in `pending` and go to the server on save as one batch; the inverse
 * ops `applyOps` hands back are the undo stack.
 *
 * There is no other setter for the document. That is the whole design.
 */

export type Viewport = 'desktop' | 'tablet' | 'mobile';
export type LeftTab = 'library' | 'layers' | 'history' | 'agent';

interface StudioState {
  target: StudioTarget | null;
  doc: PageDocument | null;
  page: StudioPagePayload['page'] | null;
  link: StudioPagePayload['link'] | null;
  meta: StudioPagePayload['target'] | null;
  /** What tokens resolve to on the canvas: the store's brand values. */
  theme: Theme;
  /** The store a store target belongs to; null for a landing page. */
  storeId: number | null;
  loading: boolean;
  saving: boolean;
  publishing: boolean;
  error: string | null;
  /** A draft exists on the server; the document is not what visitors see. */
  hasDraft: boolean;
  versions: VersionSummary[];

  selectedId: NodeId | null;
  viewport: Viewport;
  leftTab: LeftTab;

  /** Ops applied locally since the last successful save, in order. */
  pending: Op[];
  /** Each entry undoes one dispatched batch. */
  undoStack: Op[][];
  redoStack: Op[][];

  load: (target: StudioTarget) => Promise<void>;
  dispatch: (ops: Op[], options?: { label?: string }) => boolean;
  undo: () => void;
  redo: () => void;
  save: () => Promise<boolean>;
  publish: (label?: string) => Promise<boolean>;
  discard: () => Promise<void>;
  restore: (versionId: number) => Promise<void>;
  applyTemplate: (template: Template) => void;
  select: (id: NodeId | null) => void;
  setViewport: (v: Viewport) => void;
  setLeftTab: (t: LeftTab) => void;

  /** Convenience builders every panel shares. */
  insertBlock: (blockType: string, parentId: NodeId, index: number) => void;
  insertSection: (sectionNode: SectionNode, index?: number) => void;
  moveNode: (nodeId: NodeId, parentId: NodeId | null, index: number) => void;
  removeNode: (nodeId: NodeId) => void;
  duplicateNode: (nodeId: NodeId) => void;
  setField: (nodeId: NodeId, path: string, value: unknown) => void;
  wrapInRow: (nodeIds: NodeId[], columns?: number[]) => void;
  selectedNode: () => AnyNode | null;
}

export const useStudio = create<StudioState>((set, get) => ({
  target: null,
  doc: null,
  page: null,
  link: null,
  meta: null,
  theme: DEFAULT_THEME,
  storeId: null,
  loading: false,
  saving: false,
  publishing: false,
  error: null,
  hasDraft: false,
  versions: [],
  selectedId: null,
  viewport: 'desktop',
  leftTab: 'library',
  pending: [],
  undoStack: [],
  redoStack: [],

  async load(target) {
    set({ loading: true, error: null, target });
    try {
      const res = await studioApi.get(target);
      const data = res.data.data;
      set({
        doc: data.document,
        page: data.page ?? null,
        link: data.link ?? null,
        meta: data.target,
        theme: { ...DEFAULT_THEME, ...(data.theme ?? {}) },
        storeId: Number.isInteger(data.store?.id) ? Number(data.store!.id) : null,
        hasDraft: Boolean(data.hasDraft),
        versions: data.versions ?? [],
        pending: [],
        undoStack: [],
        redoStack: [],
        selectedId: null,
        loading: false,
      });
    } catch (err: any) {
      set({ loading: false, error: err?.response?.data?.message || 'Impossible de charger la page.' });
    }
  },

  dispatch(ops) {
    const { doc } = get();
    if (!doc) return false;
    const result = applyOps(doc, ops, { newId: makeId });
    if (result.refused.length) {
      toast.error(result.refused[0].reason);
      return false;
    }
    set((s) => ({
      doc: result.doc,
      pending: [...s.pending, ...ops],
      undoStack: [...s.undoStack, result.inverse],
      redoStack: [],
    }));
    return true;
  },

  undo() {
    const { doc, undoStack } = get();
    if (!doc || !undoStack.length) return;
    const inverse = undoStack[undoStack.length - 1];
    const result = applyOps(doc, inverse, { newId: makeId });
    if (result.refused.length) {
      toast.error('Impossible d\'annuler : ' + result.refused[0].reason);
      return;
    }
    set((s) => ({
      doc: result.doc,
      pending: [...s.pending, ...inverse],
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, result.inverse],
    }));
  },

  redo() {
    const { doc, redoStack } = get();
    if (!doc || !redoStack.length) return;
    const ops = redoStack[redoStack.length - 1];
    const result = applyOps(doc, ops, { newId: makeId });
    if (result.refused.length) {
      toast.error('Impossible de rétablir : ' + result.refused[0].reason);
      return;
    }
    set((s) => ({
      doc: result.doc,
      pending: [...s.pending, ...ops],
      undoStack: [...s.undoStack, result.inverse],
      redoStack: s.redoStack.slice(0, -1),
    }));
  },

  async save() {
    const { target, pending } = get();
    if (!target) return false;
    if (!pending.length) {
      toast.success('Rien à enregistrer');
      return true;
    }
    set({ saving: true });
    try {
      // The server replays the same ops from the stored document. It starts
      // where we started, so it lands where we landed — its answer is taken as
      // the truth in case it did not.
      const res = await studioApi.applyOps(target, pending, true);
      const data = res.data.data;
      if (data.refused.length && data.applied === 0) {
        toast.error('Le serveur a refusé : ' + data.refused[0].reason);
        set({ saving: false });
        return false;
      }
      set({ doc: data.document, page: data.page ?? null, meta: data.target, hasDraft: true, versions: data.versions ?? [], pending: [], saving: false });
      toast.success('Brouillon enregistré');
      return true;
    } catch (err: any) {
      set({ saving: false });
      toast.error(err?.response?.data?.message || 'Échec de l\'enregistrement');
      return false;
    }
  },

  async publish(label) {
    const { target } = get();
    if (!target) return false;
    // Whatever is still local goes into the draft first; the server publishes
    // the draft it has, never a document the editor sends it.
    if (get().pending.length && !(await get().save())) return false;
    set({ publishing: true });
    try {
      const res = await studioApi.publish(target, label);
      const data = res.data.data;
      set({ doc: data.document, meta: data.target, hasDraft: false, versions: data.versions ?? [], pending: [], publishing: false });
      const compiled = data.compile?.status === 'compiled';
      toast.success(compiled ? 'Publié et compilé' : 'Publié');
      return true;
    } catch (err: any) {
      set({ publishing: false });
      toast.error(err?.response?.data?.message || 'Échec de la publication');
      return false;
    }
  },

  async discard() {
    const { target } = get();
    if (!target) return;
    try {
      const res = await studioApi.discard(target);
      const data = res.data.data;
      set({ doc: data.document, hasDraft: false, versions: data.versions ?? [], pending: [], undoStack: [], redoStack: [], selectedId: null });
      toast.success('Brouillon abandonné');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Impossible d\'abandonner le brouillon');
    }
  },

  async restore(versionId) {
    const { target } = get();
    if (!target) return;
    try {
      const res = await studioApi.restore(target, versionId);
      const data = res.data.data;
      set({ doc: data.document, hasDraft: true, versions: data.versions ?? [], pending: [], undoStack: [], redoStack: [], selectedId: null });
      toast.success('Version restaurée dans le brouillon');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Impossible de restaurer');
    }
  },

  applyTemplate(template) {
    const { doc } = get();
    if (!doc) return;
    // A template is ordinary operations: take every section out, put the
    // template's in. One batch, so it is one undo.
    const ops: Op[] = [
      ...doc.root.map((s) => ({ op: 'remove', nodeId: s.id }) as Op),
      ...template.document.root.map((section, index) => ({ op: 'insert', parentId: null, index, node: JSON.parse(JSON.stringify(section)) }) as Op),
    ];
    if (get().dispatch(ops)) set({ selectedId: null });
  },

  select: (id) => set({ selectedId: id }),
  setViewport: (viewport) => set({ viewport }),
  setLeftTab: (leftTab) => set({ leftTab }),

  insertBlock(blockType, parentId, index) {
    const id = makeId();
    const node: AnyNode = { id, type: 'block', block: blockType, props: defaultsFor(blockType) };
    if (get().dispatch([{ op: 'insert', parentId, index, node }])) set({ selectedId: id });
  },

  insertSection(sectionNode, index) {
    const { doc } = get();
    if (!doc) return;
    const targetIndex = index !== undefined ? index : doc.root.length;
    const cloned = JSON.parse(JSON.stringify(sectionNode));
    if (get().dispatch([{ op: 'insert', parentId: null, index: targetIndex, node: cloned }])) {
      set({ selectedId: cloned.id });
      toast.success(`Section « ${cloned.label || 'Section'} » ajoutée`);
    }
  },

  moveNode(nodeId, parentId, index) {
    get().dispatch([{ op: 'move', nodeId, parentId, index }]);
  },

  removeNode(nodeId) {
    if (get().dispatch([{ op: 'remove', nodeId }])) {
      if (get().selectedId === nodeId) set({ selectedId: null });
    }
  },

  duplicateNode(nodeId) {
    get().dispatch([{ op: 'duplicate', nodeId }]);
  },

  setField(nodeId, path, value) {
    get().dispatch([{ op: 'set', nodeId, path, value }]);
  },

  wrapInRow(nodeIds, columns) {
    const wrapperId = makeId();
    if (get().dispatch([{ op: 'wrap', nodeIds, wrapperId, layout: 'row', columns }])) set({ selectedId: wrapperId });
  },

  selectedNode() {
    const { doc, selectedId } = get();
    if (!doc || !selectedId) return null;
    return find(doc, selectedId)?.node ?? null;
  },
}));

/** The first container a new block should land in when nothing better is selected. */
export function defaultInsertTarget(doc: PageDocument, selectedId: NodeId | null): { parentId: NodeId; index: number } {
  if (selectedId) {
    const located = find(doc, selectedId);
    if (located) {
      if (located.node.type !== 'block') return { parentId: located.node.id, index: located.node.children.length };
      if (located.parent) return { parentId: located.parent.id, index: located.index + 1 };
    }
  }
  const last = doc.root[doc.root.length - 1];
  return { parentId: last.id, index: last.children.length };
}
