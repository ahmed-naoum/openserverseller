import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import type { AnyNode, ContainerNode, PageDocument, NodeId } from '@shared/document/index.js';
import { resolveProps, type Theme } from '@shared/document/theme.js';
import { BACKEND_URL } from '../lib/api';
import { find } from '@shared/document/index.js';
import BlockRenderer from '../components/helper/sitebuilder/BlockRenderer';
import { useStudio, type Viewport } from './store';

/**
 * The canvas: the page, drawn by the same renderer the storefront fallback
 * uses, with the tree's sections and layouts as real containers around it.
 *
 * Click selects. Drag reorders: a node can be dropped before any sibling or at
 * the end of any container, and the drop becomes a `move` op — so an illegal
 * drop (a section into a row, a node into its own child) is refused by the
 * same rule that refuses it everywhere else, not by the canvas guessing.
 */

const VIEWPORT_WIDTH: Record<Viewport, string> = { desktop: '100%', tablet: '768px', mobile: '390px' };
const DRAG_TYPE = 'application/x-studio-node';

function columnsTemplate(columns: number[] | undefined, count: number): string {
  if (columns?.length) return columns.map((c) => `${c}fr`).join(' ');
  return `repeat(${Math.max(1, count)}, 1fr)`;
}

function styleOf(node: AnyNode, theme: Theme): React.CSSProperties {
  // Tokens resolve against the store here exactly as the compiler resolves
  // them, so a `$secondary` band is the brand colour on the canvas too.
  const s = resolveProps(node.style ?? {}, theme);
  const css: React.CSSProperties = {};
  if (s.paddingTop !== undefined) css.paddingTop = s.paddingTop;
  if (s.paddingBottom !== undefined) css.paddingBottom = s.paddingBottom;
  if (s.paddingLeft !== undefined) css.paddingLeft = s.paddingLeft;
  if (s.paddingRight !== undefined) css.paddingRight = s.paddingRight;
  if (s.marginTop !== undefined) css.marginTop = s.marginTop;
  if (s.marginBottom !== undefined) css.marginBottom = s.marginBottom;
  if (s.backgroundImage) {
    const overlay = s.overlay ? `linear-gradient(${s.overlay},${s.overlay}),` : '';
    const base = s.background && !String(s.background).startsWith('linear') ? ` ${s.background}` : '';
    css.background = `${overlay}url("${String(s.backgroundImage).startsWith('/') ? `${BACKEND_URL}${s.backgroundImage}` : s.backgroundImage}") center/cover no-repeat${base}`;
  } else if (s.background) css.background = s.background;
  if (s.borderRadius !== undefined) css.borderRadius = s.borderRadius;
  if (s.borderWidth) css.border = `${s.borderWidth}px solid ${s.borderColor ?? '#e2e8f0'}`;
  return css;
}

/** Where a drop lands: before sibling `index` of `parentId`, or at its end. */
interface DropTarget {
  parentId: NodeId;
  index: number;
}

function useDrop(doc: PageDocument) {
  const moveNode = useStudio((s) => s.moveNode);
  const [over, setOver] = useState<string | null>(null);

  const key = (t: DropTarget) => `${t.parentId}:${t.index}`;

  const onDragOver = (t: DropTarget) => (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (over !== key(t)) setOver(key(t));
  };

  const onDrop = (t: DropTarget) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOver(null);
    const nodeId = e.dataTransfer.getData(DRAG_TYPE);
    if (!nodeId) return;
    const from = find(doc, nodeId);
    if (!from) return;
    // `move` takes the index AFTER the node has left its old place.
    let index = t.index;
    if (from.parent?.id === t.parentId && from.index < index) index -= 1;
    if (from.parent?.id === t.parentId && from.index === index) return;
    moveNode(nodeId, t.parentId, index);
  };

  return { over, key, onDragOver, onDrop, clear: () => setOver(null) };
}

export default function Canvas() {
  const doc = useStudio((s) => s.doc);
  const theme = useStudio((s) => s.theme);
  const storeId = useStudio((s) => s.storeId);
  const viewport = useStudio((s) => s.viewport);
  const selectedId = useStudio((s) => s.selectedId);
  const select = useStudio((s) => s.select);
  const insertBlock = useStudio((s) => s.insertBlock);
  const setLeftTab = useStudio((s) => s.setLeftTab);

  if (!doc) return null;
  const drop = useDrop(doc);

  const startDrag = (node: AnyNode) => (e: React.DragEvent) => {
    if (node.locked) {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    e.dataTransfer.setData(DRAG_TYPE, node.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const DropLine = ({ target }: { target: DropTarget }) => (
    <div
      onDragOver={drop.onDragOver(target)}
      onDragLeave={drop.clear}
      onDrop={drop.onDrop(target)}
      className={`h-2 -my-1 relative z-10 transition-colors ${drop.over === drop.key(target) ? 'bg-indigo-500' : 'bg-transparent'}`}
    />
  );

  const Empty = ({ parentId }: { parentId: NodeId }) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        select(parentId);
        setLeftTab('library');
      }}
      onDragOver={drop.onDragOver({ parentId, index: 0 })}
      onDrop={drop.onDrop({ parentId, index: 0 })}
      className={`w-full min-h-[72px] border-2 border-dashed rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-slate-400 hover:text-indigo-600 hover:border-indigo-300 ${
        drop.over === drop.key({ parentId, index: 0 }) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'
      }`}
    >
      <Plus className="w-4 h-4" /> Ajouter un bloc ici
    </button>
  );

  const renderChildren = (container: ContainerNode) => {
    if (!container.children.length) return <Empty parentId={container.id} />;
    return (
      <>
        {container.children.map((child, i) => (
          <React.Fragment key={child.id}>
            <DropLine target={{ parentId: container.id, index: i }} />
            {renderNode(child)}
          </React.Fragment>
        ))}
        <DropLine target={{ parentId: container.id, index: container.children.length }} />
      </>
    );
  };

  const selectionClass = (node: AnyNode) =>
    selectedId === node.id
      ? 'ring-2 ring-indigo-500 ring-offset-1 z-10'
      : 'hover:outline hover:outline-1 hover:outline-dashed hover:outline-indigo-300';

  const renderNode = (node: AnyNode): React.ReactNode => {
    if (node.hidden) {
      return (
        <div
          onClick={(e) => { e.stopPropagation(); select(node.id); }}
          className={`text-[10px] font-bold text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded px-2 py-1 ${selectionClass(node)}`}
        >
          Masqué : {node.label || (node.type === 'block' ? node.block : node.type)}
        </div>
      );
    }

    if (node.type === 'block') {
      return (
        <div
          draggable={!node.locked}
          onDragStart={startDrag(node)}
          onClick={(e) => { e.stopPropagation(); select(node.id); }}
          className={`relative cursor-pointer transition-shadow ${selectionClass(node)}`}
          style={styleOf(node, theme)}
        >
          <div className="pointer-events-none">
            <BlockRenderer isEditor blocks={[{ id: node.id, type: node.block as any, content: node.block === 'products' && storeId ? { ...resolveProps(node.props ?? {}, theme), storeId } : resolveProps(node.props ?? {}, theme) }]} />
          </div>
          {selectedId === node.id && (
            <span className="absolute -top-2.5 left-2 text-[9px] font-black uppercase tracking-wider bg-indigo-600 text-white px-1.5 py-0.5 rounded">
              {node.label || node.block}
            </span>
          )}
        </div>
      );
    }

    if (node.type === 'layout') {
      return (
        <div
          draggable={!node.locked}
          onDragStart={startDrag(node)}
          onClick={(e) => { e.stopPropagation(); select(node.id); }}
          className={`relative grid cursor-pointer p-1 rounded-lg ${selectionClass(node)}`}
          style={{ gridTemplateColumns: viewport === 'mobile' ? '1fr' : columnsTemplate(node.columns, node.children.length), gap: node.gap ?? 16, ...styleOf(node, theme) }}
        >
          {node.children.map((child, i) => (
            <div key={child.id} className="min-w-0 flex flex-col">
              <DropLine target={{ parentId: node.id, index: i }} />
              {renderNode(child)}
            </div>
          ))}
          <div className="min-w-0 flex flex-col justify-center">
            <DropLine target={{ parentId: node.id, index: node.children.length }} />
            {!node.children.length && <Empty parentId={node.id} />}
          </div>
          {selectedId === node.id && (
            <span className="absolute -top-2.5 left-2 text-[9px] font-black uppercase tracking-wider bg-violet-600 text-white px-1.5 py-0.5 rounded">
              {node.label || `Rangée ${node.columns ? node.columns.join('/') : ''}`}
            </span>
          )}
        </div>
      );
    }

    // section
    return (
      <section
        onClick={(e) => { e.stopPropagation(); select(node.id); }}
        className={`relative cursor-pointer ${node.implicit ? '' : 'rounded-lg'} ${selectionClass(node)}`}
        style={styleOf(node, theme)}
      >
        <div className="mx-auto w-full" style={node.style?.maxWidth ? { maxWidth: node.style.maxWidth } : undefined}>
          {renderChildren(node)}
        </div>
        {selectedId === node.id && (
          <span className="absolute -top-2.5 left-2 text-[9px] font-black uppercase tracking-wider bg-slate-800 text-white px-1.5 py-0.5 rounded">
            {node.label || (node.implicit ? 'Page' : 'Section')}
          </span>
        )}
      </section>
    );
  };

  const bg = (doc.settings as any)?.pageBgColor || (doc.settings as any)?.backgroundColor || '#ffffff';

  return (
    <div className="flex-1 overflow-auto bg-slate-100 p-6" onClick={() => select(null)}>
      <div
        className="mx-auto bg-white shadow-xl min-h-[600px] transition-[width] duration-300"
        style={{ width: VIEWPORT_WIDTH[viewport], maxWidth: '100%', background: bg }}
      >
        {doc.root.map((section) => (
          <React.Fragment key={section.id}>{renderNode(section)}</React.Fragment>
        ))}
        {!doc.root.length && (
          <div className="p-10 text-center text-sm text-slate-400">
            Page vide.{' '}
            <button
              className="text-indigo-600 font-bold"
              onClick={(e) => { e.stopPropagation(); insertBlock('hero', 'page', 0); }}
            >
              Ajouter une section
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
