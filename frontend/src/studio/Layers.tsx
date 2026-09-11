import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, Lock, Unlock, Trash2, Copy, ArrowUp, ArrowDown, Rows3 } from 'lucide-react';
import type { AnyNode, PageDocument } from '@shared/document/index.js';
import { find } from '@shared/document/index.js';
import { getBlock } from '@shared/blocks/index.js';
import { useStudio } from './store';

/**
 * The tree, honestly: every node, nested, with the controls that act on a node
 * as a whole. Renaming here is what lets a person and an agent both say
 * "the Hero" instead of "s1".
 */

function nodeTitle(node: AnyNode): string {
  if (node.label) return node.label;
  if (node.type === 'block') return getBlock(node.block)?.meta.label.fr ?? node.block;
  if (node.type === 'layout') return `Rangée${node.columns ? ` ${node.columns.join('/')}` : ''}`;
  return node.implicit ? 'Page' : 'Section';
}

function Row({ node, depth, doc }: { node: AnyNode; depth: number; doc: PageDocument }) {
  const selectedId = useStudio((s) => s.selectedId);
  const select = useStudio((s) => s.select);
  const setField = useStudio((s) => s.setField);
  const moveNode = useStudio((s) => s.moveNode);
  const removeNode = useStudio((s) => s.removeNode);
  const duplicateNode = useStudio((s) => s.duplicateNode);
  const dispatch = useStudio((s) => s.dispatch);
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const located = find(doc, node.id)!;
  const siblings = located.parent ? located.parent.children.length : doc.root.length;
  const isContainer = node.type !== 'block';
  const selected = selectedId === node.id;

  const commitRename = () => {
    setEditing(false);
    const label = draft.trim();
    if (label !== (node.label ?? '')) dispatch([{ op: 'rename', nodeId: node.id, label: label || null }]);
  };

  return (
    <div>
      <div
        onClick={() => select(node.id)}
        className={`group flex items-center gap-1 pr-1 rounded-md text-xs cursor-pointer ${
          selected ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 text-slate-700'
        }`}
        style={{ paddingLeft: 6 + depth * 14 }}
      >
        {isContainer ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="p-0.5">
            {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false); }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 px-1 py-0.5 rounded text-xs text-slate-900 border border-indigo-300"
          />
        ) : (
          <span
            onDoubleClick={(e) => { e.stopPropagation(); setDraft(node.label ?? ''); setEditing(true); }}
            className={`flex-1 min-w-0 truncate py-1 font-semibold ${node.hidden ? 'opacity-50 line-through' : ''}`}
            title="Double-clic pour renommer"
          >
            {nodeTitle(node)}
          </span>
        )}

        <span className={`flex items-center gap-0.5 ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <button type="button" title="Monter" disabled={located.index === 0} onClick={(e) => { e.stopPropagation(); moveNode(node.id, located.parent?.id ?? null, located.index - 1); }} className="p-0.5 disabled:opacity-30"><ArrowUp className="w-3 h-3" /></button>
          <button type="button" title="Descendre" disabled={located.index >= siblings - 1} onClick={(e) => { e.stopPropagation(); moveNode(node.id, located.parent?.id ?? null, located.index + 1); }} className="p-0.5 disabled:opacity-30"><ArrowDown className="w-3 h-3" /></button>
          <button type="button" title={node.hidden ? 'Afficher' : 'Masquer'} onClick={(e) => { e.stopPropagation(); setField(node.id, 'hidden', node.hidden ? undefined : true); }} className="p-0.5">{node.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}</button>
          <button type="button" title={node.locked ? 'Déverrouiller' : 'Verrouiller'} onClick={(e) => { e.stopPropagation(); setField(node.id, 'locked', node.locked ? undefined : true); }} className="p-0.5">{node.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}</button>
          {node.type === 'block' && located.parent && (
            <button type="button" title="Mettre dans une rangée" onClick={(e) => { e.stopPropagation(); useStudio.getState().wrapInRow([node.id]); }} className="p-0.5"><Rows3 className="w-3 h-3" /></button>
          )}
          {located.parent && (
            <button type="button" title="Dupliquer" onClick={(e) => { e.stopPropagation(); duplicateNode(node.id); }} className="p-0.5"><Copy className="w-3 h-3" /></button>
          )}
          {(located.parent || doc.root.length > 1) && (
            <button type="button" title="Supprimer" onClick={(e) => { e.stopPropagation(); removeNode(node.id); }} className="p-0.5 hover:text-rose-400"><Trash2 className="w-3 h-3" /></button>
          )}
        </span>
      </div>

      {isContainer && open && node.children.map((child) => <Row key={child.id} node={child} depth={depth + 1} doc={doc} />)}
    </div>
  );
}

export default function Layers() {
  const doc = useStudio((s) => s.doc);
  if (!doc) return null;
  return (
    <div className="p-2 space-y-0.5">
      {doc.root.map((section) => <Row key={section.id} node={section} depth={0} doc={doc} />)}
    </div>
  );
}
